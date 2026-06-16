"use client";

import { Copy, Download, GripVertical, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PdfDocumentMetadata } from "@/types/pdf";
import { assetUrl, extractPages, pdfDownloadUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";

interface LeftPageSidebarProps {
  document: PdfDocumentMetadata | null;
  activePage: number;
  onSelectPage: (page: number) => void;
}

export function LeftPageSidebar({ document, activePage, onSelectPage }: LeftPageSidebarProps) {
  const selectedPageNumbers = useEditorStore((state) => state.selectedPageNumbers);
  const pageOrder = useEditorStore((state) => state.pageOrder);
  const pageRotations = useEditorStore((state) => state.pageRotations);
  const unsavedPageChanges = useEditorStore((state) => state.unsavedPageChanges);
  const togglePageSelection = useEditorStore((state) => state.togglePageSelection);
  const rotateSelectedPages = useEditorStore((state) => state.rotateSelectedPages);
  const rotateAllPages = useEditorStore((state) => state.rotateAllPages);
  const deleteSelectedPages = useEditorStore((state) => state.deleteSelectedPages);
  const duplicateSelectedPage = useEditorStore((state) => state.duplicateSelectedPage);
  const reorderPages = useEditorStore((state) => state.reorderPages);
  const resetPageOperations = useEditorStore((state) => state.resetPageOperations);
  const setError = useEditorStore((state) => state.setError);
  const orderedPages = pageOrder
    .map((pageNumber) => document?.pages.find((page) => page.page_number === pageNumber))
    .filter(Boolean) as NonNullable<PdfDocumentMetadata["pages"][number]>[];
  const hasSelection = selectedPageNumbers.length > 0;

  async function handleExtract() {
    if (!document || selectedPageNumbers.length === 0) return;
    try {
      setError(null);
      const response = await extractPages(document.document_id, selectedPageNumbers);
      const anchor = globalThis.document.createElement("a");
      anchor.href = pdfDownloadUrl(document.document_id, response.download_url);
      anchor.download = "";
      globalThis.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Selected pages could not be extracted.");
    }
  }

  return (
    <aside className="hidden h-full w-56 flex-none overflow-y-auto border-r border-border bg-neutral-100 px-3 py-4 lg:block">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pages</div>
        {document && <div className="text-xs text-muted-foreground">{selectedPageNumbers.length} selected</div>}
      </div>
      {!document ? (
        <div className="rounded-md border border-dashed border-border bg-white px-3 py-5 text-center text-xs text-muted-foreground">
          No PDF loaded
        </div>
      ) : (
        <div>
          <div className="mb-3 grid grid-cols-3 gap-1">
            <Button variant="outline" size="icon" disabled={!hasSelection} onClick={() => rotateSelectedPages(270)} title="Rotate left">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={!hasSelection} onClick={() => rotateSelectedPages(90)} title="Rotate right">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => rotateAllPages(90)} title="Rotate all pages">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={!hasSelection} onClick={duplicateSelectedPage} title="Duplicate selected page">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={!hasSelection} onClick={handleExtract} title="Extract selected pages">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="icon" disabled={!hasSelection} onClick={deleteSelectedPages} title="Delete selected pages">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {unsavedPageChanges && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              Apply changes to save page edits.
              <button className="mt-1 inline-flex items-center gap-1 text-amber-950 underline" onClick={resetPageOperations}>
                <Undo2 className="h-3 w-3" /> Reset page operations
              </button>
            </div>
          )}
          <div className="space-y-3">
            {orderedPages.map((page, index) => {
              const selected = selectedPageNumbers.includes(page.page_number);
              return (
                <div
                  key={`${page.page_number}-${index}`}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                    reorderPages(fromIndex, index);
                  }}
                  className={cn(
                    "rounded-md border bg-white p-2 shadow-sm transition",
                    selected ? "border-primary ring-2 ring-primary/25" : activePage === page.page_number ? "border-primary/70" : "border-border hover:border-neutral-400",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePageSelection(page.page_number)}
                      />
                      Select
                    </label>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <button type="button" className="block w-full text-left" onClick={() => onSelectPage(page.page_number)}>
                    <img
                      src={assetUrl(page.thumbnail_url)}
                      alt={`Page ${page.page_number}`}
                      className="mx-auto max-h-36 w-full object-contain transition-transform"
                      style={{ transform: `rotate(${pageRotations[page.page_number] ?? 0}deg)` }}
                    />
                    <div className="mt-2 text-center text-xs font-medium text-muted-foreground">
                      Page {page.page_number}
                      {orderedPages.filter((item) => item.page_number === page.page_number).length > 1 ? " copy" : ""}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
