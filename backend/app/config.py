from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Yusuf PDF Editor"
    storage_root: Path = Path("storage")
    max_upload_size: int = 100 * 1024 * 1024
    replacement_clear_padding: float = 1.75
    allowed_mime_types: set[str] = {"application/pdf", "application/x-pdf"}
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://pdf.muhammadsodiq.com",
    ]

    @property
    def documents_dir(self) -> Path:
        return self.storage_root / "documents"

    @property
    def thumbnails_dir(self) -> Path:
        return self.storage_root / "thumbnails"

    class Config:
        env_file = ".env"


settings = Settings()
