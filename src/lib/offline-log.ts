/**
 * Log grania bez zasięgu: kolejka w localStorage telefonu, wysyłana przez OfflineSync, gdy sieć wróci.
 * Ten sam format czyta i zapisuje public/offline.html (strona, którą service worker pokazuje bez sieci),
 * więc klucze i kształt wpisu muszą zostać zgodne z tamtym plikiem.
 */
import type { OfflineLogData } from "./queries";

export const QUEUE_KEY = "su-log-queue";
export const DATA_KEY = "su-offline-data";

/** Pola formularza jako pary [nazwa, wartość] — FormData nie da się zapisać wprost. */
export type QueuedLog = { gigId: number; title: string; savedAt: string; entries: [string, string][] };

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // tryb prywatny / pełna pamięć — trudno, log zostanie w formularzu
  }
}

export const queuedLogs = () => read<QueuedLog[]>(QUEUE_KEY, []);

/** Jeden wpis na granie — nowszy zastępuje starszy. */
export function queueLog(fd: FormData, title: string) {
  const entries = [...fd.entries()].flatMap(([k, v]): [string, string][] => (typeof v === "string" ? [[k, v]] : []));
  const gigId = Number(fd.get("gigId"));
  write(QUEUE_KEY, [...queuedLogs().filter((q) => q.gigId !== gigId), { gigId, title, savedAt: new Date().toISOString(), entries }]);
  window.dispatchEvent(new Event("su-log-queue"));
}

export function dropQueuedLog(gigId: number) {
  write(QUEUE_KEY, queuedLogs().filter((q) => q.gigId !== gigId));
  window.dispatchEvent(new Event("su-log-queue"));
}

export const toFormData = (q: QueuedLog) => {
  const fd = new FormData();
  for (const [k, v] of q.entries) fd.append(k, v);
  return fd;
};

export const saveOfflineData = (data: OfflineLogData) => write(DATA_KEY, { ...data, savedAt: new Date().toISOString() });

/** Brak sieci (a nie błąd serwera, np. walidacja) — tylko wtedy odkładamy log do kolejki. */
export const isNetworkError = (e: unknown) =>
  !navigator.onLine || e instanceof TypeError || /fetch|network|load failed|connection/i.test(String((e as Error)?.message));
