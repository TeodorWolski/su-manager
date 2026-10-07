/** Wysyłka Web Push na wszystkie zapisane urządzenia; martwe subskrypcje (404/410) są usuwane. */
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db, pushSubscriptions } from "@/db";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://su-manager.vercel.app", pub, priv);
  configured = true;
  return true;
}

export async function sendPush(payload: PushPayload) {
  if (!configure()) throw new Error("Brak kluczy VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // Urządzenie wyrejestrowane / wygasła subskrypcja — sprzątamy.
      if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
      else throw e;
    }
  }
  return sent;
}
