"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Kod do skopiowania (skrót iOS, bookmarklet). */
export function CopyBox({ text, label = "Kopiuj" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-muted rounded-xl p-2">
      <pre className="max-h-28 overflow-auto px-1 py-1 text-[12px] leading-snug break-all whitespace-pre-wrap select-all">{text}</pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="bg-primary text-primary-foreground mt-1.5 flex h-9 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium active:scale-95"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Skopiowano" : label}
      </button>
    </div>
  );
}
