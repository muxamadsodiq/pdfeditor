"use client";

import { ChangeEvent, useRef } from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";

interface UploadScreenProps {
  onUpload: (file: File) => void;
}

export function UploadScreen({ onUpload }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    event.target.value = "";
  }

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-md rounded-md border border-dashed border-border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileUp className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Open a PDF</h1>
        <p className="mt-2 text-sm text-muted-foreground">Upload a PDF to start editing.</p>
        <Button className="mt-6" onClick={() => inputRef.current?.click()}>
          <FileUp className="h-4 w-4" />
          Upload PDF
        </Button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleChange} />
      </div>
    </div>
  );
}
