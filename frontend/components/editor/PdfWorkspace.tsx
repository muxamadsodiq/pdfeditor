"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { ErrorMessage } from "@/components/editor/ErrorMessage";
import { LoadingOverlay } from "@/components/editor/LoadingOverlay";
import { PdfPage } from "@/components/editor/PdfPage";
import { fetchTextLayer, pdfFileUrl } from "@/lib/api";
import { configurePdfWorker, pdfjsLib } from "@/lib/pdfUtils";
import { useEditorStore } from "@/store/editorStore";
import type { PdfDocumentMetadata } from "@/types/pdf";

interface PdfWorkspaceProps {
  document: PdfDocumentMetadata | null;
  zoom: number;
  onActivePageChange: (page: number) => void;
}

export function PdfWorkspace({ document, zoom, onActivePageChange }: PdfWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textLayer = useEditorStore((state) => state.textLayer);
  const setTextLayer = useEditorStore((state) => state.setTextLayer);
  const pageOrder = useEditorStore((state) => state.pageOrder);
  const pageRotations = useEditorStore((state) => state.pageRotations);
  const unsavedPageChanges = useEditorStore((state) => state.unsavedPageChanges);

  const fileUrl = useMemo(() => (document ? pdfFileUrl(document.document_id) : null), [document]);

  useEffect(() => {
    if (!document) {
      setTextLayer(null);
      return;
    }

    let cancelled = false;
    fetchTextLayer(document.document_id)
      .then((layer) => {
        if (!cancelled) setTextLayer(layer);
      })
      .catch(() => {
        if (!cancelled) setError("Text selection could not be prepared for this PDF.");
      });

    return () => {
      cancelled = true;
    };
  }, [document, setTextLayer]);

  useEffect(() => {
    if (!fileUrl) {
      setPdf(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    configurePdfWorker();

    const loadingTask = pdfjsLib.getDocument(fileUrl);
    loadingTask.promise
      .then((loadedPdf) => {
        if (!cancelled) setPdf(loadedPdf);
      })
      .catch(() => {
        if (!cancelled) setError("PDF preview could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [fileUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !document) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const page = visible?.target.getAttribute("data-page-number");
        if (page) onActivePageChange(Number(page));
      },
      { root: container, threshold: [0.35, 0.6, 0.85] },
    );

    Object.values(pageRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [document, pdf, onActivePageChange]);

  if (!document) {
    return <div className="h-full bg-neutral-200" />;
  }

  return (
    <main ref={containerRef} className="relative h-full flex-1 overflow-auto bg-neutral-200">
      {isLoading && <LoadingOverlay />}
      <div className="min-h-full px-8 py-4">
        {error && <div className="mx-auto mt-8 max-w-lg"><ErrorMessage message={error} /></div>}
        {textLayer?.warnings.map((warning) => (
          <div key={warning} className="mx-auto mt-4 max-w-lg">
            <ErrorMessage message={warning} />
          </div>
        ))}
        {pdf &&
          pageOrder.map((pageNumber, index) => document.pages.find((page) => page.page_number === pageNumber)).filter(Boolean).map((page, index) => (
            <div
              key={`${page!.page_number}-${index}`}
              data-page-number={page!.page_number}
              ref={(node) => {
                pageRefs.current[page!.page_number] = node;
              }}
              id={`pdf-page-${page!.page_number}`}
            >
              <PdfPage
                pdf={pdf}
                pageNumber={page!.page_number}
                zoom={zoom}
                rotationDelta={pageRotations[page!.page_number] ?? 0}
                disableTextOverlay={unsavedPageChanges}
                textLayerPage={textLayer?.pages.find((textPage) => textPage.page_number === page!.page_number) ?? null}
              />
            </div>
          ))}
      </div>
    </main>
  );
}
