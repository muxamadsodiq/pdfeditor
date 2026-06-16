"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Eraser, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
  onUpload: (file: File) => void;
}

export function SignatureModal({ open, onClose, onConfirm, onUpload }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#111827";
    setHasInk(false);
  }, [open]);

  if (!open) return null;

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const current = point(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(current.x, current.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
    setHasInk(true);
  }

  function stop() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    event.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-md bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Add signature</h2>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close"><X className="h-4 w-4" /></Button>
        </div>
        <canvas
          ref={canvasRef}
          width={900}
          height={280}
          className="h-48 w-full touch-none rounded-md border border-border bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clear}><Eraser className="h-4 w-4" />Clear</Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-neutral-50">
              <Upload className="h-4 w-4" />Upload
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
            </label>
          </div>
          <Button disabled={!hasInk} onClick={() => {
            const dataUrl = canvasRef.current?.toDataURL("image/png");
            if (dataUrl) onConfirm(dataUrl);
          }}>Use signature</Button>
        </div>
      </div>
    </div>
  );
}
