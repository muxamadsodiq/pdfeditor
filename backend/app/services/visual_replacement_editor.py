from collections import Counter
import base64
import binascii
from dataclasses import dataclass
from pathlib import Path

import fitz
from fastapi import HTTPException, status

from app.config import settings
from app.models import PdfEditOperation, PdfEditResult
from app.services.storage_service import edited_pdf_path, replace_edited_pdf


RESIZED_WARNING = "Replacement text was resized to fit."
BACKGROUND_WARNING = "Background color was approximated."
STYLE_WARNING = "Some style options were applied approximately."
OVERLAP_WARNING = "Overlapping edits were applied in a stable order."
IMAGE_STYLE_WARNING = "Some image style options were applied approximately."
MIN_FONT_SIZE = 6.0
FONT_SIZE_STEP = 0.5
MAX_IMAGE_BYTES = 8 * 1024 * 1024
TEXT_CLEAR_OPERATIONS = {"replace_text", "delete_text", "style_text", "move_text", "erase_area"}


@dataclass(frozen=True)
class BackgroundSample:
    color: tuple[float, float, float]
    approximated: bool


@dataclass(frozen=True)
class TextInsertResult:
    clean_fit: bool
    resized: bool


def hex_to_rgb(value: str) -> tuple[float, float, float]:
    normalized = value.lstrip("#")
    return tuple(int(normalized[index : index + 2], 16) / 255 for index in (0, 2, 4))


def _font_name(edit: PdfEditOperation) -> str:
    family = edit.style.font.lower()
    wants_bold = edit.style.bold or any(token in family for token in ("bold", "black", "heavy", "semibold", "semi-bold", "demi"))
    wants_italic = edit.style.italic or "italic" in family or "oblique" in family
    if "courier" in family or "mono" in family:
        regular, bold, italic, bold_italic = "cour", "cobo", "coit", "cobi"
    elif "times" in family or "serif" in family or "roman" in family:
        regular, bold, italic, bold_italic = "tiro", "tibo", "tiit", "tibi"
    else:
        regular, bold, italic, bold_italic = "helv", "hebo", "heit", "hebi"

    if wants_bold and wants_italic:
        return bold_italic
    if wants_bold:
        return bold
    if wants_italic:
        return italic
    return regular


def _validated_rect(page: fitz.Page, edit: PdfEditOperation, padding: float = 0) -> fitz.Rect:
    if edit.bbox is None:
        raise ValueError("This edit requires a valid area.")
    rect = fitz.Rect(edit.bbox)
    if rect.is_empty or rect.is_infinite:
        raise ValueError("Edit bbox is invalid.")
    if not page.rect.contains(rect):
        raise ValueError("Edit bbox is outside the target page.")
    if padding <= 0:
        return rect
    return fitz.Rect(
        max(page.rect.x0, rect.x0 - padding),
        max(page.rect.y0, rect.y0 - padding),
        min(page.rect.x1, rect.x1 + padding),
        min(page.rect.y1, rect.y1 + padding),
    )


def _insert_rect(page: fitz.Page, edit: PdfEditOperation) -> fitz.Rect:
    rect = _validated_rect(page, edit)
    x0 = float(edit.position.x)
    y0 = float(edit.position.y)
    moved = abs(x0 - rect.x0) > 0.01 or abs(y0 - rect.y0) > 0.01
    if not moved:
        return rect
    target = fitz.Rect(x0, y0, x0 + rect.width, y0 + rect.height)
    if target.is_empty or target.is_infinite or not page.rect.contains(target):
        raise ValueError("Moved text must stay inside the target page.")
    return target


