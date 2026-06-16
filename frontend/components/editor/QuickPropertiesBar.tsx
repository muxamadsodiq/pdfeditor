"use client";

import { Bold, Italic, SlidersHorizontal, Trash2, Underline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";

export function QuickPropertiesBar() {
  const selectedSpan = useEditorStore((state) => state.selectedSpan);
  const selectedObject = useEditorStore((state) =>
    state.addedObjects.find((object) => object.id === state.selectedObjectId),
  );
  const activeTool = useEditorStore((state) => state.activeTool);
  const drawingStyle = useEditorStore((state) => state.drawingStyle);
  const highlightStyle = useEditorStore((state) => state.highlightStyle);
  const updateObject = useEditorStore((state) => state.updateObject);
  const deleteSelectedObject = useEditorStore((state) => state.deleteSelectedObject);
  const setDrawingStyle = useEditorStore((state) => state.setDrawingStyle);
  const setHighlightStyle = useEditorStore((state) => state.setHighlightStyle);

  if (selectedSpan) {
    return null;
  }

  if (selectedObject) {
    return (
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-emerald-900/10 bg-emerald-50 px-3 py-2 text-sm shadow-sm">
        <QuickTitle label={`${selectedObject.type} properties`} />
        {selectedObject.type === "text" && (
          <>
            <input
              className="h-9 min-w-48 flex-1 rounded-md border border-emerald-200 bg-white px-3 text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              value={selectedObject.text ?? ""}
              onChange={(event) => updateObject(selectedObject.id, { text: event.target.value }, false)}
              aria-label="Added text"
            />
            <select
              className="h-9 rounded-md border border-emerald-200 bg-white px-2 text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              value={selectedObject.style.font}
              onChange={(event) => updateObject(selectedObject.id, { style: { ...selectedObject.style, font: event.target.value } }, false)}
              aria-label="Font family"
            >
              <option>Helvetica</option>
              <option>Times Roman</option>
              <option>Courier</option>
            </select>
            <NumberInput label="Size" value={selectedObject.style.size} min={6} max={300} onChange={(size) => updateObject(selectedObject.id, { style: { ...selectedObject.style, size: size || 6 } }, false)} />
            <ColorInput value={selectedObject.style.color} onChange={(color) => updateObject(selectedObject.id, { style: { ...selectedObject.style, color } }, false)} />
            <StyleButtons
              bold={selectedObject.style.bold}
              italic={selectedObject.style.italic}
              underline={selectedObject.style.underline}
              onBold={() => updateObject(selectedObject.id, { style: { ...selectedObject.style, bold: !selectedObject.style.bold } }, false)}
              onItalic={() => updateObject(selectedObject.id, { style: { ...selectedObject.style, italic: !selectedObject.style.italic } }, false)}
              onUnderline={() => updateObject(selectedObject.id, { style: { ...selectedObject.style, underline: !selectedObject.style.underline } }, false)}
            />
          </>
        )}
        {(selectedObject.type === "drawing" || selectedObject.type === "highlight") && (
          <>
            <ColorInput value={selectedObject.style.color} onChange={(color) => updateObject(selectedObject.id, { style: { ...selectedObject.style, color } }, false)} />
            {selectedObject.type === "drawing" ? (
              <NumberInput label="Width" value={selectedObject.style.width} min={0.25} max={50} step={0.25} onChange={(widthValue) => updateObject(selectedObject.id, { style: { ...selectedObject.style, width: widthValue || 1 } }, false)} />
            ) : (
              <RangeInput label="Opacity" value={selectedObject.opacity} min={0.05} max={0.8} step={0.05} onChange={(opacity) => updateObject(selectedObject.id, { opacity }, false)} />
            )}
          </>
        )}
        {(selectedObject.type === "image" || selectedObject.type === "signature") && (
          <RangeInput label="Opacity" value={selectedObject.opacity} min={0.1} max={1} step={0.05} onChange={(opacity) => updateObject(selectedObject.id, { opacity }, false)} />
        )}
        {selectedObject.type === "erase" && (
          <div className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700">Selected area will be erased on export.</div>
        )}
        <Button variant="destructive" size="sm" className="ml-auto" onClick={deleteSelectedObject}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    );
  }

  if (activeTool === "draw" || activeTool === "highlight") {
    return (
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-emerald-900/10 bg-emerald-50 px-3 py-2 text-sm shadow-sm">
        <QuickTitle label={activeTool === "draw" ? "Draw settings" : "Highlight settings"} />
        <ColorInput
          value={activeTool === "draw" ? drawingStyle.color : highlightStyle.color}
          onChange={(color) => activeTool === "draw" ? setDrawingStyle({ color }) : setHighlightStyle({ color })}
        />
        {activeTool === "draw" ? (
          <RangeInput label="Width" value={drawingStyle.width} min={0.5} max={20} step={0.5} onChange={(width) => setDrawingStyle({ width })} />
        ) : (
          <RangeInput label="Opacity" value={highlightStyle.opacity} min={0.05} max={0.8} step={0.05} onChange={(opacity) => setHighlightStyle({ opacity })} />
        )}
      </div>
    );
  }

  return null;
}

function QuickTitle({ label }: { label: string }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-xs font-semibold uppercase tracking-wide text-white">
      <SlidersHorizontal className="h-4 w-4" />
      {label}
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2">
      <span className="text-xs font-medium text-emerald-800">{label}</span>
      <input
        className="w-14 bg-transparent text-sm text-slate-950 outline-none"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-white px-2">
      <span className="text-xs font-medium text-emerald-800">Color</span>
      <input className="h-6 w-8 rounded border border-emerald-200 bg-white p-0.5" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex h-9 min-w-48 items-center gap-2 rounded-md border border-emerald-200 bg-white px-2">
      <span className="text-xs font-medium text-emerald-800">{label}</span>
      <input className="accent-emerald-700" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="w-9 text-right text-xs text-slate-600">{Number(value).toFixed(step < 0.1 ? 2 : 1)}</span>
    </label>
  );
}

function ReadonlyValue({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-white px-2 text-xs ${wide ? "max-w-48" : ""}`}>
      <span className="font-medium text-emerald-800">{label}</span>
      <span className="truncate text-slate-700">{value}</span>
    </div>
  );
}

function StyleButtons({
  bold,
  italic,
  underline,
  onBold,
  onItalic,
  onUnderline,
}: {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
}) {
  const className = "border-emerald-200";
  return (
    <div className="flex items-center gap-1">
      <Button variant={bold ? "default" : "outline"} size="icon" className={className} onClick={onBold} title="Bold">
        <Bold className="h-4 w-4" />
      </Button>
      <Button variant={italic ? "default" : "outline"} size="icon" className={className} onClick={onItalic} title="Italic">
        <Italic className="h-4 w-4" />
      </Button>
      <Button variant={underline ? "default" : "outline"} size="icon" className={className} onClick={onUnderline} title="Underline">
        <Underline className="h-4 w-4" />
      </Button>
    </div>
  );
}
