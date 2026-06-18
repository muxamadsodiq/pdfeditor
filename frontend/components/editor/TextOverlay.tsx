"use client";

import { useEffect, useState } from "react";

import { FloatingTextToolbar } from "@/components/editor/FloatingTextToolbar";
import { InlineTextEditor } from "@/components/editor/InlineTextEditor";
import type { CanvasSize, OverlayRect } from "@/lib/coordinates";
import { overlayRectToPdfBbox, pdfBboxToOverlayRect } from "@/lib/coordinates";
import { pdfFontSizeForRect, pdfFontToCssFamily, pdfFontToCssStyle, pdfFontToCssWeight, pdfLineHeightForRect } from "@/lib/textStyle";
import { cn } from "@/lib/utils";
import { defaultTextStyle, useEditorStore, type TextStyle } from "@/store/editorStore";
import type { PdfTextLayerPage, PdfTextSpan } from "@/types/pdf";

interface TextOverlayProps {
  page: PdfTextLayerPage | null;
  canvasSize: CanvasSize;
}

export function TextOverlay({ page, canvasSize }: TextOverlayProps) {
  const editMode = useEditorStore((state) => state.editMode);
  const selectedSpan = useEditorStore((state) => state.selectedSpan);
  const selectedSpanId = useEditorStore((state) => state.selectedSpanId);
  const selectedPageNumber = useEditorStore((state) => state.selectedPageNumber);
  const editingStyle = useEditorStore((state) => state.editingStyle);
  const textOverrides = useEditorStore((state) => state.textOverrides);
  const styleOverrides = useEditorStore((state) => state.styleOverrides);
  const spanBboxOverrides = useEditorStore((state) => state.spanBboxOverrides);
  const deletedSpanIds = useEditorStore((state) => state.deletedSpanIds);
  const selectSpan = useEditorStore((state) => state.selectSpan);
  const moveSelectedSpan = useEditorStore((state) => state.moveSelectedSpan);
  const [dragMove, setDragMove] = useState<{
    pointerId: number;
    startX: number;
    startY: number;
    startRect: OverlayRect;
  } | null>(null);

  function handleSelect(span: PdfTextSpan) {
    selectSpan(span, page!.page_number);
  }

  function handleOverlayTextTarget(event: React.SyntheticEvent<HTMLDivElement>) {
    if (!editMode || !page) return;
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>("button[data-span-id]");
    if (!button) return;
    const span = page.text_spans.find((item) => item.id === button.dataset.spanId);
    if (!span) return;
    event.preventDefault();
    event.stopPropagation();
    handleSelect(span);
  }

  function spanStyle(span: PdfTextSpan): TextStyle {
    return styleOverrides[span.id] ?? defaultTextStyle(span);
  }

  useEffect(() => {
    if (!editMode || !page) return;

    function handleNativeSelect(event: PointerEvent | MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(`button[data-text-page="${page!.page_number}"][data-span-id]`);
      if (!button) return;
      const span = page!.text_spans.find((item) => item.id === button.dataset.spanId);
      if (!span) return;
      event.preventDefault();
      event.stopPropagation();
      selectSpan(span, page!.page_number);
    }

    document.addEventListener("pointerdown", handleNativeSelect, true);
    document.addEventListener("mousedown", handleNativeSelect, true);
    document.addEventListener("click", handleNativeSelect, true);
    return () => {
      document.removeEventListener("pointerdown", handleNativeSelect, true);
      document.removeEventListener("mousedown", handleNativeSelect, true);
      document.removeEventListener("click", handleNativeSelect, true);
    };
  }, [editMode, page, selectSpan]);

  if (!page || canvasSize.width === 0 || canvasSize.height === 0) return null;

  const rotated = Math.abs(page.rotation) % 180 === 90;
  const scale = rotated ? canvasSize.width / page.height : canvasSize.height / page.height;
  const selectionIsOnPage = selectedPageNumber === page.page_number;
  const selectedBbox = selectedSpan && selectionIsOnPage ? (spanBboxOverrides[selectedSpan.id] ?? selectedSpan.bbox) : null;
  const selectedRect = selectedBbox ? pdfBboxToOverlayRect(selectedBbox, page, canvasSize) : null;
  const selectedStyle = selectedSpan && selectionIsOnPage ? (editingStyle ?? spanStyle(selectedSpan)) : null;

  function clampRect(rect: OverlayRect): OverlayRect {
    return {
      ...rect,
      left: Math.max(0, Math.min(canvasSize.width - rect.width, rect.left)),
      top: Math.max(0, Math.min(canvasSize.height - rect.height, rect.top)),
    };
  }

  function handleMovePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!selectedRect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragMove({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: selectedRect,
    });
  }

  function handleMovePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!page || !dragMove || dragMove.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const nextRect = clampRect({
      ...dragMove.startRect,
      left: dragMove.startRect.left + event.clientX - dragMove.startX,
      top: dragMove.startRect.top + event.clientY - dragMove.startY,
    });
    moveSelectedSpan(overlayRectToPdfBbox(nextRect, page, canvasSize));
  }

  function handleMovePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragMove || dragMove.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setDragMove(null);
  }

  return (
    <div
      className="absolute left-0 top-0 z-10"
      style={{
        width: canvasSize.width,
        height: canvasSize.height,
        pointerEvents: editMode ? "auto" : "none",
      }}
      data-text-overlay-page={page.page_number}
      onPointerDownCapture={handleOverlayTextTarget}
      onMouseDownCapture={handleOverlayTextTarget}
      onClickCapture={handleOverlayTextTarget}
    >
      {page.text_spans.map((span) => {
        const originalRect = pdfBboxToOverlayRect(span.bbox, page, canvasSize);
        const effectiveBbox = spanBboxOverrides[span.id] ?? span.bbox;
        const rect = pdfBboxToOverlayRect(effectiveBbox, page, canvasSize);
        const selected = selectedSpanId === span.id;
        const style = spanStyle(span);
        const previewText = textOverrides[span.id];
        const deleted = deletedSpanIds[span.id];
        const moved = Boolean(spanBboxOverrides[span.id]);
        const hasPreview = deleted || previewText !== undefined || styleOverrides[span.id] || moved;
        const backgroundColor = span.background_color ?? "#ffffff";
        const previewFontSize = pdfFontSizeForRect(style.size, rect.height, scale);
        return (
          <div key={span.id}>
            {hasPreview && (
              <>
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: Math.max(0, originalRect.left - 2),
                    top: Math.max(0, originalRect.top - 2),
                    width: Math.min(canvasSize.width - Math.max(0, originalRect.left - 2), Math.max(originalRect.width + 4, 2)),
                    height: Math.min(canvasSize.height - Math.max(0, originalRect.top - 2), Math.max(originalRect.height + 4, 2)),
                    backgroundColor,
                  }}
                />
                {!deleted && (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: rect.left,
                      top: rect.top,
                      width: Math.max(rect.width, 2),
                      height: Math.max(rect.height, 2),
                    }}
                  >
                    <span
                      className="block whitespace-pre"
                      style={{
                        color: style.color,
                        fontFamily: pdfFontToCssFamily(style.font),
                        fontSize: previewFontSize,
                        fontWeight: pdfFontToCssWeight(style.font, style.bold),
                        fontStyle: pdfFontToCssStyle(style.font, style.italic),
                        textDecoration: style.underline ? "underline" : "none",
                        lineHeight: pdfLineHeightForRect(previewFontSize, rect.height),
                        letterSpacing: 0,
                        WebkitFontSmoothing: "antialiased",
                        fontSynthesis: "none",
                        textShadow: style.color.toLowerCase() === "#ffffff" ? "0 0 1px rgba(0,0,0,0.25)" : "0 0 1px rgba(255,255,255,0.35)",
                      }}
                    >
                      {previewText ?? span.text}
                    </span>
                  </div>
                )}
              </>
            )}
            {editMode && !deleted && !selected && (
              <button
                type="button"
                aria-label={`Text: ${span.text}`}
                data-text-page={page.page_number}
                data-span-id={span.id}
                title={span.text}
                className={cn(
                  "absolute rounded-[2px] border border-transparent bg-primary/0 transition-colors hover:border-primary/60 hover:bg-primary/10",
                  selected && "border-primary bg-primary/15",
                )}
                style={{
                  left: Math.max(0, rect.left - 4),
                  top: Math.max(0, rect.top - 4),
                  width: Math.max(rect.width + 8, 10),
                  height: Math.max(rect.height + 8, 10),
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelect(span);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelect(span);
                }}
                onMouseUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelect(span);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelect(span);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelect(span);
                }}
              />
            )}
          </div>
        );
      })}
      {editMode && selectedSpan && selectionIsOnPage && selectedRect && selectedStyle && (
        <>
          <InlineTextEditor
            span={selectedSpan}
            rect={selectedRect}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            scale={scale}
            style={selectedStyle}
          />
          <div
            className="pointer-events-none absolute rounded-[3px] border border-emerald-600/70 bg-emerald-500/5 shadow-[0_0_0_2px_rgba(255,255,255,0.75)]"
            style={{
              left: selectedRect.left,
              top: selectedRect.top,
              width: Math.max(selectedRect.width, 2),
              height: Math.max(selectedRect.height, 2),
            }}
          />
          <button
            type="button"
            aria-label="Move selected text"
            title="Move selected text"
            className="absolute z-[70] flex h-5 w-5 cursor-grab items-center justify-center rounded border border-emerald-700 bg-white text-[13px] leading-none text-emerald-800 shadow active:cursor-grabbing"
            style={{
              left: Math.max(0, selectedRect.left - 9),
              top: Math.max(0, selectedRect.top - 9),
            }}
            onPointerDown={handleMovePointerDown}
            onPointerMove={handleMovePointerMove}
            onPointerUp={handleMovePointerUp}
            onPointerCancel={handleMovePointerUp}
          >
            +
          </button>
          <FloatingTextToolbar
            rect={selectedRect}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            style={selectedStyle}
          />
        </>
      )}
    </div>
  );
}
