"use client";

import type { ReactNode } from "react";
import { Bold, Check, FileText, Info, Italic, Trash2, Underline, X, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { defaultTextStyle, useEditorStore } from "@/store/editorStore";
import type { PdfDocumentMetadata } from "@/types/pdf";

interface RightPropertiesPanelProps {
  document: PdfDocumentMetadata | null;
  zoom: number;
}

export function RightPropertiesPanel({ document, zoom }: RightPropertiesPanelProps) {
  const selectedSpan = useEditorStore((state) => state.selectedSpan);
  const selectedObject = useEditorStore((state) =>
    state.addedObjects.find((object) => object.id === state.selectedObjectId),
  );
  const activeTool = useEditorStore((state) => state.activeTool);
  const drawingStyle = useEditorStore((state) => state.drawingStyle);
  const highlightStyle = useEditorStore((state) => state.highlightStyle);
  const editingValue = useEditorStore((state) => state.editingValue);
  const editingStyle = useEditorStore((state) => state.editingStyle);
  const updateEditingValue = useEditorStore((state) => state.updateEditingValue);
  const updateSelectedStyle = useEditorStore((state) => state.updateSelectedStyle);
  const applySelectedEdit = useEditorStore((state) => state.applySelectedEdit);
  const cancelSelectedEdit = useEditorStore((state) => state.cancelSelectedEdit);
  const deleteSelectedSpan = useEditorStore((state) => state.deleteSelectedSpan);
  const updateObject = useEditorStore((state) => state.updateObject);
  const deleteSelectedObject = useEditorStore((state) => state.deleteSelectedObject);
  const setDrawingStyle = useEditorStore((state) => state.setDrawingStyle);
  const setHighlightStyle = useEditorStore((state) => state.setHighlightStyle);

  if (selectedObject) {
    const [x0, y0, x1, y1] = selectedObject.bbox;
    const updateRect = (field: "x" | "y" | "width" | "height", raw: string) => {
      const value = Number(raw);
      if (!Number.isFinite(value)) return;
      const width = x1 - x0;
      const height = y1 - y0;
      const bbox: [number, number, number, number] =
        field === "x" ? [value, y0, value + width, y1]
          : field === "y" ? [x0, value, x1, value + height]
            : field === "width" ? [x0, y0, x0 + Math.max(2, value), y1]
              : [x0, y0, x1, y0 + Math.max(2, value)];
      updateObject(selectedObject.id, { bbox });
    };

    return (
      <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[46vh] overflow-y-auto border-t border-border bg-white p-4 shadow-xl xl:static xl:block xl:h-full xl:w-72 xl:flex-none xl:border-l xl:border-t-0 xl:shadow-none">
        <div className="mb-4 text-sm font-semibold text-emerald-950">
          {selectedObject.type.charAt(0).toUpperCase() + selectedObject.type.slice(1)} Properties
        </div>
        <div className="space-y-4 text-sm">
          {selectedObject.type === "text" && (
            <>
              <PanelSectionTitle>Content</PanelSectionTitle>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Text</span>
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border border-border px-2 py-1 outline-none focus:ring-2 focus:ring-ring"
                  value={selectedObject.text ?? ""}
                  onChange={(event) => updateObject(selectedObject.id, { text: event.target.value })}
                />
              </label>
              <PanelSectionTitle>Style</PanelSectionTitle>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Font family</span>
                <select
                  className="h-9 w-full rounded-md border border-border bg-white px-2"
                  value={selectedObject.style.font}
                  onChange={(event) => updateObject(selectedObject.id, { style: { ...selectedObject.style, font: event.target.value } })}
                >
                  <option>Helvetica</option>
                  <option>Times Roman</option>
                  <option>Courier</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs text-muted-foreground">Font size</span>
                  <input className="h-9 w-full rounded-md border px-2" type="number" min={6} max={300} value={selectedObject.style.size} onChange={(event) => updateObject(selectedObject.id, { style: { ...selectedObject.style, size: Number(event.target.value) || 6 } })} />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-muted-foreground">Color</span>
                  <input className="h-9 w-full rounded-md border bg-white p-1" type="color" value={selectedObject.style.color} onChange={(event) => updateObject(selectedObject.id, { style: { ...selectedObject.style, color: event.target.value } })} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant={selectedObject.style.bold ? "default" : "outline"} size="icon" onClick={() => updateObject(selectedObject.id, { style: { ...selectedObject.style, bold: !selectedObject.style.bold } })}><Bold className="h-4 w-4" /></Button>
                <Button variant={selectedObject.style.italic ? "default" : "outline"} size="icon" onClick={() => updateObject(selectedObject.id, { style: { ...selectedObject.style, italic: !selectedObject.style.italic } })}><Italic className="h-4 w-4" /></Button>
                <Button variant={selectedObject.style.underline ? "default" : "outline"} size="icon" onClick={() => updateObject(selectedObject.id, { style: { ...selectedObject.style, underline: !selectedObject.style.underline } })}><Underline className="h-4 w-4" /></Button>
              </div>
            </>
          )}
          {(selectedObject.type === "drawing" || selectedObject.type === "highlight") && (
            <>
            <PanelSectionTitle>Style</PanelSectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-xs text-muted-foreground">Color</span>
                <input className="h-9 w-full rounded-md border bg-white p-1" type="color" value={selectedObject.style.color} onChange={(event) => updateObject(selectedObject.id, { style: { ...selectedObject.style, color: event.target.value } })} />
              </label>
              {selectedObject.type === "drawing" ? (
                <label>
                  <span className="mb-1 block text-xs text-muted-foreground">Width</span>
                  <input className="h-9 w-full rounded-md border px-2" type="number" min={0.25} max={50} step={0.25} value={selectedObject.style.width} onChange={(event) => updateObject(selectedObject.id, { style: { ...selectedObject.style, width: Number(event.target.value) || 1 } })} />
                </label>
              ) : (
                <label>
                  <span className="mb-1 block text-xs text-muted-foreground">Opacity</span>
                  <input className="w-full" type="range" min={0.05} max={0.8} step={0.05} value={selectedObject.opacity} onChange={(event) => updateObject(selectedObject.id, { opacity: Number(event.target.value) })} />
                </label>
              )}
            </div>
            </>
          )}
          {(selectedObject.type === "image" || selectedObject.type === "signature") && (
            <>
            <PanelSectionTitle>Style</PanelSectionTitle>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Opacity</span>
              <input className="w-full" type="range" min={0.1} max={1} step={0.05} value={selectedObject.opacity} onChange={(event) => updateObject(selectedObject.id, { opacity: Number(event.target.value) })} />
            </label>
            </>
          )}
          {selectedObject.type === "erase" && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              This area will be erased cleanly when you apply changes.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(["x", "y", "width", "height"] as const).map((field) => (
              <label key={field}>
                <span className="mb-1 block text-xs capitalize text-muted-foreground">{field}</span>
                <input
                  className="h-9 w-full rounded-md border px-2"
                  type="number"
                  value={Math.round(field === "x" ? x0 : field === "y" ? y0 : field === "width" ? x1 - x0 : y1 - y0)}
                  onChange={(event) => updateRect(field, event.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="sticky bottom-0 border-t border-border bg-white pt-3">
            <PanelSectionTitle>Actions</PanelSectionTitle>
            <Button variant="destructive" className="w-full" onClick={deleteSelectedObject}><Trash2 className="h-4 w-4" />Delete object</Button>
          </div>
        </div>
      </aside>
    );
  }

  if (selectedSpan) {
    const style = editingStyle ?? defaultTextStyle(selectedSpan);
    const [x0, y0, x1, y1] = selectedSpan.bbox;

    return (
      <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[46vh] overflow-y-auto border-t border-border bg-white p-4 shadow-xl xl:static xl:block xl:h-full xl:w-72 xl:flex-none xl:border-l xl:border-t-0 xl:shadow-none">
        <div className="mb-4 text-sm font-semibold text-emerald-950">Text Properties</div>
        <div className="space-y-4 text-sm">
          <PanelSectionTitle>Content</PanelSectionTitle>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Text</span>
            <textarea
              className="min-h-20 w-full resize-none rounded-md border border-border px-2 py-1 outline-none focus:ring-2 focus:ring-ring"
              value={editingValue}
              onChange={(event) => updateEditingValue(event.target.value)}
            />
          </label>
          <PanelSectionTitle>Style</PanelSectionTitle>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Font family</div>
            <div className="mt-1 break-words font-medium">{style.font}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Font size</span>
              <input
                className="h-9 w-full rounded-md border border-border px-2 outline-none focus:ring-2 focus:ring-ring"
                type="number"
                min={6}
                max={96}
                value={Math.round(style.size)}
                onChange={(event) => updateSelectedStyle({ size: Number(event.target.value) || style.size })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Color</span>
              <input
                className="h-9 w-full rounded-md border border-border bg-white p-1"
                type="color"
                value={style.color}
                onChange={(event) => updateSelectedStyle({ color: event.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant={style.bold ? "default" : "outline"} size="icon" onClick={() => updateSelectedStyle({ bold: !style.bold })}>
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant={style.italic ? "default" : "outline"} size="icon" onClick={() => updateSelectedStyle({ italic: !style.italic })}>
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant={style.underline ? "default" : "outline"}
              size="icon"
              onClick={() => updateSelectedStyle({ underline: !style.underline })}
            >
              <Underline className="h-4 w-4" />
            </Button>
          </div>
          <PanelSectionTitle>Position</PanelSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">X</div>
              <div className="mt-1 font-medium">{Math.round(x0)}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Y</div>
              <div className="mt-1 font-medium">{Math.round(y0)}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Width</div>
              <div className="mt-1 font-medium">{Math.round(x1 - x0)}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Height</div>
              <div className="mt-1 font-medium">{Math.round(y1 - y0)}</div>
            </div>
          </div>
          <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-border bg-white pt-4">
            <div className="col-span-3"><PanelSectionTitle>Actions</PanelSectionTitle></div>
            <Button variant="destructive" size="sm" onClick={deleteSelectedSpan} title="Delete selected text">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button variant="outline" size="sm" onClick={cancelSelectedEdit} title="Cancel selected edit">
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button size="sm" onClick={applySelectedEdit} title="Apply selected edit">
              <Check className="h-4 w-4" />
              Apply
            </Button>
          </div>
        </div>
      </aside>
    );
  }

  if (activeTool === "draw" || activeTool === "highlight") {
    return (
      <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[35vh] overflow-y-auto border-t border-border bg-white p-4 shadow-xl xl:static xl:block xl:h-full xl:w-72 xl:flex-none xl:border-l xl:border-t-0 xl:shadow-none">
        <div className="mb-4 text-sm font-semibold">{activeTool === "draw" ? "Drawing" : "Highlight"} Settings</div>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Color</span>
            <input
              className="h-10 w-full rounded-md border bg-white p-1"
              type="color"
              value={activeTool === "draw" ? drawingStyle.color : highlightStyle.color}
              onChange={(event) => activeTool === "draw" ? setDrawingStyle({ color: event.target.value }) : setHighlightStyle({ color: event.target.value })}
            />
          </label>
          {activeTool === "draw" ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Stroke width</span>
              <input className="w-full" type="range" min={0.5} max={20} step={0.5} value={drawingStyle.width} onChange={(event) => setDrawingStyle({ width: Number(event.target.value) })} />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Opacity</span>
              <input className="w-full" type="range" min={0.05} max={0.8} step={0.05} value={highlightStyle.opacity} onChange={(event) => setHighlightStyle({ opacity: Number(event.target.value) })} />
            </label>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden h-full w-72 flex-none border-l border-border bg-white p-4 xl:block">
      <div className="mb-4 text-sm font-semibold">Properties</div>
      <div className="space-y-4 text-sm">
        <div className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>File</span>
          </div>
          <div className="break-words font-medium">{document?.file_name || "No PDF uploaded"}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Pages</div>
            <div className="mt-1 text-lg font-semibold">{document?.page_count ?? "-"}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ZoomIn className="h-3.5 w-3.5" />
              Zoom
            </div>
            <div className="mt-1 text-lg font-semibold">{Math.round(zoom * 100)}%</div>
          </div>
        </div>
        <div className="rounded-md border border-border bg-neutral-50 p-3 text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Info className="h-4 w-4" />
            Instruction
          </div>
          Upload a PDF to start editing.
        </div>
      </div>
    </aside>
  );
}

function PanelSectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/70">{children}</div>;
}
