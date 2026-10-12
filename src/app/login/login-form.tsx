"use client";

import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { Loader2, ScanFace } from "lucide-react";
import { useActionState, useState, useSyncExternalStore } from "react";
import { markPasskeyDevice, PASSKEY_FLAG } from "@/lib/passkey-flag";
import { loginWithPassword, passkeyLogin, passkeyLoginOptions } from "./actions";

const noop = () => () => {};
/** Ustawiane po dodaniu passkeya / logowaniu nim na tym urządzeniu (src/lib/passkey-flag.ts). */
const hasLocalPasskey = () => {
  try {
    return localStorage.getItem(PASSKEY_FLAG) === "1";
  } catch {
    return false;
  }
};

/**
 * Face ID na pierwszym planie tylko na urządzeniu, które ma już passkey — inaczej iOS pokazuje
 * „brak passkeys, zeskanuj QR”. Gdy w apce nie ma żadnego passkeya, przycisku nie ma wcale.
 */
export function LoginForm({ next, anyPasskey }: { next: string; anyPasskey: boolean }) {
  const [state, action, pending] = useActionState(loginWithPassword, undefined);
  // Wsparcie WebAuthn czytamy po stronie przeglądarki (na serwerze: brak — bez przycisku Face ID w HTML-u).
  const webauthn = useSyncExternalStore(noop, browserSupportsWebAuthn, () => false) && anyPasskey;
  const primaryFace = useSyncExternalStore(noop, hasLocalPasskey, () => false) && webauthn;
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceError, setFaceError] = useState("");

  async function withPasskey() {
    setFaceBusy(true);
    setFaceError("");
    try {
      const optionsJSON = await passkeyLoginOptions();
      const response = await startAuthentication({ optionsJSON });
      const r = await passkeyLogin(response, next);
      if (r.error) setFaceError(r.error);
      else {
        markPasskeyDevice();
        window.location.assign(r.next ?? "/");
      }
    } catch {
      // Anulowane okno Face ID / brak passkeya na tym urządzeniu — bez dramatu.
      setFaceError("Nie udało się z Face ID — spróbuj jeszcze raz albo zaloguj się hasłem.");
    } finally {
      setFaceBusy(false);
    }
  }

  const error = faceError || state?.error;
  return (
    <div className="space-y-3">
      {primaryFace && (
        <button
          type="button"
          onClick={withPasskey}
          disabled={faceBusy}
          className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[17px] font-semibold active:scale-[0.98] disabled:opacity-60"
        >
          {faceBusy ? <Loader2 className="size-5 animate-spin" /> : <ScanFace className="size-5" />}
          Zaloguj Face ID
        </button>
      )}
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        {/* username dla menedżera haseł (pęk kluczy iCloud zapamięta hasło do tej apki) */}
        <input type="text" name="username" autoComplete="username" defaultValue="su-manager" className="hidden" readOnly />
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Hasło"
          autoFocus={!primaryFace}
          className="bg-card border-border placeholder:text-muted-foreground h-12 w-full rounded-xl border px-4 text-[17px] outline-none"
        />
        <button
          disabled={pending}
          className={
            primaryFace
              ? "bg-secondary text-secondary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-medium active:scale-[0.98] disabled:opacity-60"
              : "bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[17px] font-semibold active:scale-[0.98] disabled:opacity-60"
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Zaloguj hasłem
        </button>
      </form>
      {webauthn && !primaryFace && (
        <button type="button" onClick={withPasskey} disabled={faceBusy} className="text-primary mx-auto flex items-center gap-1.5 text-[14px]">
          <ScanFace className="size-4" /> Mam passkey — zaloguj Face ID
        </button>
      )}
      {error && (
        <p role="alert" className="text-destructive text-center text-[14px]">
          {error}
        </p>
      )}
    </div>
  );
}
