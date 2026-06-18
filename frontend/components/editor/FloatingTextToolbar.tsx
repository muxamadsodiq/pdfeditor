"use client";

import { Bold, Check, Copy, Italic, Link, Move, Palette, Trash2, Type, Underline, X } from "lucide-react";

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

  const toolbarHeight = 48;
  const toolbarWidth = 612;
  const top = rect.top > toolbarHeight + 10 ? rect.top - toolbarHeight - 10 : Math.min(canvasHeight - toolbarHeight, rect.top + rect.height + 10);
  const left = Math.max(4, Math.min(rect.left, canvasWidth - toolbarWidth - 4));

  return (
    <div
      className="absolute z-[80] flex h-12 items-center overflow-hidden rounded-md border border-blue-500 bg-white text-blue-600 shadow-[0_2px_14px_rgba(37,99,235,0.25)]"
      style={{ left, top: Math.max(4, top) }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ToolbarButton active={style.bold} onClick={() => updateSelectedStyle({ bold: !style.bold })} title="Bold">
        <Bold className="h-5 w-5" />
      </ToolbarButton>
      <ToolbarButton active={style.italic} onClick={() => updateSelectedStyle({ italic: !style.italic })} title="Italic">
        <Italic className="h-5 w-5" />
      </ToolbarButton>
      <label className="flex h-12 items-center gap-1 border-r border-blue-200 px-3 text-blue-600">
        <Type className="h-5 w-5" />
        <input
          aria-label="Font size"
          className="h-8 w-12 rounded border border-blue-200 bg-white px-1 text-sm text-slate-900 outline-none focus:border-blue-500"
          type="number"
          min={6}
          max={96}
          value={Math.round(style.size)}
          onChange={(event) => updateSelectedStyle({ size: Number(event.target.value) || style.size })}
        />
      </label>
      <label className="flex h-12 cursor-pointer items-center gap-1 border-r border-blue-200 px-3 text-blue-600">
        <Palette className="h-5 w-5" />
        <input
          aria-label="Text color"
          className="h-7 w-8 cursor-pointer rounded border border-blue-200 bg-white p-0.5"
          type="color"
          value={style.color}
          onChange={(event) => updateSelectedStyle({ color: event.target.value })}
        />
      </label>
      <ToolbarButton active={style.underline} onClick={() => updateSelectedStyle({ underline: !style.underline })} title="Underline">
        <Underline className="h-5 w-5" />
      </ToolbarButton>
      <ToolbarButton title="Link">
        <Link className="h-5 w-5" />
      </ToolbarButton>
      <ToolbarButton title="Move">
        <Move className="h-5 w-5" />
      </ToolbarButton>
      <ToolbarButton title="Copy">
        <Copy className="h-5 w-5" />
      </ToolbarButton>
      <ToolbarButton onClick={deleteSelectedSpan} title="Delete text">
        <Trash2 className="h-5 w-5" />
      </ToolbarButton>
      <ToolbarButton onClick={cancelSelectedEdit} title="Cancel">
        <X className="h-5 w-5" />
      </ToolbarButton>
      <Button
        variant="ghost"
        size="icon"
        className="h-12 w-12 rounded-none border-l border-blue-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        onClick={applySelectedEdit}
        title="Apply selected edit"
        aria-label="Apply selected edit"
      >
        <Check className="h-5 w-5" />
      </Button>
    </div>
  );
}

function ToolbarButton({
  active = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-12 w-12 rounded-none border-r border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700",
        active && "bg-blue-50 text-blue-700",
      )}
      onClick={onClick}
      title={title}
      aria-label={title}
      type="button"
    >
      {children}
    </Button>
  );
}
