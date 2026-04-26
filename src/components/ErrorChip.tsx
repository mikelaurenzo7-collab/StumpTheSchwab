"use client";

import { friendlyError } from "@/lib/aiError";

export function ErrorChip({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  const { title, hint } = friendlyError(message);
  return (
    <div
      role="alert"
      className={`rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 ${className}`}
    >
      <p className="text-[10px] font-semibold text-red-300">⚠ {title}</p>
      <p className="mt-0.5 text-[9px] text-red-200/80">{hint}</p>
    </div>
  );
}
