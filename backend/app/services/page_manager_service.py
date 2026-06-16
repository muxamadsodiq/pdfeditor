import uuid
from pathlib import Path

import fitz
from fastapi import HTTPException, status

from app.models import PdfPageOperation
from app.services.storage_service import document_dir, edited_pdf_path, replace_edited_pdf


PAGE_EDIT_WARNING = "Some edits were skipped because their page was removed."


def _open_pdf(path: Path) -> fitz.Document:
    try:
        document = fitz.open(path)
    except fitz.FileDataError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This PDF appears to be corrupted.") from exc
    if document.needs_pass:
        document.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This PDF is password-protected and cannot be edited.",
        )
    return document


def _validate_page_number(page_number: int, page_count: int) -> None:
    if page_number < 1 or page_number > page_count:
        raise ValueError(f"Page {page_number} is outside this PDF.")


def apply_page_operations_to_path(
    document_id: str,
    original_path: Path,
    operations: list[PdfPageOperation],
) -> Path:
    if not operations:
        return original_path

    temporary_path = edited_pdf_path(document_id).with_suffix(".pages.tmp.pdf")
    temporary_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        source = _open_pdf(original_path)
        page_count = source.page_count
        working: list[dict[str, int]] = [{"source": index, "rotation": source[index].rotation} for index in range(page_count)]

        # Operations are applied in the order sent by the UI. Each item in the
        # working list still points at the original source page, so repeated
        # Apply always starts cleanly from original.pdf and never stacks output.
        for operation in operations:
            if operation.operation == "rotate_page":
                if operation.page_number is None:
                    raise ValueError("Select a page to rotate.")
                _validate_page_number(operation.page_number, page_count)
                for item in working:
                    if item["source"] == operation.page_number - 1:
                        item["rotation"] = (item["rotation"] + operation.degrees) % 360
            elif operation.operation == "rotate_all":
                for item in working:
                    item["rotation"] = (item["rotation"] + operation.degrees) % 360
            elif operation.operation == "delete_pages":
                pages = set(operation.page_numbers)
                if not pages:
                    raise ValueError("Select pages to delete.")
                for page_number in pages:
                    _validate_page_number(page_number, page_count)
                working = [item for item in working if item["source"] + 1 not in pages]
                if not working:
                    raise ValueError("At least one page must remain.")
            elif operation.operation == "duplicate_page":
                if operation.page_number is None:
                    raise ValueError("Select a page to duplicate.")
                _validate_page_number(operation.page_number, page_count)
                insert_at = next(
                    (index + 1 for index, item in enumerate(working) if item["source"] == operation.page_number - 1),
                    len(working),
                )
                working.insert(insert_at, {"source": operation.page_number - 1, "rotation": source[operation.page_number - 1].rotation})
            elif operation.operation == "reorder_pages":
                if not operation.page_order:
                    raise ValueError("Page order is empty.")
                if len(operation.page_order) != len(working):
                    raise ValueError("Page order does not match the current pages.")
                available = working[:]
                reordered: list[dict[str, int]] = []
                for page_number in operation.page_order:
                    _validate_page_number(page_number, page_count)
                    match_index = next(
                        (index for index, item in enumerate(available) if item["source"] == page_number - 1),
                        None,
                    )
                    if match_index is None:
                        raise ValueError("Page order contains an unavailable page.")
                    reordered.append(available.pop(match_index))
                working = reordered

        output = fitz.open()
        for item in working:
            output.insert_pdf(source, from_page=item["source"], to_page=item["source"])
            output[-1].set_rotation(item["rotation"])

        output.save(temporary_path, garbage=4, deflate=True, clean=True)
        output.close()
        source.close()
    except HTTPException:
        temporary_path.unlink(missing_ok=True)
        raise
    except (ValueError, TypeError) as exc:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Page changes could not be applied.") from exc

    return replace_edited_pdf(document_id, temporary_path)


def extract_pages(document_id: str, original_path: Path, page_numbers: list[int]) -> Path:
    extract_id = str(uuid.uuid4())
    output_path = document_dir(document_id) / "extracts" / f"{extract_id}.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        source = _open_pdf(original_path)
        if not page_numbers:
            raise ValueError("Select pages to extract.")
        output = fitz.open()
        for page_number in page_numbers:
            _validate_page_number(page_number, source.page_count)
            output.insert_pdf(source, from_page=page_number - 1, to_page=page_number - 1)
        output.save(output_path, garbage=4, deflate=True, clean=True)
        output.close()
        source.close()
    except HTTPException:
        output_path.unlink(missing_ok=True)
        raise
    except (ValueError, TypeError) as exc:
        output_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        output_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Selected pages could not be extracted.") from exc

    return output_path


def extract_pdf_path(document_id: str, extract_id: str) -> Path:
    path = document_dir(document_id) / "extracts" / f"{extract_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extracted PDF was not found.")
    return path
