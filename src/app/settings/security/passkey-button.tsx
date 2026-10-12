"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Loader2, ScanFace } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { passkeyRegister, passkeyRegisterOptions } from "./actions";

const noop = () => () => {};

/** Nazwa urządzenia z user-agenta — żeby na liście było wiadomo, który passkey jest skąd. */
function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Urządzenie";
}

export function AddPasskey({ prominent }: { prominent?: boolean }) {
  const supported = useSyncExternalStore(noop, browserSupportsWebAuthn, () => true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function add() {
    setBusy(true);
    setMsg("");
    try {
      const optionsJSON = await passkeyRegisterOptions();
      const response = await startRegistration({ optionsJSON });
      const r = await passkeyRegister(response, deviceName());
      setMsg(r.error ?? "Gotowe — następnym razem zalogujesz się Face ID.");
    } catch (e) {
      const name = (e as { name?: string }).name;
      setMsg(name === "InvalidStateError" ? "To urządzenie ma już passkey dla tej apki." : "Anulowano albo nie udało się — spróbuj jeszcze raz.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return <p className="text-muted-foreground px-4 py-3 text-[14px]">Ta przeglądarka nie obsługuje passkeys.</p>;
  return (
    <div className="p-3">
      <button
        onClick={add}
        disabled={busy}
        className={
          prominent
            ? "bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[17px] font-semibold active:scale-[0.98] disabled:opacity-60"
            : "bg-secondary text-secondary-foreground flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium active:scale-[0.98] disabled:opacity-60"
        }
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ScanFace className="size-5" />}
        Dodaj Face ID na tym urządzeniu
      </button>
      {msg && <p className="text-muted-foreground mt-2 text-center text-[13px]">{msg}</p>}
    </div>
  );
}
