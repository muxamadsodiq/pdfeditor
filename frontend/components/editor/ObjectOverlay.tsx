"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  overlayPointToPdfPoint,
  pdfBboxToOverlayRect,
  pdfPointToOverlayPoint,
  type CanvasSize,
  type PdfPageGeometry,
} from "@/lib/coordinates";
import { useEditorStore, type AddedObject, type PdfPoint, type PdfRect } from "@/store/editorStore";

interface ObjectOverlayProps {
  pageNumber: number;
  geometry: PdfPageGeometry;
  canvasSize: CanvasSize;
}

const DEFAULT_STYLE = {
  font: "Helvetica",
  size: 16,
  color: "#111827",
  bold: false,
  italic: false,
  underline: false,
  width: 2,
};

function clampBbox(bbox: PdfRect, page: PdfPageGeometry): PdfRect {
  const width = bbox[2] - bbox[0];
  const height = bbox[3] - bbox[1];
  const x0 = Math.min(Math.max(0, bbox[0]), Math.max(0, page.width - width));
  const y0 = Math.min(Math.max(0, bbox[1]), Math.max(0, page.height - height));
  return [x0, y0, Math.min(page.width, x0 + width), Math.min(page.height, y0 + height)];
}

function sampleCanvasBackground(canvas: HTMLCanvasElement | null, rect: { left: number; top: number; width: number; height: number }): string {
  if (!canvas) return "#ffffff";
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const bounds = canvas.getBoundingClientRect();
  if (!context || bounds.width === 0 || bounds.height === 0) return "#ffffff";

  const ratioX = canvas.width / bounds.width;
  const ratioY = canvas.height / bounds.height;
  const points = [
    [rect.left - 4, rect.top + rect.height / 2],
    [rect.left + rect.width + 4, rect.top + rect.height / 2],
    [rect.left + rect.width / 2, rect.top - 4],
    [rect.left + rect.width / 2, rect.top + rect.height + 4],
    [rect.left + 3, rect.top + 3],
    [rect.left + rect.width - 3, rect.top + 3],
    [rect.left + 3, rect.top + rect.height - 3],
    [rect.left + rect.width - 3, rect.top + rect.height - 3],
  ];
  const samples: Array<[number, number, number]> = [];
  for (const [cssX, cssY] of points) {
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(cssX * ratioX)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(cssY * ratioY)));
    try {
      const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
      if (alpha > 10) samples.push([red, green, blue]);
    } catch {
      return "#ffffff";
    }
  }
  if (samples.length === 0) return "#ffffff";
  const average = samples.reduce(
    (sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]] as [number, number, number],
    [0, 0, 0],
  );
  return `rgb(${Math.round(average[0] / samples.length)}, ${Math.round(average[1] / samples.length)}, ${Math.round(average[2] / samples.length)})`;
}

