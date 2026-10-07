"use client";

import { useEffect, useState } from "react";
import { sendTestPush, subscribePush, unsubscribePush } from "@/app/actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

/** Włącznik powiadomień na tym urządzeniu (Web Push przez /sw.js). */
export function PushSettings() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setInfo("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await subscribePush(JSON.parse(JSON.stringify(sub)));
      setState("on");
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "off");
      setInfo("Nie udało się włączyć — sprawdź zgodę na powiadomienia.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribePush(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const n = await sendTestPush();
    setInfo(n ? `Wysłane na ${n} ${n === 1 ? "urządzenie" : "urządzenia"}.` : "Brak zapisanych urządzeń.");
    setBusy(false);
  }

  const button = "h-11 w-full rounded-xl text-[16px] font-semibold active:scale-[0.98] disabled:opacity-50";
  return (
    <div className="space-y-2 p-3">
      {state === "loading" && <p className="text-muted-foreground text-[15px]">Sprawdzam…</p>}
      {state === "unsupported" && <p className="text-[15px]">Ta przeglądarka nie obsługuje powiadomień push.</p>}
      {state === "ios-install" && (
        <p className="text-[15px] leading-relaxed">
          Na iPhonie powiadomienia działają tylko z apki na ekranie głównym: w Safari <b>Udostępnij → Do ekranu początkowego</b>, otwórz
          SU Managera z ikonki i wróć tutaj.
        </p>
      )}
      {state === "denied" && (
        <p className="text-[15px] leading-relaxed">
          Powiadomienia są zablokowane. Włącz je w ustawieniach systemu dla SU Managera (iPhone: Ustawienia → Powiadomienia).
        </p>
      )}
      {state === "off" && (
        <button onClick={enable} disabled={busy} className={`bg-primary text-primary-foreground ${button}`}>
          Włącz powiadomienia na tym urządzeniu
        </button>
      )}
      {state === "on" && (
        <>
          <p className="text-[15px]">✓ Powiadomienia włączone na tym urządzeniu.</p>
          <button onClick={test} disabled={busy} className={`bg-secondary text-secondary-foreground ${button}`}>
            Wyślij testowe
          </button>
          <button onClick={disable} disabled={busy} className="text-muted-foreground h-10 w-full text-[15px]">
            Wyłącz na tym urządzeniu
          </button>
        </>
      )}
      {info && <p className="text-muted-foreground text-[13px]">{info}</p>}
    </div>
  );
}
