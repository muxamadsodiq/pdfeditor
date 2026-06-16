"use client";

import { ChangeEvent, useRef } from "react";
import {
  Download,
  FileImage,
  FileSignature,
  FileText,
  Highlighter,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Save,
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
  unsavedChanges: boolean;
  hasEditOperations: boolean;
  isApplying: boolean;
  canDownload: boolean;
  onApplyChanges: () => void;
  onDownload: () => void;
  onToggleEditMode: () => void;
  onSelectTool: (tool: ActiveTool) => void;
  onImageSelected: (file: File) => void;
  onOpenSignature: () => void;
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
  unsavedChanges,
  hasEditOperations,
  isApplying,
  canDownload,
  onApplyChanges,
  onDownload,
  onToggleEditMode,
  onSelectTool,
  onImageSelected,
  onOpenSignature,
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
    activeTool === tool ? "bg-white text-emerald-950 hover:bg-emerald-50" : "text-white hover:bg-white/10 hover:text-white";

  return (
    <header className="flex min-h-14 flex-none items-center justify-between gap-3 overflow-x-auto border-b border-emerald-950/20 bg-emerald-950 px-3 py-2 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-emerald-950">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Yusuf PDF Editor</div>
          <div className="text-xs text-white/55">Free public editor</div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" className="bg-emerald-100 text-emerald-950 hover:bg-white" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Upload PDF
        </Button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} />
        <div className="mx-2 h-6 w-px bg-white/15" />
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

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={onZoomOut}>
          <Minus className="h-4 w-4" />
        </Button>
        <div className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={onZoomIn}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={onFitPage}>
          <Maximize className="h-4 w-4" />
          Fit page
        </Button>
        <div className="mx-2 h-6 w-px bg-white/15" />
        {unsavedChanges && <div className="mr-1 rounded bg-emerald-400/15 px-2 py-1 text-xs text-emerald-100">Unsaved changes</div>}
        <Button
          variant={unsavedChanges ? "default" : "ghost"}
          size="sm"
          className={unsavedChanges ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400" : "text-white hover:bg-white/10 hover:text-white"}
          disabled={!unsavedChanges || !hasEditOperations || isApplying}
          onClick={onApplyChanges}
        >
          {isApplying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isApplying ? "Applying changes..." : "Apply Changes"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 hover:text-white"
          disabled={!canDownload || isApplying}
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>
    </header>
  );
}
