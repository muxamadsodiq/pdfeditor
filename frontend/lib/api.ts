import type { PdfDocumentMetadata, PdfTextLayerResponse } from "@/types/pdf";
import type { ObjectEditOperation, PageOperation, TextEditOperation } from "@/store/editorStore";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail || "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export async function uploadPdf(file: File): Promise<PdfDocumentMetadata> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/pdf/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchPdfMetadata(documentId: string): Promise<PdfDocumentMetadata> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/${documentId}`);

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchTextLayer(documentId: string): Promise<PdfTextLayerResponse> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/${documentId}/text-layer`);

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export interface ApplyEditsResponse {
  success: boolean;
  download_url: string;
  results: Array<{
    edit_id: string;
    success: boolean;
    mode: string;
    message: string;
  }>;
  warnings: string[];
}

export async function applyPdfEdits(
  documentId: string,
  edits: Array<TextEditOperation | ObjectEditOperation>,
  pageOperations: PageOperation[] = [],
): Promise<ApplyEditsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/${documentId}/apply-edits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edits, page_operations: pageOperations }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function extractPages(documentId: string, pageNumbers: number[]): Promise<{ success: boolean; download_url: string }> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/${documentId}/extract-pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page_numbers: pageNumbers }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export function pdfFileUrl(documentId: string): string {
  return `${API_BASE_URL}/api/pdf/${documentId}/file`;
}

export function pdfDownloadUrl(documentId: string, downloadUrl?: string | null, filename?: string): string {
  const path = downloadUrl || `/api/pdf/${documentId}/download`;
  const url = assetUrl(path);
  if (!filename) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}filename=${encodeURIComponent(filename)}`;
}

export function assetUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
}
