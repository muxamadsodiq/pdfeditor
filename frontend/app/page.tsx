"use client";

import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Download, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorMessage } from "@/components/editor/ErrorMessage";
import { LoadingOverlay } from "@/components/editor/LoadingOverlay";
import { PdfWorkspace } from "@/components/editor/PdfWorkspace";
import { QuickPropertiesBar } from "@/components/editor/QuickPropertiesBar";
import { SignatureModal } from "@/components/editor/SignatureModal";
import { TopToolbar } from "@/components/editor/TopToolbar";
import { UploadScreen } from "@/components/editor/UploadScreen";
import { Button } from "@/components/ui/button";
import { applyPdfEdits, fetchPdfMetadata, pdfDownloadUrl, uploadPdf } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";

const queryClient = new QueryClient();
const SCANNED_PDF_MESSAGE = "This PDF looks scanned or image-based. Existing text cannot be selected yet.";

export default function HomePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <EditorApp />
    </QueryClientProvider>
  );
}

function EditorApp() {
  const {
    document,
    zoom,
    activePage,
    error,
    textLayer,
    editMode,
    activeTool,
    selectedSpan,
    unsavedChanges,
    selectedObjectId,
    downloadUrl,
    setDocument,
    setUploading,
    setError,
    setEditMode,
    setActiveTool,
    setPendingImage,
    selectObject,
    cancelSelectedEdit,
    deleteSelectedSpan,
    deleteSelectedObject,
    undo,
    redo,
    zoomIn,
    zoomOut,
    fitPage,
    setActivePage,
    markEditsApplied,
  } = useEditorStore();
  const [notice, setNotice] = useState<{ kind: "success" | "warning"; message: string } | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [downloadPageOpen, setDownloadPageOpen] = useState(false);
  const [downloadCompleteOpen, setDownloadCompleteOpen] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("");

  const hasScannedWarning = Boolean(textLayer?.warnings.some((warning) => warning === SCANNED_PDF_MESSAGE));
  const hasTextSpans = Boolean(textLayer?.pages.some((page) => page.text_spans.length > 0));
  const canEditText = Boolean(document && textLayer && hasTextSpans && !hasScannedWarning);
  const editTextDisabledMessage = hasScannedWarning
    ? SCANNED_PDF_MESSAGE
    : document
      ? "Text selection is still being prepared for this PDF."
      : "Upload a digital PDF to edit text.";
  const toolHint = {
    add_text: "Click the PDF where you want to add text.",
    add_image: "Click the PDF to place the selected image.",
    draw: "Drag on the PDF to draw.",
    highlight: "Drag across an area to highlight it.",
    signature: "Click the PDF to place your signature.",
    erase_area: "Drag over the area you want to remove.",
    select: "Select an added object to move, resize, or edit it.",
    edit_text: "Click existing PDF text to edit it.",
  }[activeTool];

  const uploadMutation = useMutation({
    mutationFn: uploadPdf,
    onMutate: () => {
      setNotice(null);
      setDownloadPageOpen(false);
      setDownloadCompleteOpen(false);
      setUploading(true);
      setError(null);
    },
    onSuccess: (metadata) => {
      setDocument(metadata);
      setDownloadFileName(defaultEditedFileName(metadata.file_name));
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      const state = useEditorStore.getState();
      if (!state.document) throw new Error("Upload a PDF before applying changes.");
      return applyPdfEdits(state.document.document_id, [...state.editOperations, ...state.objectOperations], state.pageOperations);
    },
    onMutate: () => {
      setError(null);
      setNotice(null);
      setDownloadPageOpen(false);
    },
    onSuccess: (response) => {
      markEditsApplied(response.download_url);
      const state = useEditorStore.getState();
      if (state.document) setDownloadFileName(defaultEditedFileName(state.document.file_name));
      setDownloadPageOpen(true);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not save changes. Please try again.");
    },
  });

  useEffect(() => {
    const documentId = new URLSearchParams(window.location.search).get("document_id");
    if (!documentId || document?.document_id === documentId) return;

    let cancelled = false;
    setUploading(true);
    setError(null);

    fetchPdfMetadata(documentId)
      .then((metadata) => {
        if (!cancelled) {
          setDocument(metadata);
          setDownloadFileName(defaultEditedFileName(metadata.file_name));
          setDownloadPageOpen(false);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open this PDF.");
      })
      .finally(() => {
        if (!cancelled) setUploading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [document?.document_id, setDocument, setError, setUploading]);

  function handleUpload(file: File) {
    setDownloadPageOpen(false);
    setDownloadCompleteOpen(false);
    uploadMutation.mutate(file);
  }

  function readImage(file: File, type: "image" | "signature" = "image") {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG, and WebP images are supported.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be smaller than 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingImage(reader.result, type);
        setSignatureOpen(false);
        setError(null);
        setNotice({ kind: "success", message: "Click the PDF to place the image." });
      }
    };
    reader.onerror = () => setError("Image could not be opened.");
    reader.readAsDataURL(file);
  }

  async function handleDownload() {
    if (!document) return;
    if (unsavedChanges) {
      setNotice(null);
      setError("Apply changes first to download the edited PDF.");
      return;
    }
    setError(null);
    try {
      const filename = normalizePdfFileName(downloadFileName || defaultEditedFileName(document.file_name));
      const response = await fetch(pdfDownloadUrl(document.document_id, downloadUrl, filename));
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = globalThis.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      globalThis.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Could not download this PDF. Please try again.");
    }
  }

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      return Boolean(element?.closest("input, textarea, [contenteditable='true']"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (event.key === "Escape") {
        cancelSelectedEdit();
        selectObject(null);
        setActiveTool("select");
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !isTypingTarget(event.target)) {
        if (!selectedSpan && !selectedObjectId) return;
        event.preventDefault();
        if (selectedObjectId) deleteSelectedObject();
        else deleteSelectedSpan();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelSelectedEdit, deleteSelectedObject, deleteSelectedSpan, redo, selectObject, selectedObjectId, selectedSpan, setActiveTool, undo]);

  function handleSelectPage(page: number) {
    setActivePage(page);
    window.requestAnimationFrame(() => {
      document?.pages && globalThis.document.getElementById(`pdf-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleApplyChanges() {
    const state = useEditorStore.getState();
    if (state.selectedSpan) {
      state.applySelectedEdit();
    }
    applyMutation.mutate();
  }

  function handleSelectTool(tool: typeof activeTool) {
    setNotice(null);
    setError(null);
    setActiveTool(tool);
  }

  function handleBackToEditor() {
    setDownloadPageOpen(false);
    setDownloadCompleteOpen(false);
    setNotice(null);
  }

  function handleBackToMainMenu() {
    setDownloadCompleteOpen(false);
    setDownloadPageOpen(false);
    setNotice(null);
    setError(null);
    setDocument(null);
  }

  const liveState = useEditorStore.getState();
  const hasPendingInlineEdit = Boolean(liveState.selectedSpan);
  const hasOperations =
    liveState.editOperations.length + liveState.objectOperations.length + liveState.pageOperations.length > 0 || hasPendingInlineEdit;
  const toolbarUnsaved = unsavedChanges || hasPendingInlineEdit;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <>
          {document && (
            <TopToolbar
              zoom={zoom}
              onUpload={handleUpload}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onFitPage={fitPage}
              activeTool={activeTool}
              canEditText={canEditText}
              editTextDisabledMessage={editTextDisabledMessage}
              canDownload={Boolean(document)}
              onToggleEditMode={() => setEditMode(!editMode)}
              onSelectTool={handleSelectTool}
              onImageSelected={(file) => readImage(file)}
              onOpenSignature={() => setSignatureOpen(true)}
              onHome={handleBackToMainMenu}
            />
          )}
          {document && <QuickPropertiesBar />}
          {document && (
            <div className="flex-none border-b border-border bg-white px-3 py-1.5 text-center text-xs text-muted-foreground">
              {toolHint}
            </div>
          )}
          <div className="relative flex min-h-0 flex-1">
            {uploadMutation.isPending && <LoadingOverlay label="Uploading and preparing PDF..." />}
            <div className="relative min-w-0 flex-1">
              {!document ? (
                <>
                  <UploadScreen onUpload={handleUpload} />
                  {error && <div className="absolute left-1/2 top-8 w-full max-w-md -translate-x-1/2 px-4"><ErrorMessage message={error} /></div>}
                </>
              ) : (
                <>
                  {error && <div className="absolute left-1/2 top-4 z-20 w-full max-w-md -translate-x-1/2 px-4"><ErrorMessage message={error} /></div>}
                  {notice && (
                    <div
                      className={`absolute left-1/2 top-4 z-20 flex w-full max-w-md -translate-x-1/2 items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-sm ${
                        notice.kind === "success"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-amber-300 bg-amber-50 text-amber-900"
                      }`}
                    >
                      {notice.kind === "success" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                      ) : (
                        <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
                      )}
                      <span>{notice.message}</span>
                    </div>
                  )}
                  <PdfWorkspace document={document} zoom={zoom} onActivePageChange={setActivePage} />
                </>
              )}
            </div>
          </div>
        </>
      {document && !downloadPageOpen && !downloadCompleteOpen && (
        <BottomApplyBar
          hasChanges={toolbarUnsaved}
          canApply={hasOperations}
          isApplying={applyMutation.isPending}
          onApply={handleApplyChanges}
        />
      )}
      <SignatureModal
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onConfirm={(dataUrl) => {
          setPendingImage(dataUrl, "signature");
          setSignatureOpen(false);
          setNotice({ kind: "success", message: "Click the PDF to place the signature." });
        }}
        onUpload={(file) => readImage(file, "signature")}
      />
      {applyMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25">
          <div className="rounded-lg border border-emerald-200 bg-white px-5 py-4 text-sm font-medium text-emerald-950 shadow-xl">
            Saving changes...
          </div>
        </div>
      )}
      {downloadPageOpen && document && downloadUrl && (
        <SaveResultModal
          fileName={downloadFileName}
          onFileNameChange={setDownloadFileName}
          onDownload={handleDownload}
          onContinueEditing={handleBackToEditor}
          onHome={handleBackToMainMenu}
        />
      )}
    </div>
  );
}

function BottomApplyBar({
  hasChanges,
  canApply,
  isApplying,
  onApply,
}: {
  hasChanges: boolean;
  canApply: boolean;
  isApplying: boolean;
  onApply: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center bg-amber-50/95 px-4 py-4 shadow-[0_-1px_0_rgba(15,23,42,0.08)]">
      <div className="pointer-events-auto rounded-t-2xl bg-amber-100 px-5 py-4 shadow-sm">
        <Button
          className="h-12 min-w-[230px] rounded-md bg-emerald-500 px-7 text-lg font-bold text-white hover:bg-emerald-600 disabled:bg-slate-300 disabled:text-slate-500"
          disabled={!hasChanges || !canApply || isApplying}
          onClick={onApply}
        >
          {isApplying ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isApplying ? "Applying changes..." : "Apply changes"}
          {!isApplying && <ArrowRight className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}

function SaveResultModal({
  fileName,
  onFileNameChange,
  onDownload,
  onContinueEditing,
  onHome,
}: {
  fileName: string;
  onFileNameChange: (fileName: string) => void;
  onDownload: () => void;
  onContinueEditing: () => void;
  onHome: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white px-4 py-10">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl md:grid-cols-[1fr_320px]">
          <div className="bg-slate-50 px-6 py-8 text-center md:px-14 md:py-12">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-950">Your document is ready</h1>
            <p className="mt-2 text-base text-slate-500">Changes saved. Choose a filename and download your edited PDF.</p>

            <div className="mx-auto mt-8 max-w-xl rounded-lg border border-slate-200 bg-white px-5 py-4">
              <label className="block text-left text-sm font-medium text-slate-700" htmlFor="download-file-name">
                File name
              </label>
              <input
                id="download-file-name"
                aria-label="Download filename"
                value={fileName}
                onChange={(event) => onFileNameChange(event.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="edited.pdf"
                autoFocus
              />
            </div>

            <Button className="mx-auto mt-7 flex h-16 min-w-[300px] rounded-md bg-emerald-500 px-9 text-2xl font-bold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600" onClick={onDownload}>
              <Download className="h-7 w-7" />
              Download
            </Button>
            <Button
              variant="ghost"
              className="mx-auto mt-4 flex h-12 min-w-[300px] rounded-md bg-emerald-50 text-lg font-semibold text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
              onClick={onHome}
            >
              Home page
            </Button>
          </div>

          <aside className="border-t border-slate-200 bg-white p-7 md:border-l md:border-t-0">
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-slate-400">Continue editing this document</h2>
            <button
              type="button"
              className="flex h-12 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-4 text-left text-lg font-semibold text-slate-900 hover:bg-emerald-50"
              onClick={onContinueEditing}
            >
              Edit
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </button>
            <button
              type="button"
              className="mt-4 flex h-12 w-full items-center justify-center rounded-md bg-emerald-50 text-lg font-semibold text-emerald-600 hover:bg-emerald-100"
              onClick={onContinueEditing}
            >
              Back to editing
            </button>
          </aside>
        </section>
      </div>
    </div>
  );
}

function defaultEditedFileName(fileName: string): string {
  const trimmed = fileName.trim() || "edited.pdf";
  return normalizePdfFileName(trimmed.replace(/\.pdf$/i, "") + "-edited.pdf");
}

function normalizePdfFileName(fileName: string): string {
  const cleanName = fileName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  const fallback = cleanName || "edited.pdf";
  return fallback.toLowerCase().endsWith(".pdf") ? fallback : `${fallback}.pdf`;
}
