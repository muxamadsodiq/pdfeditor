"use client";

import { ChangeEvent, useRef } from "react";
import {
  FileImage,
  FileSignature,
  FileText,
  Highlighter,
  Maximize,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Scissors,
  Type,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActiveTool } from "@/store/editorStore";

interface TopToolbarProps {
  zoom: number;
  onUpload: (file: File) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitPage: () => void;
  activeTool: ActiveTool;
  canEditText: boolean;
  editTextDisabledMessage: string;
  canDownload: boolean;
  onToggleEditMode: () => void;
  onSelectTool: (tool: ActiveTool) => void;
  onImageSelected: (file: File) => void;
  onOpenSignature: () => void;
  onHome: () => void;
}

export function TopToolbar({
  zoom,
  onUpload,
  onZoomIn,
  onZoomOut,
  onFitPage,
  activeTool,
  canEditText,
  editTextDisabledMessage,
  canDownload,
  onToggleEditMode,
  onSelectTool,
  onImageSelected,
  onOpenSignature,
  onHome,
}: TopToolbarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    event.target.value = "";
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImageSelected(file);
    event.target.value = "";
  }

  const toolButton = (tool: ActiveTool) =>
    activeTool === tool ? "secondary" as const : "ghost" as const;
  const toolClass = (tool: ActiveTool) =>
    activeTool === tool
      ? "border border-blue-500 bg-blue-50 text-blue-700 shadow-[0_0_0_1px_rgba(59,130,246,0.25)] hover:bg-blue-100"
      : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800";

  return (
    <header className="flex min-h-14 flex-none items-center gap-2 overflow-x-auto border-b border-blue-100 bg-white px-3 py-2 text-slate-900 shadow-sm">
      <button
        type="button"
        className="flex flex-none items-center gap-2 rounded-md pr-2 text-left hover:bg-emerald-50"
        onClick={onHome}
        title="Home page"
      >
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-emerald-500 text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div className="hidden min-w-[96px] xl:block">
          <div className="truncate text-sm font-semibold text-slate-950">Yusuf PDF</div>
          <div className="text-xs text-slate-500">PDF editor</div>
        </div>
      </button>

      <div className="flex flex-none items-center gap-1">
        <Button variant="outline" size="sm" className="flex-none border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Upload PDF
        </Button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} />
        <div className="mx-1 h-8 w-px bg-blue-100" />
        <Button
          variant={toolButton("select")}
          size="sm"
          className={toolClass("select")}
          disabled={!canDownload}
          onClick={() => onSelectTool("select")}
          title="Select and move objects"
        >
          <MousePointer2 className="h-4 w-4" />
          Select
        </Button>
        <Button
          variant={toolButton("edit_text")}
          size="sm"
          className={toolClass("edit_text")}
          disabled={!canEditText}
          onClick={onToggleEditMode}
          title={canEditText ? "Edit existing PDF text" : editTextDisabledMessage}
        >
          <Type className="h-4 w-4" />
          Edit Text
        </Button>
        <Button variant={toolButton("add_text")} size="sm" className={toolClass("add_text")} disabled={!canDownload} onClick={() => onSelectTool("add_text")}>
          <Type className="h-4 w-4" />
          Add Text
        </Button>
        <Button variant={toolButton("add_image")} size="sm" className={toolClass("add_image")} disabled={!canDownload} onClick={() => imageInputRef.current?.click()}>
          <FileImage className="h-4 w-4" />
          Add Image
        </Button>
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImage} />
        <Button variant={toolButton("draw")} size="sm" className={toolClass("draw")} disabled={!canDownload} onClick={() => onSelectTool("draw")}>
          <PenLine className="h-4 w-4" />
          Draw
        </Button>
        <Button variant={toolButton("highlight")} size="sm" className={toolClass("highlight")} disabled={!canDownload} onClick={() => onSelectTool("highlight")}>
          <Highlighter className="h-4 w-4" />
          Highlight
        </Button>
        <Button variant={toolButton("signature")} size="sm" className={toolClass("signature")} disabled={!canDownload} onClick={onOpenSignature}>
          <FileSignature className="h-4 w-4" />
          Signature
        </Button>
        <Button variant={toolButton("erase_area")} size="sm" className={toolClass("erase_area")} disabled={!canDownload} onClick={() => onSelectTool("erase_area")}>
          <Scissors className="h-4 w-4" />
          Erase Area
        </Button>
      </div>

      <div className="ml-auto flex flex-none items-center gap-1">
        <Button variant="ghost" size="icon" className="text-slate-600 hover:bg-blue-50 hover:text-blue-700" onClick={onZoomOut}>
          <Minus className="h-4 w-4" />
        </Button>
        <div className="w-14 text-center text-sm tabular-nums text-slate-700">{Math.round(zoom * 100)}%</div>
        <Button variant="ghost" size="icon" className="text-slate-600 hover:bg-blue-50 hover:text-blue-700" onClick={onZoomIn}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-blue-50 hover:text-blue-700" onClick={onFitPage}>
          <Maximize className="h-4 w-4" />
          Fit page
        </Button>
      </div>
    </header>
  );
}
