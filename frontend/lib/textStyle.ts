export function pdfFontToCssFamily(font: string): string {
  const normalized = font.toLowerCase();
  if (
    normalized.includes("courier") ||
    normalized.includes("mono") ||
    normalized.includes("consola") ||
    normalized.includes("menlo")
  ) {
    return '"Courier New", Courier, monospace';
  }
  if (
    normalized.includes("times") ||
    normalized.includes("serif") ||
    normalized.includes("roman") ||
    normalized.includes("georgia")
  ) {
    return '"Times New Roman", Times, serif';
  }
  if (normalized.includes("arial")) {
    return 'Arial, Helvetica, sans-serif';
  }
  if (normalized.includes("helvetica") || normalized.includes("helv")) {
    return 'Helvetica, Arial, sans-serif';
  }
  if (normalized.includes("calibri")) {
    return 'Calibri, Arial, sans-serif';
  }
  return 'Arial, Helvetica, sans-serif';
}

export function pdfFontToCssWeight(font: string, bold: boolean): number {
  const normalized = font.toLowerCase();
  if (normalized.includes("black") || normalized.includes("heavy")) return 900;
  if (normalized.includes("extrabold") || normalized.includes("extra-bold")) return 800;
  if (bold || normalized.includes("bold")) return 700;
  if (normalized.includes("semibold") || normalized.includes("semi-bold") || normalized.includes("demi")) return 600;
  if (normalized.includes("medium")) return 500;
  return 400;
}

export function pdfFontToCssStyle(font: string, italic: boolean): "italic" | "normal" {
  const normalized = font.toLowerCase();
  return italic || normalized.includes("italic") || normalized.includes("oblique") ? "italic" : "normal";
}

export function pdfFontSizeForRect(fontSize: number, rectHeight: number, scale: number): number {
  const requested = Math.max(6, fontSize * scale);
  if (rectHeight <= 0) return requested;
  return Math.max(6, Math.min(requested, rectHeight * 0.96));
}

export function pdfLineHeightForRect(fontSize: number, rectHeight: number): string {
  return `${Math.max(fontSize * 1.08, rectHeight)}px`;
}
