from pathlib import Path

import fitz
from fastapi import HTTPException, status


def analyze_pdf(path: Path) -> tuple[int, list[dict[str, float | int]]]:
    try:
        with fitz.open(path) as document:
            if document.needs_pass:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This PDF is password-protected. Please unlock it before uploading.",
                )

            page_count = document.page_count
            if page_count == 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This PDF has no pages.")

            pages = []
            for index, page in enumerate(document, start=1):
                rect = page.rect
                pages.append({"page_number": index, "width": round(rect.width, 2), "height": round(rect.height, 2)})

            return page_count, pages
    except HTTPException:
        raise
    except fitz.FileDataError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This PDF appears to be corrupted.") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="We could not read this PDF file.") from exc
