export interface PdfPageInfo {
  page_number: number;
  width: number;
  height: number;
  thumbnail_url: string;
}

export interface PdfDocumentMetadata {
  document_id: string;
  file_name: string;
  stored_file_name: string;
  page_count: number;
  pages: PdfPageInfo[];
}

export interface PdfTextSpan {
  id: string;
  text: string;
  bbox: [number, number, number, number];
  font: string;
  size: number;
  color: string;
  background_color?: string;
  block_index: number;
  line_index: number;
  span_index: number;
  direction: "ltr" | "rtl";
}

export interface PdfTextLayerPage {
  page_number: number;
  width: number;
  height: number;
  rotation: number;
  text_spans: PdfTextSpan[];
}

export interface PdfTextLayerResponse {
  document_id: string;
  pages: PdfTextLayerPage[];
  warnings: string[];
}
