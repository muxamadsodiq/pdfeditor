from pathlib import Path

import fitz

from app.services.storage_service import thumbnail_dir


def generate_thumbnails(document_id: str, pdf_path: Path, width: int = 220) -> None:
    output_dir = thumbnail_dir(document_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    with fitz.open(pdf_path) as document:
        for index, page in enumerate(document, start=1):
            scale = width / page.rect.width
            matrix = fitz.Matrix(scale, scale)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            pixmap.save(output_dir / f"page-{index}.png")
