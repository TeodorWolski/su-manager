"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Pole z linkiem i przyciskiem „Kopiuj”. */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="text-muted-foreground min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="bg-primary text-primary-foreground flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium active:scale-95"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Skopiowano" : "Kopiuj"}
      </button>
    </div>
  );
}
