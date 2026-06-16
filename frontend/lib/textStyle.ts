export function pdfFontToCssFamily(font: string): string {
  const normalized = font.toLowerCase();
  if (normalized.includes("courier") || normalized.includes("mono")) {
    return '"Courier New", Courier, monospace';
  }
  if (normalized.includes("times") || normalized.includes("serif") || normalized.includes("roman")) {
    return '"Times New Roman", Times, serif';
  }
  return 'Arial, Helvetica, sans-serif';
}
