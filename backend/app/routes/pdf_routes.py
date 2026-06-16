from pathlib import Path
import re

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import FileResponse

from app.models import (
    ApplyPdfEditsRequest,
    ApplyPdfEditsResponse,
    ExtractPagesRequest,
    ExtractPagesResponse,
    PdfDocumentMetadata,
    PdfPageInfo,
    PdfTextLayerResponse,
)
from app.services.pdf_analyzer import analyze_pdf
from app.services.storage_service import (
    create_document_id,
    download_pdf_path,
    load_metadata,
    original_pdf_path,
    save_metadata,
    save_pdf,
    thumbnail_path,
)
from app.services.thumbnail_service import generate_thumbnails
from app.services.text_layer_service import extract_text_layer
from app.services.visual_replacement_editor import apply_visual_replacements
from app.services.page_manager_service import apply_page_operations_to_path, extract_pages, extract_pdf_path, PAGE_EDIT_WARNING
from app.utils.file_validation import validate_pdf_upload

router = APIRouter(prefix="/api/pdf", tags=["pdf"])


def sanitize_pdf_filename(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", value.strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    if not cleaned:
        cleaned = "edited.pdf"
    if not cleaned.lower().endswith(".pdf"):
        cleaned = f"{cleaned}.pdf"
    return cleaned[:180]


@router.post("/upload", response_model=PdfDocumentMetadata)
async def upload_pdf(file: UploadFile = File(...)) -> PdfDocumentMetadata:
    content = await validate_pdf_upload(file)
    document_id = create_document_id()
    pdf_path = save_pdf(document_id, content)
    page_count, analyzed_pages = analyze_pdf(pdf_path)
    generate_thumbnails(document_id, pdf_path)

    pages = [
        PdfPageInfo(
            page_number=int(page["page_number"]),
            width=float(page["width"]),
            height=float(page["height"]),
            thumbnail_url=f"/api/pdf/{document_id}/thumbnail/{page['page_number']}",
        )
        for page in analyzed_pages
    ]
    metadata = PdfDocumentMetadata(
        document_id=document_id,
        file_name=file.filename or "document.pdf",
        stored_file_name="original.pdf",
        page_count=page_count,
        pages=pages,
    )
    save_metadata(metadata)
    return metadata


@router.get("/{document_id}", response_model=PdfDocumentMetadata)
async def get_pdf_metadata(document_id: str) -> PdfDocumentMetadata:
    return load_metadata(document_id)


@router.get("/{document_id}/text-layer", response_model=PdfTextLayerResponse)
async def get_pdf_text_layer(document_id: str) -> PdfTextLayerResponse:
    load_metadata(document_id)
    return extract_text_layer(document_id, original_pdf_path(document_id))


@router.get("/{document_id}/file")
async def get_pdf_file(document_id: str) -> FileResponse:
    metadata = load_metadata(document_id)
    return FileResponse(
        original_pdf_path(document_id),
        media_type="application/pdf",
        filename=metadata.file_name,
    )


@router.post("/{document_id}/apply-edits", response_model=ApplyPdfEditsResponse)
async def apply_pdf_edits(document_id: str, request: ApplyPdfEditsRequest) -> ApplyPdfEditsResponse:
    load_metadata(document_id)
    if not request.edits and not request.page_operations:
        return ApplyPdfEditsResponse(success=True, download_url=f"/api/pdf/{document_id}/download", results=[], warnings=[])

    base_path = apply_page_operations_to_path(document_id, original_pdf_path(document_id), request.page_operations)
    safe_edits = request.edits
    warnings: list[str] = []
    if request.page_operations and request.edits:
        import fitz

        with fitz.open(base_path) as managed_document:
            page_count = managed_document.page_count
        safe_edits = [edit for edit in request.edits if edit.page_number <= page_count]
        if len(safe_edits) != len(request.edits):
            warnings.append(PAGE_EDIT_WARNING)

    results = []
    if safe_edits:
        _, results, edit_warnings = apply_visual_replacements(document_id, base_path, safe_edits)
        warnings.extend(edit_warnings)
    return ApplyPdfEditsResponse(
        success=True,
        download_url=f"/api/pdf/{document_id}/download",
        results=results,
        warnings=warnings,
    )


@router.get("/{document_id}/download")
async def download_pdf(document_id: str, filename: str | None = Query(default=None, max_length=220)) -> FileResponse:
    metadata = load_metadata(document_id)
    path = download_pdf_path(document_id)
    original_name = Path(metadata.file_name)
    default_filename = f"{original_name.stem}-edited.pdf" if path != original_pdf_path(document_id) else original_name.name
    return FileResponse(path, media_type="application/pdf", filename=sanitize_pdf_filename(filename or default_filename))


@router.post("/{document_id}/extract-pages", response_model=ExtractPagesResponse)
async def extract_pdf_pages(document_id: str, request: ExtractPagesRequest) -> ExtractPagesResponse:
    load_metadata(document_id)
    path = extract_pages(document_id, original_pdf_path(document_id), request.page_numbers)
    extract_id = path.stem
    return ExtractPagesResponse(
        success=True,
        download_url=f"/api/pdf/{document_id}/download-extract/{extract_id}",
    )


@router.get("/{document_id}/download-extract/{extract_id}")
async def download_extracted_pdf(document_id: str, extract_id: str) -> FileResponse:
    metadata = load_metadata(document_id)
    original_name = Path(metadata.file_name)
    return FileResponse(
        extract_pdf_path(document_id, extract_id),
        media_type="application/pdf",
        filename=f"{original_name.stem}-extract.pdf",
    )


@router.get("/{document_id}/thumbnail/{page_number}")
async def get_pdf_thumbnail(document_id: str, page_number: int) -> FileResponse:
    load_metadata(document_id)
    return FileResponse(thumbnail_path(document_id, page_number), media_type="image/png")
