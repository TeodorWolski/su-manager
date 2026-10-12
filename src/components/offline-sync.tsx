"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { pushKnown, subscribePush, syncQueuedLog } from "@/app/actions";
import { dropQueuedLog, queuedLogs, saveOfflineData, toFormData } from "@/lib/offline-log";
import type { OfflineLogData } from "@/lib/queries";
import { urlBase64ToUint8Array } from "@/lib/vapid";

const subscribe = (cb: () => void) => {
  for (const e of ["su-log-queue", "storage", "online", "offline"]) window.addEventListener(e, cb);
  return () => {
    for (const e of ["su-log-queue", "storage", "online", "offline"]) window.removeEventListener(e, cb);
  };
};

/**
 * W tle na każdej stronie (po zalogowaniu):
 * - rejestruje service workera (push + strona offline.html bez zasięgu),
 * - odkłada w telefonie dzisiejsze grania i bity, żeby log dało się wypełnić bez sieci,
 * - wysyła zaległe logi z kolejki, gdy sieć wróci,
 * - pilnuje, żeby serwer znał subskrypcję push tego urządzenia (iOS potrafi ją unieważnić).
 */
export function OfflineSync({ data }: { data: OfflineLogData }) {
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);
  const waiting = useSyncExternalStore(
    subscribe,
    () => (navigator.onLine ? 0 : queuedLogs().length),
    () => 0,
  );

  useEffect(() => saveOfflineData(data), [data]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(async (reg) => {
      // Strona offline ma być świeża po każdym wdrożeniu.
      reg.active?.postMessage("refresh-offline");
      if (!("PushManager" in window) || Notification.permission !== "granted") return;
      const sub = await reg.pushManager.getSubscription();
      if (!sub || (await pushKnown(sub.endpoint))) return;
      // Serwer zapomniał to urządzenie (np. martwa subskrypcja) — zgoda jest, więc zapisujemy nową.
      try {
        await sub.unsubscribe();
        const fresh = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
        await subscribePush(JSON.parse(JSON.stringify(fresh)));
      } catch {
        // iOS bywa wybredny bez gestu — wtedy włącznik w Więcej → Powiadomienia
      }
    });
  }, []);

  useEffect(() => {
    let busy = false;
    async function flush() {
      if (busy || !navigator.onLine) return;
      busy = true;
      const done: string[] = [];
      for (const q of queuedLogs()) {
        try {
          await syncQueuedLog(toFormData(q));
          dropQueuedLog(q.gigId);
          done.push(q.title);
        } catch {
          // Bez sieci albo wygasła sesja — log zostaje w telefonie, spróbujemy przy kolejnym otwarciu.
          break;
        }
      }
      busy = false;
      if (done.length) {
        setSent(done.join(", "));
        router.refresh();
        setTimeout(() => setSent(null), 5000);
      }
    }
    flush();
    const onVisible = () => document.visibilityState === "visible" && flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  if (!sent && !waiting) return null;
  return (
    <div
      role="status"
      className="bg-card border-border fixed inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-xl border px-3.5 py-2.5 text-[14px] shadow-lg"
    >
      {sent ? `✓ Wysłano zaległy log: ${sent}` : `📴 Bez zasięgu — ${waiting === 1 ? "1 log czeka" : `${waiting} logi czekają`} na wysłanie`}
    </div>
  );
}
