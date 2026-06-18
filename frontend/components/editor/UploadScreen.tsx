"use client";

import { ChangeEvent, useRef } from "react";
import { FileText, FileUp } from "lucide-react";

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
    <div className="relative flex h-full min-h-[640px] flex-col overflow-hidden bg-white">
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
            <FileText className="h-6 w-6" />
          </div>
          <span className="text-2xl font-semibold text-emerald-600">Yusuf PDF</span>
        </div>
        <nav className="hidden items-center gap-8 text-base font-medium text-slate-950 md:flex">
          <span>Edit Text</span>
          <span>Add Text</span>
          <span>Images</span>
          <span>Sign</span>
          <span>Whiteout</span>
        </nav>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pt-10 text-center">
        <h1 className="text-4xl font-bold tracking-normal text-slate-900 md:text-5xl">Online PDF editor</h1>
        <p className="mt-4 max-w-3xl text-2xl font-medium text-slate-400 md:text-3xl">
          Edit PDF files online. Add text, images, signatures and clean areas.
        </p>

        <div className="mt-14">
          <Button
            className="h-16 rounded-md bg-emerald-500 px-9 text-xl font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600"
            onClick={() => inputRef.current?.click()}
          >
            <FileUp className="h-7 w-7" />
            Upload PDF file
          </Button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleChange} />
        </div>

        <div className="mt-16 space-y-2 text-base text-slate-500">
          <p>
            <span className="font-semibold text-slate-600">Files stay private.</span> Automatically deleted from temporary storage.
          </p>
          <p>No login needed. Upload a PDF and start editing.</p>
        </div>
      </main>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-slate-50" />
      <div className="pointer-events-none absolute inset-x-[-10%] bottom-[26%] h-24 rounded-[50%] bg-white" />
    </div>
  );
}
