/**
 * Znacznik „to urządzenie ma passkey dla apki” (localStorage, tylko wygoda UX — nie bezpieczeństwo):
 * na ekranie logowania Face ID jest wtedy głównym przyciskiem. Bez niego iOS pokazałby
 * „brak passkeys — zeskanuj kod QR”.
 */
export const PASSKEY_FLAG = "sum-passkey";

export function markPasskeyDevice() {
  try {
    localStorage.setItem(PASSKEY_FLAG, "1");
  } catch {}
}
