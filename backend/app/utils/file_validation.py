from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings


async def validate_pdf_upload(file: UploadFile) -> bytes:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please choose a PDF file.")

    extension = Path(file.filename).suffix.lower()
    if extension != ".pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported.")

    if file.content_type not in settings.allowed_mime_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is not a valid PDF.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded PDF is empty.")

    if len(content) > settings.max_upload_size:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="PDF files must be 100MB or smaller.")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file does not look like a valid PDF.")

    return content
