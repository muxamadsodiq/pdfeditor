import json
import os
import uuid
from pathlib import Path

from fastapi import HTTPException, status

from app.config import settings
from app.models import PdfDocumentMetadata


def ensure_storage() -> None:
    settings.documents_dir.mkdir(parents=True, exist_ok=True)
    settings.thumbnails_dir.mkdir(parents=True, exist_ok=True)


def create_document_id() -> str:
    return str(uuid.uuid4())


def document_dir(document_id: str) -> Path:
    return settings.documents_dir / document_id


def thumbnail_dir(document_id: str) -> Path:
    return settings.thumbnails_dir / document_id


def save_pdf(document_id: str, content: bytes) -> Path:
    directory = document_dir(document_id)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "original.pdf"
    path.write_bytes(content)
    return path


def save_metadata(metadata: PdfDocumentMetadata) -> None:
    directory = document_dir(metadata.document_id)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "metadata.json").write_text(metadata.model_dump_json(indent=2), encoding="utf-8")


def load_metadata(document_id: str) -> PdfDocumentMetadata:
    path = document_dir(document_id) / "metadata.json"
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF document was not found.")
    return PdfDocumentMetadata(**json.loads(path.read_text(encoding="utf-8")))


def original_pdf_path(document_id: str) -> Path:
    path = document_dir(document_id) / "original.pdf"
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file was not found.")
    return path


def edited_pdf_path(document_id: str) -> Path:
    return document_dir(document_id) / f"{document_id}_edited.pdf"


def download_pdf_path(document_id: str) -> Path:
    edited_path = edited_pdf_path(document_id)
    return edited_path if edited_path.exists() else original_pdf_path(document_id)


def replace_edited_pdf(document_id: str, temporary_path: Path) -> Path:
    destination = edited_pdf_path(document_id)
    destination.parent.mkdir(parents=True, exist_ok=True)
    os.replace(temporary_path, destination)
    return destination


def thumbnail_path(document_id: str, page_number: int) -> Path:
    path = thumbnail_dir(document_id) / f"page-{page_number}.png"
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page thumbnail was not found.")
    return path
