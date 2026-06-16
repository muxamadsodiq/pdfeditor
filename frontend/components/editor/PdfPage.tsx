"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { TextOverlay } from "@/components/editor/TextOverlay";
import { ObjectOverlay } from "@/components/editor/ObjectOverlay";
import type { CanvasSize, PdfPageGeometry } from "@/lib/coordinates";
import type { PdfTextLayerPage } from "@/types/pdf";

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  textLayerPage: PdfTextLayerPage | null;
  rotationDelta?: number;
  disableTextOverlay?: boolean;
}

export function PdfPage({ pdf, pageNumber, zoom, textLayerPage, rotationDelta = 0, disableTextOverlay = false }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [geometry, setGeometry] = useState<PdfPageGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null;

    async function renderPage() {
      try {
        setError(null);
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: zoom * 1.45, rotation: (page.rotate + rotationDelta + 360) % 360 });
        const baseViewport = page.getViewport({ scale: 1 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);
        const outputScale = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
        canvas.width = Math.floor(cssWidth * outputScale);
        canvas.height = Math.floor(cssHeight * outputScale);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);
        setCanvasSize({ width: cssWidth, height: cssHeight });
        setGeometry({
          width: textLayerPage?.width ?? baseViewport.width,
          height: textLayerPage?.height ?? baseViewport.height,
          rotation: ((textLayerPage?.rotation ?? page.rotate) + rotationDelta + 360) % 360,
        });

        renderTask = page.render({
          canvasContext: context,
          viewport,
          intent: "display",
          annotationMode: 2,
        });
        await renderTask.promise;
      } catch (err) {
        if ((err as Error).name === "RenderingCancelledException") return;
        setError("Could not render this page.");
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, rotationDelta, textLayerPage?.height, textLayerPage?.rotation, textLayerPage?.width, zoom]);

  return (
    <div className="pdf-page relative mx-auto my-6 w-fit bg-white shadow-[0_2px_18px_rgba(15,23,42,0.22)]">
      {error ? (
        <div className="flex h-96 w-[640px] items-center justify-center text-sm text-destructive">{error}</div>
      ) : (
        <>
          <canvas ref={canvasRef} />
          {!disableTextOverlay && <TextOverlay page={textLayerPage} canvasSize={canvasSize} />}
          {geometry && <ObjectOverlay pageNumber={pageNumber} geometry={geometry} canvasSize={canvasSize} />}
        </>
      )}
    </div>
  );
}
