from pathlib import Path
from collections import Counter

import fitz
from fastapi import HTTPException, status

from app.models import PdfTextLayerPage, PdfTextLayerResponse, PdfTextSpan


SCANNED_WARNING = "This PDF looks scanned or image-based. Existing text cannot be selected yet."


def _color_to_hex(color: int | None) -> str:
    if color is None:
        return "#000000"
    return f"#{color & 0xFFFFFF:06x}"


def _rgb_to_hex(color: tuple[int, int, int]) -> str:
    return f"#{color[0]:02x}{color[1]:02x}{color[2]:02x}"


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    normalized = value.lstrip("#")
    try:
        return tuple(int(normalized[index : index + 2], 16) for index in (0, 2, 4))
    except ValueError:
        return (0, 0, 0)


def _color_distance(first: tuple[int, int, int], second: tuple[int, int, int]) -> int:
    return sum(abs(first[index] - second[index]) for index in range(3))


def _pixmap_color_at(
    pixmap: fitz.Pixmap,
    page: fitz.Page,
    point: tuple[float, float],
) -> tuple[int, int, int] | None:
    if not page.rect.contains(fitz.Point(point[0], point[1])):
        return None
    scale_x = pixmap.width / max(1, page.rect.width)
    scale_y = pixmap.height / max(1, page.rect.height)
    x = max(0, min(pixmap.width - 1, round((point[0] - page.rect.x0) * scale_x)))
    y = max(0, min(pixmap.height - 1, round((point[1] - page.rect.y0) * scale_y)))
    offset = (y * pixmap.width + x) * pixmap.n
    return tuple(pixmap.samples[offset : offset + 3])


def _sample_span_background(
    page: fitz.Page,
    pixmap: fitz.Pixmap,
    bbox: list[float],
    text_color: str,
) -> tuple[str, bool]:
    rect = fitz.Rect(bbox)
    text_rgb = _hex_to_rgb(text_color)
    margin = max(2.0, min(8.0, rect.height * 0.28))
    sample_points: list[tuple[float, float]] = []

    for fraction in (0.2, 0.5, 0.8):
        x = rect.x0 + rect.width * fraction
        y = rect.y0 + rect.height * fraction
        sample_points.extend(
            [
                (x, rect.y0 - margin),
                (x, rect.y1 + margin),
                (rect.x0 - margin, y),
                (rect.x1 + margin, y),
            ]
        )

    sample_points.extend(
        [
            (rect.x0 + 1, rect.y0 + 1),
            (rect.x1 - 1, rect.y0 + 1),
            (rect.x0 + 1, rect.y1 - 1),
            (rect.x1 - 1, rect.y1 - 1),
        ]
    )

    samples: list[tuple[int, int, int]] = []
    for point in sample_points:
        color = _pixmap_color_at(pixmap, page, point)
        if color is None:
            continue
        if _color_distance(color, text_rgb) < 34:
            continue
        samples.append(color)

    if not samples:
        return "#ffffff", True

    buckets = Counter((red // 12, green // 12, blue // 12) for red, green, blue in samples)
    dominant_bucket, dominant_count = buckets.most_common(1)[0]
    dominant = [
        color
        for color in samples
        if (color[0] // 12, color[1] // 12, color[2] // 12) == dominant_bucket
    ]
    average = tuple(round(sum(color[channel] for color in dominant) / len(dominant)) for channel in range(3))
    if all(channel >= 247 for channel in average):
        return "#ffffff", dominant_count / len(samples) < 0.55
    return _rgb_to_hex(average), dominant_count / len(samples) < 0.55


def _line_direction(line: dict) -> str:
    direction = line.get("dir")
    if isinstance(direction, (list, tuple)) and direction:
        return "rtl" if float(direction[0]) < 0 else "ltr"
    return "ltr"


def extract_text_layer(document_id: str, pdf_path: Path) -> PdfTextLayerResponse:
    pages: list[PdfTextLayerPage] = []
    total_spans = 0

    try:
        with fitz.open(pdf_path) as document:
            if document.needs_pass:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This PDF is password-protected. Please unlock it before uploading.",
                )

            for page_index, page in enumerate(document, start=1):
                page_dict = page.get_text("dict")
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False, colorspace=fitz.csRGB)
                text_spans: list[PdfTextSpan] = []

                for block_index, block in enumerate(page_dict.get("blocks", [])):
                    if block.get("type") != 0:
                        continue
                    for line_index, line in enumerate(block.get("lines", [])):
                        direction = _line_direction(line)
                        for span_index, span in enumerate(line.get("spans", [])):
                            text = span.get("text", "")
                            if not text.strip():
                                continue
                            bbox = [round(float(value), 3) for value in span.get("bbox", [0, 0, 0, 0])]
                            color = _color_to_hex(span.get("color"))
                            background_color, _background_approximated = _sample_span_background(page, pixmap, bbox, color)
                            text_spans.append(
                                PdfTextSpan(
                                    id=f"p{page_index}_b{block_index}_l{line_index}_s{span_index}",
                                    text=text,
                                    bbox=bbox,
                                    font=span.get("font") or "Unknown",
                                    size=round(float(span.get("size") or 0), 3),
                                    color=color,
                                    background_color=background_color,
                                    block_index=block_index,
                                    line_index=line_index,
                                    span_index=span_index,
                                    direction=direction,
                                )
                            )

                total_spans += len(text_spans)
                pages.append(
                    PdfTextLayerPage(
                        page_number=page_index,
                        width=round(float(page.rect.width), 3),
                        height=round(float(page.rect.height), 3),
                        rotation=int(page.rotation or 0),
                        text_spans=text_spans,
                    )
                )
    except HTTPException:
        raise
    except fitz.FileDataError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This PDF appears to be corrupted.") from exc

    warnings = [SCANNED_WARNING] if total_spans == 0 else []
    return PdfTextLayerResponse(document_id=document_id, pages=pages, warnings=warnings)
