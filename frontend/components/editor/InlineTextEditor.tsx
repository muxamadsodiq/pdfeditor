"use client";

import { ChangeEvent, KeyboardEvent, SyntheticEvent, useLayoutEffect, useRef, useState } from "react";

import type { OverlayRect } from "@/lib/coordinates";
import { pdfFontSizeForRect, pdfFontToCssFamily, pdfFontToCssStyle, pdfFontToCssWeight, pdfLineHeightForRect } from "@/lib/textStyle";
import { useEditorStore, type TextStyle } from "@/store/editorStore";
import type { PdfTextSpan } from "@/types/pdf";

interface InlineTextEditorProps {
  span: PdfTextSpan;
  rect: OverlayRect;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  style: TextStyle;
}

export function InlineTextEditor({ span, rect, canvasWidth, canvasHeight, scale, style }: InlineTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [backgroundColor, setBackgroundColor] = useState(span.background_color ?? "#ffffff");
  const editingValue = useEditorStore((state) => state.editingValue);
  const updateEditingValue = useEditorStore((state) => state.updateEditingValue);
  const applySelectedEdit = useEditorStore((state) => state.applySelectedEdit);
  const cancelSelectedEdit = useEditorStore((state) => state.cancelSelectedEdit);

  useLayoutEffect(() => {
    function focusEditor() {
      textareaRef.current?.focus({ preventScroll: true });
      textareaRef.current?.select();
    }

    focusEditor();
    const animationFrame = window.requestAnimationFrame(focusEditor);
    const timeout = window.setTimeout(focusEditor, 40);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [span.id]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(canvasHeight - rect.top - 4, Math.max(rect.height + 4, textarea.scrollHeight))}px`;
  }, [canvasHeight, editingValue, rect.height, rect.top, style.size]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const canvas = textarea?.closest(".pdf-page")?.querySelector("canvas");
    if (!canvas) return;
    setBackgroundColor(span.background_color ?? sampleCanvasBackground(canvas, rect) ?? "#ffffff");
  }, [rect.height, rect.left, rect.top, rect.width, span.background_color, span.id]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    event.stopPropagation();
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      applySelectedEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelSelectedEdit();
    }
  }

  function stopEditorEvent(event: SyntheticEvent<HTMLTextAreaElement>) {
    event.stopPropagation();
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    event.stopPropagation();
    updateEditingValue(event.target.value);
  }

  const fontSize = pdfFontSizeForRect(style.size, rect.height, scale);
  const estimatedWidth = Math.max(rect.width + 16, editingValue.length * fontSize * 0.58, 48);
  const availableWidth = Math.max(48, canvasWidth - rect.left - 4);
  const editorWidth = Math.min(availableWidth, estimatedWidth);
  const editorMinWidth = Math.min(availableWidth, Math.max(rect.width + 8, 40));
  const editorMinHeight = Math.max(rect.height, fontSize * 1.08);
  const editorMaxHeight = Math.max(40, canvasHeight - rect.top - 4);
  const coverPadding = Math.max(3, Math.min(6, fontSize * 0.18));
  const coverLeft = Math.max(0, rect.left - coverPadding);
  const coverTop = Math.max(0, rect.top - coverPadding);
  const coverWidth = Math.min(canvasWidth - coverLeft, Math.max(editorWidth, editorMinWidth) + coverPadding * 2);
  const coverHeight = Math.min(canvasHeight - coverTop, editorMinHeight + coverPadding * 2);

  return (
    <>
      <div
        className="pointer-events-none absolute z-40 rounded-[2px]"
        style={{
          left: coverLeft,
          top: coverTop,
          width: Math.max(coverWidth, 2),
          height: Math.max(coverHeight, 2),
          backgroundColor,
        }}
      />
      <textarea
        ref={textareaRef}
        value={editingValue}
        aria-label="Edit selected text"
        className="absolute z-50 resize-none overflow-hidden rounded-[2px] border border-emerald-600/70 px-1 py-0 shadow-[0_0_0_2px_rgba(16,185,129,0.16)] outline-none"
        style={{
          left: rect.left,
          top: rect.top,
          minWidth: editorMinWidth,
          width: editorWidth,
          minHeight: editorMinHeight,
          maxHeight: editorMaxHeight,
          backgroundColor,
          color: style.color,
          fontFamily: pdfFontToCssFamily(style.font),
          fontSize,
          fontWeight: pdfFontToCssWeight(style.font, style.bold),
          fontStyle: pdfFontToCssStyle(style.font, style.italic),
          textDecoration: style.underline ? "underline" : "none",
          lineHeight: pdfLineHeightForRect(fontSize, rect.height),
          letterSpacing: 0,
          WebkitFontSmoothing: "antialiased",
          fontSynthesis: "none",
        }}
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onInput={stopEditorEvent}
        onClick={stopEditorEvent}
        onDoubleClick={stopEditorEvent}
        onPointerDown={stopEditorEvent}
        onPointerUp={stopEditorEvent}
        onMouseDown={stopEditorEvent}
        onMouseUp={stopEditorEvent}
      />
    </>
  );
}

function sampleCanvasBackground(canvas: HTMLCanvasElement, rect: OverlayRect): string | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const bounds = canvas.getBoundingClientRect();
  if (!context || bounds.width === 0 || bounds.height === 0) return null;

  const ratioX = canvas.width / bounds.width;
  const ratioY = canvas.height / bounds.height;
  const samplePoints = [
    [rect.left - 5, rect.top + rect.height / 2],
    [rect.left + rect.width + 5, rect.top + rect.height / 2],
    [rect.left + rect.width / 2, rect.top - 5],
    [rect.left + rect.width / 2, rect.top + rect.height + 5],
    [rect.left + 3, rect.top + 3],
    [rect.left + rect.width - 3, rect.top + 3],
    [rect.left + 3, rect.top + rect.height - 3],
    [rect.left + rect.width - 3, rect.top + rect.height - 3],
  ];

  for (const xFraction of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    for (const yFraction of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      samplePoints.push([rect.left + rect.width * xFraction, rect.top + rect.height * yFraction]);
    }
  }

  const samples: Array<[number, number, number]> = [];
  for (const [cssX, cssY] of samplePoints) {
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(cssX * ratioX)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(cssY * ratioY)));
    try {
      const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
      if (alpha > 10) samples.push([red, green, blue]);
    } catch {
      return null;
    }
  }

  if (samples.length === 0) return null;
  const buckets = new Map<string, Array<[number, number, number]>>();
  for (const sample of samples) {
    const key = `${Math.floor(sample[0] / 8)},${Math.floor(sample[1] / 8)},${Math.floor(sample[2] / 8)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), sample]);
  }
  const dominant = [...buckets.values()].sort((a, b) => b.length - a.length)[0] ?? samples;
  const exactCounts = new Map<string, { color: [number, number, number]; count: number }>();
  for (const color of dominant) {
    const key = color.join(",");
    const existing = exactCounts.get(key);
    exactCounts.set(key, { color, count: (existing?.count ?? 0) + 1 });
  }
  const [red, green, blue] = [...exactCounts.values()].sort((a, b) => b.count - a.count)[0]?.color ?? dominant[0];
  return `rgb(${red}, ${green}, ${blue})`;
}
