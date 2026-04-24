"use client";

import { Loader2 } from "lucide-react";

export default function ApiLoadingState({
  message = "Loading data...",
  compact = false,
}: {
  message?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
          : "flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm"
      }
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
}
