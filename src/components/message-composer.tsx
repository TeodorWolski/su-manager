"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { CHANNEL_SHORT, MESSAGE_CHANNELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PendingButton } from "./form";

/**
 * Gotowa wiadomość do skopiowania + „Wysłałem przez IG / FB / Fanpage”.
 * Kanał, którym już pisałem, jest odhaczony; podpowiadany (`next`) — wyróżniony.
 */
export function MessageComposer({
  message,
  action,
  hidden = {},
  used = [],
  next,
  children,
}: {
  message: string;
  action: (fd: FormData) => Promise<void>;
  hidden?: Record<string, string | number | null | undefined>;
  used?: string[];
  next?: string | null;
  /** Dodatkowe pola nad wiadomością (np. wybór supportu). */
  children?: React.ReactNode;
}) {
  const [text, setText] = useState(message);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-2">
      {Object.entries(hidden).map(([k, v]) => v != null && <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(5, Math.max(2, Math.ceil(text.length / 38)))}
        className="bg-card w-full resize-none rounded-lg px-3 py-2 text-[15px] leading-snug outline-none"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="bg-primary text-primary-foreground flex h-9 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium active:scale-95"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Skopiowano" : "Kopiuj"}
        </button>
        <span className="text-muted-foreground ml-1 text-[13px]">Wysłałem:</span>
        {MESSAGE_CHANNELS.map((c) => (
          <PendingButton
            key={c}
            name="channel"
            value={c}
            className={cn(
              "flex h-9 items-center gap-1 rounded-lg px-2.5 text-[14px] font-medium active:scale-95",
              c === next ? "bg-primary/14 text-primary ring-primary/40 ring-1" : "bg-secondary text-secondary-foreground",
              used.includes(c) && "text-muted-foreground",
            )}
          >
            {used.includes(c) && <Check className="size-3.5" />}
            {CHANNEL_SHORT[c] ?? c}
          </PendingButton>
        ))}
      </div>
    </form>
  );
}
