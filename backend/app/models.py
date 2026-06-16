from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class PdfPageInfo(BaseModel):
    page_number: int
    width: float
    height: float
    thumbnail_url: str


class PdfDocumentMetadata(BaseModel):
    document_id: str
    file_name: str
    stored_file_name: str
    page_count: int
    pages: list[PdfPageInfo]


class PdfTextSpan(BaseModel):
    id: str
    text: str
    bbox: list[float]
    font: str
    size: float
    color: str
    background_color: str = "#ffffff"
    block_index: int
    line_index: int
    span_index: int
    direction: str


class PdfTextLayerPage(BaseModel):
    page_number: int
    width: float
    height: float
    rotation: int
    text_spans: list[PdfTextSpan]


class PdfTextLayerResponse(BaseModel):
    document_id: str
    pages: list[PdfTextLayerPage]
    warnings: list[str]


class PdfEditStyle(BaseModel):
    font: str = "Helvetica"
    size: float = Field(default=12, ge=1, le=300)
    color: str = "#000000"
    bold: bool = False
    italic: bool = False
    underline: bool = False
    width: float = Field(default=2, ge=0.25, le=50)

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) != 7 or not normalized.startswith("#"):
            raise ValueError("Color must use #RRGGBB format.")
        try:
            int(normalized[1:], 16)
        except ValueError as exc:
            raise ValueError("Color must use #RRGGBB format.") from exc
        return normalized.lower()


class PdfEditPosition(BaseModel):
    x: float
    y: float


class PdfEditOperation(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    page_number: int = Field(ge=1)
    target_span_id: str = Field(default="", max_length=240)
    operation: Literal[
        "replace_text",
        "delete_text",
        "add_text",
        "style_text",
        "move_text",
        "add_image",
        "draw_path",
        "highlight",
        "add_signature",
        "erase_area",
    ]
    old_text: str = ""
    new_text: str = ""
    text: str = ""
    bbox: tuple[float, float, float, float] | None = None
    style: PdfEditStyle = Field(default_factory=PdfEditStyle)
    position: PdfEditPosition = Field(default_factory=lambda: PdfEditPosition(x=0, y=0))
    image_data: str = Field(default="", max_length=12_000_000)
    points: list[tuple[float, float]] = Field(default_factory=list, max_length=20_000)
    opacity: float = Field(default=1, ge=0, le=1)

    @field_validator("bbox")
    @classmethod
    def validate_bbox(
        cls,
        value: tuple[float, float, float, float] | None,
    ) -> tuple[float, float, float, float] | None:
        if value is None:
            return value
        x0, y0, x1, y1 = value
        if x1 <= x0 or y1 <= y0:
            raise ValueError("Edit bbox must have positive width and height.")
        return value

    @model_validator(mode="after")
    def validate_operation_payload(self) -> "PdfEditOperation":
        if self.operation == "draw_path":
            if len(self.points) < 2:
                raise ValueError("A drawing needs at least two points.")
        elif self.bbox is None:
            raise ValueError("This edit requires a valid area.")

        if self.operation in {"add_image", "add_signature"} and not self.image_data:
            raise ValueError("Image data is required.")
        return self


class ApplyPdfEditsRequest(BaseModel):
    edits: list[PdfEditOperation] = Field(default_factory=list, max_length=5000)
    page_operations: list["PdfPageOperation"] = Field(default_factory=list, max_length=1000)


class PdfPageOperation(BaseModel):
    operation: Literal["rotate_page", "rotate_all", "delete_pages", "reorder_pages", "duplicate_page"]
    page_number: int | None = Field(default=None, ge=1)
    page_numbers: list[int] = Field(default_factory=list, max_length=5000)
    page_order: list[int] = Field(default_factory=list, max_length=5000)
    degrees: int = 90

    @field_validator("degrees")
    @classmethod
    def validate_degrees(cls, value: int) -> int:
        if value % 90 != 0:
            raise ValueError("Rotation must use 90 degree steps.")
        return value % 360


class PdfEditResult(BaseModel):
    edit_id: str
    success: bool
    mode: str = "visual_replacement"
    message: str


class ApplyPdfEditsResponse(BaseModel):
    success: bool
    download_url: str
    results: list[PdfEditResult]
    warnings: list[str]


class ExtractPagesRequest(BaseModel):
    page_numbers: list[int] = Field(min_length=1, max_length=5000)


class ExtractPagesResponse(BaseModel):
    success: bool
    download_url: str