function EraseObjectPreview({
  rect,
  selected,
}: {
  rect: { left: number; top: number; width: number; height: number };
  selected: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  useLayoutEffect(() => {
    const canvas = ref.current?.closest(".pdf-page")?.querySelector("canvas") ?? null;
    setBackgroundColor(sampleCanvasBackground(canvas, rect));
  }, [rect.height, rect.left, rect.top, rect.width]);

  return (
    <div
      ref={ref}
      className={selected ? "h-full w-full border border-dashed border-red-500" : "h-full w-full"}
      style={{ backgroundColor }}
    />
  );
}

export function ObjectOverlay({ pageNumber, geometry, canvasSize }: ObjectOverlayProps) {
  const activeTool = useEditorStore((state) => state.activeTool);
  const objects = useEditorStore((state) => state.addedObjects.filter((object) => object.pageNumber === pageNumber));
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const pendingImageData = useEditorStore((state) => state.pendingImageData);
  const pendingImageType = useEditorStore((state) => state.pendingImageType);
  const drawingStyle = useEditorStore((state) => state.drawingStyle);
  const highlightStyle = useEditorStore((state) => state.highlightStyle);
  const addObject = useEditorStore((state) => state.addObject);
  const selectObject = useEditorStore((state) => state.selectObject);
  const updateObject = useEditorStore((state) => state.updateObject);
  const [draftPoints, setDraftPoints] = useState<PdfPoint[]>([]);
  const [draftRect, setDraftRect] = useState<PdfRect | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    kind: "draw" | "highlight" | "erase" | "move" | "resize";
    object?: AddedObject;
    start: PdfPoint;
  } | null>(null);

  const interactive = activeTool !== "edit_text";
  const scale = canvasSize.width / (Math.abs(geometry.rotation) % 180 === 90 ? geometry.height : geometry.width);

  function eventPoint(event: React.PointerEvent): PdfPoint {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds) return [0, 0];
    return overlayPointToPdfPoint(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      geometry,
      canvasSize,
    );
  }

  function beginCanvasGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const point = eventPoint(event);
    selectObject(null);
    if (activeTool === "add_text") {
      addObject({
        type: "text",
        pageNumber,
        bbox: clampBbox([point[0], point[1], point[0] + 170, point[1] + 34], geometry),
        text: "New text",
        style: DEFAULT_STYLE,
        opacity: 1,
      });
      return;
    }
    if ((activeTool === "add_image" || activeTool === "signature") && pendingImageData) {
      addObject({
        type: pendingImageType === "signature" ? "signature" : "image",
        pageNumber,
        bbox: clampBbox([point[0], point[1], point[0] + 150, point[1] + 100], geometry),
        imageData: pendingImageData,
        style: DEFAULT_STYLE,
        opacity: 1,
      });
      return;
    }
    if (activeTool === "draw") {
      gestureRef.current = { kind: "draw", start: point };
      setDraftPoints([point]);
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (activeTool === "highlight" || activeTool === "erase_area") {
      gestureRef.current = { kind: activeTool === "erase_area" ? "erase" : "highlight", start: point };
      setDraftRect([point[0], point[1], point[0], point[1]]);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function continueCanvasGesture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || (gesture.kind !== "draw" && gesture.kind !== "highlight" && gesture.kind !== "erase")) return;
    const point = eventPoint(event);
    if (gesture.kind === "draw") {
      setDraftPoints((points) => [...points, point]);
    } else {
      setDraftRect([
        Math.min(gesture.start[0], point[0]),
        Math.min(gesture.start[1], point[1]),
        Math.max(gesture.start[0], point[0]),
        Math.max(gesture.start[1], point[1]),
      ]);
    }
  }

  function finishCanvasGesture() {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.kind === "draw" && draftPoints.length > 1) {
      const xs = draftPoints.map((point) => point[0]);
      const ys = draftPoints.map((point) => point[1]);
      addObject({
        type: "drawing",
        pageNumber,
        bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        points: draftPoints,
        style: { ...DEFAULT_STYLE, color: drawingStyle.color, width: drawingStyle.width },
        opacity: 1,
      });
    } else if ((gesture.kind === "highlight" || gesture.kind === "erase") && draftRect && draftRect[2] - draftRect[0] > 2 && draftRect[3] - draftRect[1] > 2) {
      const normalizedRect = clampBbox(draftRect, geometry);
      if (gesture.kind === "highlight") {
        addObject({
          type: "highlight",
          pageNumber,
          bbox: normalizedRect,
          style: { ...DEFAULT_STYLE, color: highlightStyle.color },
          opacity: highlightStyle.opacity,
        });
      } else {
        addObject({
          type: "erase",
          pageNumber,
          bbox: normalizedRect,
          style: { ...DEFAULT_STYLE, color: "#ef4444" },
          opacity: 1,
        });
      }
    }
    gestureRef.current = null;
    setDraftPoints([]);
    setDraftRect(null);
  }

  function beginObjectGesture(event: React.PointerEvent, object: AddedObject, kind: "move" | "resize") {
    if (activeTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    selectObject(object.id);
    updateObject(object.id, {}, true);
    gestureRef.current = { kind, object: { ...object, bbox: [...object.bbox] }, start: eventPoint(event) };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function continueObjectGesture(event: React.PointerEvent) {
    const gesture = gestureRef.current;
    if (!gesture?.object || (gesture.kind !== "move" && gesture.kind !== "resize")) return;
    const point = eventPoint(event);
    const dx = point[0] - gesture.start[0];
    const dy = point[1] - gesture.start[1];
    const original = gesture.object;
    if (gesture.kind === "move") {
      const nextBbox = clampBbox(
        [original.bbox[0] + dx, original.bbox[1] + dy, original.bbox[2] + dx, original.bbox[3] + dy],
        geometry,
      );
      const pointDx = nextBbox[0] - original.bbox[0];
      const pointDy = nextBbox[1] - original.bbox[1];
      updateObject(
        original.id,
        {
          bbox: nextBbox,
          points: original.points?.map(([x, y]) => [x + pointDx, y + pointDy]),
        },
        false,
      );
    } else {
      updateObject(
        original.id,
        {
          bbox: [
            original.bbox[0],
            original.bbox[1],
            Math.min(geometry.width, Math.max(original.bbox[0] + 8, original.bbox[2] + dx)),
            Math.min(geometry.height, Math.max(original.bbox[1] + 8, original.bbox[3] + dy)),
          ],
        },
        false,
      );
    }
  }

  function finishObjectGesture(event: React.PointerEvent) {
    const gesture = gestureRef.current;
    if (!gesture?.object || (gesture.kind !== "move" && gesture.kind !== "resize")) return;
    gestureRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  const draftPolyline = useMemo(
    () => draftPoints.map((point) => {
      const overlay = pdfPointToOverlayPoint(point, geometry, canvasSize);
      return `${overlay.x},${overlay.y}`;
    }).join(" "),
    [canvasSize, draftPoints, geometry],
  );

  return (
    <div
      ref={overlayRef}
      className="absolute left-0 top-0 z-20 touch-none"
      style={{ width: canvasSize.width, height: canvasSize.height, pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={beginCanvasGesture}
      onPointerMove={continueCanvasGesture}
      onPointerUp={finishCanvasGesture}
      onPointerCancel={finishCanvasGesture}
    >
      {objects.map((object) => {
        const rect = pdfBboxToOverlayRect(object.bbox, geometry, canvasSize);
        const selected = selectedObjectId === object.id;
        const commonStyle = {
          left: rect.left,
          top: rect.top,
          width: Math.max(2, rect.width),
          height: Math.max(2, rect.height),
        };
        return (
          <div
            key={object.id}
            className={`absolute touch-none ${selected ? "outline outline-2 outline-primary" : activeTool === "select" ? "hover:outline hover:outline-1 hover:outline-primary/60" : ""}`}
            style={commonStyle}
            onPointerDown={(event) => beginObjectGesture(event, object, "move")}
            onPointerMove={continueObjectGesture}
            onPointerUp={finishObjectGesture}
          >
            {object.type === "text" && (
              <div
                className="h-full w-full overflow-hidden whitespace-pre-wrap"
                contentEditable={selected}
                suppressContentEditableWarning
                style={{
                  color: object.style.color,
                  fontFamily: object.style.font,
                  fontSize: object.style.size * scale,
                  fontWeight: object.style.bold ? 700 : 400,
                  fontStyle: object.style.italic ? "italic" : "normal",
                  textDecoration: object.style.underline ? "underline" : "none",
                  lineHeight: 1.08,
                }}
                onPointerDown={(event) => {
                  if (selected) event.stopPropagation();
                }}
                onInput={(event) => updateObject(object.id, { text: event.currentTarget.textContent ?? "" }, false)}
              >
                {object.text}
              </div>
            )}
            {(object.type === "image" || object.type === "signature") && (
              <img src={object.imageData} alt="" draggable={false} className="h-full w-full object-contain" style={{ opacity: object.opacity }} />
            )}
            {object.type === "highlight" && (
              <div className="h-full w-full" style={{ backgroundColor: object.style.color, opacity: object.opacity }} />
            )}
            {object.type === "erase" && (
              <EraseObjectPreview rect={rect} selected={selected} />
            )}
            {object.type === "drawing" && object.points && (
              <svg className="pointer-events-none absolute overflow-visible" style={{ left: -rect.left, top: -rect.top, width: canvasSize.width, height: canvasSize.height }}>
                <polyline
                  fill="none"
                  stroke={object.style.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={object.style.width * scale}
                  points={object.points.map((point) => {
                    const overlay = pdfPointToOverlayPoint(point, geometry, canvasSize);
                    return `${overlay.x},${overlay.y}`;
                  }).join(" ")}
                />
              </svg>
            )}
            {selected && object.type !== "drawing" && (
              <button
                type="button"
                aria-label="Resize object"
                className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm border-2 border-white bg-primary shadow"
                onPointerDown={(event) => beginObjectGesture(event, object, "resize")}
                onPointerMove={continueObjectGesture}
                onPointerUp={finishObjectGesture}
              />
            )}
          </div>
        );
      })}
      {draftRect && (
        <div
          className="pointer-events-none absolute"
          style={{
            ...pdfBboxToOverlayRect(draftRect, geometry, canvasSize),
            backgroundColor: gestureRef.current?.kind === "erase" ? "#ef4444" : highlightStyle.color,
            border: gestureRef.current?.kind === "erase" ? "2px dashed #ef4444" : undefined,
            opacity: gestureRef.current?.kind === "erase" ? 0.18 : highlightStyle.opacity,
          }}
        />
      )}
      {draftPoints.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline fill="none" stroke={drawingStyle.color} strokeWidth={drawingStyle.width * scale} strokeLinecap="round" strokeLinejoin="round" points={draftPolyline} />
        </svg>
      )}
    </div>
  );
}
