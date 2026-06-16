import { Loader2 } from "lucide-react";

export function LoadingOverlay({ label = "Loading PDF..." }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/75 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-md border border-border bg-white px-4 py-3 text-sm shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>{label}</span>
      </div>
    </div>
  );
}
