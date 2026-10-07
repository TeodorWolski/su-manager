"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Dłuższy tekst do skopiowania jednym tapem (np. raport do wklejenia w Claude). */
export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }}
        className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[17px] font-semibold active:scale-[0.98]"
      >
        {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
        {copied ? "Skopiowane — wklej w Claude" : "Kopiuj raport"}
      </button>
      <pre className="bg-card border-border max-h-[60vh] overflow-auto rounded-[14px] border p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}
