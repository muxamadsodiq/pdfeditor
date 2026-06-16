"use client";

import { Bold, Check, Italic, Trash2, Underline, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OverlayRect } from "@/lib/coordinates";
import { cn } from "@/lib/utils";
import { useEditorStore, type TextStyle } from "@/store/editorStore";

interface FloatingTextToolbarProps {
  rect: OverlayRect;
  canvasWidth: number;
  canvasHeight: number;
  style: TextStyle;
}

export function FloatingTextToolbar({ rect, canvasWidth, canvasHeight, style }: FloatingTextToolbarProps) {
  const updateSelectedStyle = useEditorStore((state) => state.updateSelectedStyle);
  const deleteSelectedSpan = useEditorStore((state) => state.deleteSelectedSpan);
  const applySelectedEdit = useEditorStore((state) => state.applySelectedEdit);
  const cancelSelectedEdit = useEditorStore((state) => state.cancelSelectedEdit);

  const toolbarHeight = 38;
  const toolbarWidth = 292;
  const top = rect.top > toolbarHeight + 8 ? rect.top - toolbarHeight - 8 : Math.min(canvasHeight - toolbarHeight, rect.top + rect.height + 8);
  const left = Math.max(4, Math.min(rect.left, canvasWidth - toolbarWidth - 4));

  return (
    <div
      className="absolute z-40 flex h-9 items-center gap-1 rounded-md border border-border bg-neutral-950 px-2 text-white shadow-lg"
      style={{ left, top: Math.max(4, top) }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input
        aria-label="Font size"
        className="h-6 w-12 rounded border border-white/20 bg-white/10 px-1 text-xs outline-none"
        type="number"
        min={6}
        max={96}
        value={Math.round(style.size)}
        onChange={(event) => updateSelectedStyle({ size: Number(event.target.value) || style.size })}
      />
      <input
        aria-label="Text color"
        className="h-6 w-7 cursor-pointer rounded border border-white/20 bg-transparent p-0"
        type="color"
        value={style.color}
        onChange={(event) => updateSelectedStyle({ color: event.target.value })}
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 text-white hover:bg-white/15 hover:text-white", style.bold && "bg-white/20")}
        onClick={() => updateSelectedStyle({ bold: !style.bold })}
        title="Bold"
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 text-white hover:bg-white/15 hover:text-white", style.italic && "bg-white/20")}
        onClick={() => updateSelectedStyle({ italic: !style.italic })}
        title="Italic"
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 text-white hover:bg-white/15 hover:text-white", style.underline && "bg-white/20")}
        onClick={() => updateSelectedStyle({ underline: !style.underline })}
        title="Underline"
        aria-label="Underline"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-5 w-px bg-white/20" />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-white hover:bg-white/15 hover:text-white"
        onClick={deleteSelectedSpan}
        title="Delete text"
        aria-label="Delete text"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-white hover:bg-white/15 hover:text-white"
        onClick={cancelSelectedEdit}
        title="Cancel"
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="h-7 w-7"
        onClick={applySelectedEdit}
        title="Apply selected edit"
        aria-label="Apply selected edit"
      >
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}