def _sample_background(page: fitz.Page, rect: fitz.Rect) -> BackgroundSample:
    sample_margin = max(3.0, settings.replacement_clear_padding * 2)
    clip = fitz.Rect(
        max(page.rect.x0, rect.x0 - sample_margin),
        max(page.rect.y0, rect.y0 - sample_margin),
        min(page.rect.x1, rect.x1 + sample_margin),
        min(page.rect.y1, rect.y1 + sample_margin),
    )
    try:
        scale = 2.0
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False, colorspace=fitz.csRGB)
        samples: list[tuple[int, int, int]] = []
        for y in range(pixmap.height):
            page_y = clip.y0 + (y + 0.5) / scale
            for x in range(pixmap.width):
                page_x = clip.x0 + (x + 0.5) / scale
                if rect.contains(fitz.Point(page_x, page_y)):
                    continue
                offset = (y * pixmap.width + x) * pixmap.n
                samples.append(tuple(pixmap.samples[offset : offset + 3]))
        if not samples:
            return BackgroundSample((1, 1, 1), False)

        buckets = Counter((red // 16, green // 16, blue // 16) for red, green, blue in samples)
        dominant_bucket, dominant_count = buckets.most_common(1)[0]
        dominant = [
            color
            for color in samples
            if (color[0] // 16, color[1] // 16, color[2] // 16) == dominant_bucket
        ]
        average = tuple(sum(color[channel] for color in dominant) / len(dominant) for channel in range(3))
        normalized = tuple(channel / 255 for channel in average)
        is_white = all(channel >= 0.965 for channel in normalized)
        confidence = dominant_count / len(samples)
        return BackgroundSample((1, 1, 1) if is_white else normalized, not is_white or confidence < 0.55)
    except Exception:
        return BackgroundSample((1, 1, 1), False)


def _rects_overlap(first: fitz.Rect, second: fitz.Rect) -> bool:
    intersection = first & second
    return not intersection.is_empty and intersection.width > 0.25 and intersection.height > 0.25


def _stable_edits(edits: list[PdfEditOperation]) -> list[PdfEditOperation]:
    def edit_key(edit: PdfEditOperation) -> tuple[int, float, float, str]:
        if edit.bbox:
            return edit.page_number, edit.bbox[1], edit.bbox[0], edit.id
        if edit.points:
            return edit.page_number, edit.points[0][1], edit.points[0][0], edit.id
        return edit.page_number, 0, 0, edit.id

    return sorted(edits, key=edit_key)


def _clear_text_areas(
    document: fitz.Document,
    edits: list[PdfEditOperation],
) -> tuple[dict[str, fitz.Rect], list[str]]:
    rects: dict[str, fitz.Rect] = {}
    pages_with_redactions: set[int] = set()
    warnings: list[str] = []
    page_rects: dict[int, list[fitz.Rect]] = {}

    for edit in edits:
        if edit.page_number > document.page_count:
            raise ValueError(f"Page {edit.page_number} is outside this PDF.")
        page_index = edit.page_number - 1
        page = document[page_index]
        if edit.bbox is not None:
            rects[edit.id] = _insert_rect(page, edit) if edit.operation in {"replace_text", "style_text", "move_text"} else _validated_rect(page, edit)
        if edit.operation in TEXT_CLEAR_OPERATIONS:
            clear_rect = _validated_rect(page, edit, settings.replacement_clear_padding)
            for previous in page_rects.setdefault(page_index, []):
                if _rects_overlap(previous, clear_rect) and OVERLAP_WARNING not in warnings:
                    warnings.append(OVERLAP_WARNING)
            page_rects[page_index].append(clear_rect)
            background = _sample_background(page, clear_rect)
            if background.approximated and BACKGROUND_WARNING not in warnings:
                warnings.append(BACKGROUND_WARNING)
            page.add_redact_annot(clear_rect, fill=background.color, cross_out=False)
            pages_with_redactions.add(page_index)

    for page_index in pages_with_redactions:
        document[page_index].apply_redactions(images=0, graphics=0, text=0)

    return rects, warnings


def _text_width(text: str, font_name: str, font_size: float) -> float:
    return fitz.get_text_length(text, fontname=font_name, fontsize=font_size)


def _single_line_fits(text: str, rect: fitz.Rect, font_name: str, font_size: float) -> bool:
    return _text_width(text, font_name, font_size) <= rect.width and font_size * 1.18 <= rect.height + 2


def _textbox_fits(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    font_name: str,
    font_size: float,
    color: tuple[float, float, float],
) -> bool:
    shape = page.new_shape()
    remaining = shape.insert_textbox(
        rect,
        text,
        fontname=font_name,
        fontsize=font_size,
        color=color,
        lineheight=1.05,
    )
    return remaining >= 0


def _insert_text(page: fitz.Page, rect: fitz.Rect, edit: PdfEditOperation) -> TextInsertResult:
    text = edit.new_text or edit.text
    if not text:
        return TextInsertResult(clean_fit=True, resized=False)

    font_name = _font_name(edit)
    color = hex_to_rgb(edit.style.color)
    requested_font_size = float(edit.style.size)
    font_size = requested_font_size
    multiline = "\n" in text
    use_textbox = multiline

    if not multiline and not _single_line_fits(text, rect, font_name, font_size):
        wrapped_lines = max(2, int((_text_width(text, font_name, font_size) / max(1, rect.width)) + 0.999))
        use_textbox = rect.height >= font_size * 1.05 * wrapped_lines

    while font_size >= MIN_FONT_SIZE:
        fits = (
            _textbox_fits(page, rect, text, font_name, font_size, color)
            if use_textbox
            else _single_line_fits(text, rect, font_name, font_size)
        )
        if fits:
            break
        font_size = round(font_size - FONT_SIZE_STEP, 2)

    clean_fit = font_size >= MIN_FONT_SIZE
    actual_font_size = max(MIN_FONT_SIZE, font_size)
    resized = actual_font_size < requested_font_size
    if not clean_fit:
        return TextInsertResult(clean_fit=False, resized=True)

    if use_textbox:
        remaining = page.insert_textbox(
            rect,
            text,
            fontname=font_name,
            fontsize=actual_font_size,
            color=color,
            lineheight=1.05,
            overlay=True,
        )
        clean_fit = clean_fit and remaining >= 0
        underline_width = rect.width
    else:
        text_width = _text_width(text, font_name, actual_font_size)
        baseline = min(page.rect.y1 - 1, rect.y1 - max(0.5, actual_font_size * 0.16))
        page.insert_text(
            fitz.Point(rect.x0, baseline),
            text,
            fontname=font_name,
            fontsize=actual_font_size,
            color=color,
            overlay=True,
        )
        underline_width = min(rect.width, text_width)

    if edit.style.underline:
        underline_y = min(page.rect.y1 - 0.5, rect.y1 - 0.5)
        page.draw_line(
            fitz.Point(rect.x0, underline_y),
            fitz.Point(rect.x0 + underline_width, underline_y),
            color=color,
            width=max(0.5, actual_font_size / 18),
            overlay=True,
        )

    return TextInsertResult(clean_fit=clean_fit, resized=resized)


def _validate_points(page: fitz.Page, edit: PdfEditOperation) -> list[fitz.Point]:
    points = [fitz.Point(x, y) for x, y in edit.points]
    if any(not page.rect.contains(point) for point in points):
        raise ValueError("Drawing points must stay inside the target page.")
    return points


def _decode_image_data(image_data: str) -> bytes:
    try:
        header, payload = image_data.split(",", 1)
    except ValueError as exc:
        raise ValueError("Image data is invalid.") from exc

    allowed_headers = {
        "data:image/png;base64",
        "data:image/jpeg;base64",
        "data:image/webp;base64",
    }
    if header.lower() not in allowed_headers:
        raise ValueError("Only PNG, JPEG, and WebP images are supported.")
    try:
        decoded = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Image data is invalid.") from exc
    if not decoded or len(decoded) > MAX_IMAGE_BYTES:
        raise ValueError("Image must be smaller than 8 MB.")
    try:
        fitz.Pixmap(decoded)
    except Exception as exc:
        raise ValueError("Image data could not be opened.") from exc
    return decoded


def _insert_image(page: fitz.Page, rect: fitz.Rect, edit: PdfEditOperation) -> bool:
    image_bytes = _decode_image_data(edit.image_data)
    page.insert_image(rect, stream=image_bytes, keep_proportion=True, overlay=True)
    return edit.opacity < 0.999


def _draw_path(page: fitz.Page, edit: PdfEditOperation) -> None:
    points = _validate_points(page, edit)
    page.draw_polyline(
        points,
        color=hex_to_rgb(edit.style.color),
        width=edit.style.width,
        overlay=True,
    )


def _draw_highlight(page: fitz.Page, rect: fitz.Rect, edit: PdfEditOperation) -> None:
    page.draw_rect(
        rect,
        color=None,
        fill=hex_to_rgb(edit.style.color),
        fill_opacity=edit.opacity,
        overlay=True,
    )


def _erase_area(page: fitz.Page, rect: fitz.Rect) -> bool:
    background = _sample_background(page, rect)
    page.draw_rect(
        rect,
        color=None,
        fill=background.color,
        fill_opacity=1,
        overlay=True,
    )
    return background.approximated


def apply_visual_replacements(
    document_id: str,
    original_path: Path,
    edits: list[PdfEditOperation],
) -> tuple[Path, list[PdfEditResult], list[str]]:
    temporary_path = edited_pdf_path(document_id).with_suffix(".tmp.pdf")
    results: list[PdfEditResult] = []
    warnings: list[str] = []

    try:
        with fitz.open(original_path) as document:
            if document.needs_pass:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This PDF is password-protected and cannot be edited.",
                )

            ordered_edits = _stable_edits(edits)
            rects, clear_warnings = _clear_text_areas(document, ordered_edits)
            warnings.extend(clear_warnings)
            for edit in ordered_edits:
                page = document[edit.page_number - 1]
                insert_result = TextInsertResult(clean_fit=True, resized=False)
                if edit.operation in {"replace_text", "style_text", "move_text", "add_text"}:
                    insert_result = _insert_text(page, rects[edit.id], edit)
                elif edit.operation in {"add_image", "add_signature"}:
                    if _insert_image(page, rects[edit.id], edit) and IMAGE_STYLE_WARNING not in warnings:
                        warnings.append(IMAGE_STYLE_WARNING)
                elif edit.operation == "draw_path":
                    _draw_path(page, edit)
                elif edit.operation == "highlight":
                    _draw_highlight(page, rects[edit.id], edit)
                elif edit.operation == "erase_area":
                    pass
                if insert_result.resized and RESIZED_WARNING not in warnings:
                    warnings.append(RESIZED_WARNING)
                if not insert_result.clean_fit and RESIZED_WARNING not in warnings:
                    warnings.append(RESIZED_WARNING)
                if edit.operation in {"replace_text", "style_text", "move_text", "add_text"} and (
                    edit.style.bold or edit.style.italic
                ) and STYLE_WARNING not in warnings:
                    warnings.append(STYLE_WARNING)
                results.append(
                    PdfEditResult(
                        edit_id=edit.id,
                        success=True,
                        message="Change applied successfully.",
                    )
                )

            document.save(temporary_path, garbage=4, deflate=True, clean=True)
    except HTTPException:
        temporary_path.unlink(missing_ok=True)
        raise
    except (ValueError, TypeError) as exc:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except fitz.FileDataError as exc:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This PDF appears to be corrupted.") from exc
    except Exception as exc:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The edited PDF could not be created.",
        ) from exc

    if not temporary_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The edited PDF could not be saved.",
        )

    return replace_edited_pdf(document_id, temporary_path), results, warnings
