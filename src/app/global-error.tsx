"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/analytics";
import "./globals.css";

/** Ostatnia deska ratunku: błąd w samym layoucie. Zastępuje cały dokument, stąd własne <html> i style. */
export default function GlobalError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <html lang="pl">
      <body className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">Coś się wysypało</h1>
        <p className="text-muted-foreground text-[15px]">Nie udało się załadować apki. Spróbuj jeszcze raz.</p>
        <button type="button" onClick={reset} className="bg-primary text-primary-foreground mt-2 rounded-full px-5 py-2.5 text-[15px] font-medium">
          Spróbuj ponownie
        </button>
      </body>
    </html>
  );
}
