import type { PdfTextLayerPage } from "@/types/pdf";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfPageGeometry {
  width: number;
  height: number;
  rotation: number;
}

function normalizedRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

export function pdfBboxToOverlayRect(
  bbox: [number, number, number, number],
  page: PdfTextLayerPage | PdfPageGeometry,
  canvas: CanvasSize,
): OverlayRect {
  const [x0, y0, x1, y1] = bbox;
  const rotation = normalizedRotation(page.rotation);

  if (rotation === 90) {
    const scaleX = canvas.width / page.height;
    const scaleY = canvas.height / page.width;
    return {
      left: y0 * scaleX,
      top: (page.width - x1) * scaleY,
      width: (y1 - y0) * scaleX,
      height: (x1 - x0) * scaleY,
    };
  }

  if (rotation === 180) {
    const scaleX = canvas.width / page.width;
    const scaleY = canvas.height / page.height;
    return {
      left: (page.width - x1) * scaleX,
      top: (page.height - y1) * scaleY,
      width: (x1 - x0) * scaleX,
      height: (y1 - y0) * scaleY,
    };
  }

  if (rotation === 270) {
    const scaleX = canvas.width / page.height;
    const scaleY = canvas.height / page.width;
    return {
      left: (page.height - y1) * scaleX,
      top: x0 * scaleY,
      width: (y1 - y0) * scaleX,
      height: (x1 - x0) * scaleY,
    };
  }

  const scaleX = canvas.width / page.width;
  const scaleY = canvas.height / page.height;
  return {
    left: x0 * scaleX,
    top: y0 * scaleY,
    width: (x1 - x0) * scaleX,
    height: (y1 - y0) * scaleY,
  };
}

export function overlayPointToPdfPoint(
  point: { x: number; y: number },
  page: PdfPageGeometry,
  canvas: CanvasSize,
): [number, number] {
  const rotation = normalizedRotation(page.rotation);
  if (rotation === 90) {
    return [
      page.width - point.y * (page.width / canvas.height),
      point.x * (page.height / canvas.width),
    ];
  }
  if (rotation === 180) {
    return [
      page.width - point.x * (page.width / canvas.width),
      page.height - point.y * (page.height / canvas.height),
    ];
  }
  if (rotation === 270) {
    return [
      point.y * (page.width / canvas.height),
      page.height - point.x * (page.height / canvas.width),
    ];
  }
  return [
    point.x * (page.width / canvas.width),
    point.y * (page.height / canvas.height),
  ];
}

export function overlayRectToPdfBbox(
  rect: OverlayRect,
  page: PdfPageGeometry,
  canvas: CanvasSize,
): [number, number, number, number] {
  const corners = [
    overlayPointToPdfPoint({ x: rect.left, y: rect.top }, page, canvas),
    overlayPointToPdfPoint({ x: rect.left + rect.width, y: rect.top + rect.height }, page, canvas),
  ];
  return [
    Math.min(corners[0][0], corners[1][0]),
    Math.min(corners[0][1], corners[1][1]),
    Math.max(corners[0][0], corners[1][0]),
    Math.max(corners[0][1], corners[1][1]),
  ];
}

export function pdfPointToOverlayPoint(
  point: [number, number],
  page: PdfPageGeometry,
  canvas: CanvasSize,
): { x: number; y: number } {
  const rect = pdfBboxToOverlayRect([point[0], point[1], point[0] + 0.01, point[1] + 0.01], page, canvas);
  return { x: rect.left, y: rect.top };
}
