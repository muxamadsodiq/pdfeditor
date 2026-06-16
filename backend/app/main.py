from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.pdf_routes import router as pdf_router
from app.services.storage_service import ensure_storage

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    ensure_storage()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(pdf_router)
