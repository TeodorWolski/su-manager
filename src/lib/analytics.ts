import posthog from "posthog-js";

/**
 * Analityka (PostHog) po stronie przeglądarki. Bez kluczy w środowisku jest wyłączona —
 * apka ma działać lokalnie i u kogoś, kto sklonował repo, bez żadnej konfiguracji.
 * Start: instrumentation-client.ts.
 */
export const analyticsEnabled = !!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && !!process.env.NEXT_PUBLIC_POSTHOG_HOST;

/** Zdarzenia, które wysyłamy — jedna lista, żeby nazwy w PostHogu się nie rozjechały. */
export type AnalyticsEvent =
  | "outreach_message_copied"
  | "passkey_added"
  | "push_notifications_enabled"
  | "push_notifications_disabled"
  | "push_test_sent";

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  if (analyticsEnabled) posthog.capture(event, properties);
}

/** Jeden użytkownik = jedna osoba w PostHogu, niezależnie od urządzenia; `null` po wylogowaniu. */
export function identify(distinctId: string | null) {
  if (!analyticsEnabled) return;
  if (distinctId) posthog.identify(distinctId);
  else posthog.reset();
}

export function captureError(error: unknown) {
  if (analyticsEnabled) posthog.captureException(error);
}
