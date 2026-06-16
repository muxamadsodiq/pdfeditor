"use client";

import * as pdfjsLib from "pdfjs-dist";

let configured = false;

export function configurePdfWorker() {
  if (configured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  configured = true;
}

export { pdfjsLib };
