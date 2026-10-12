import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, checkSession, cookieOptions, refreshSession, SESSION_COOKIE } from "@/lib/session";

/**
 * Dostęp tylko po zalogowaniu (ciasteczko sesji, patrz src/lib/session.ts). Bez APP_PASSWORD
 * (lokalnie) — wpuszcza każdego. Strony bez sesji → /login, zapytania w tle → 401 JSON
 * (zamiast „problemu z internetem”, który dawał basic auth w PWA).
 */
export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const session = await checkSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const isPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
    if (isPage) {
      const url = new URL("/login", request.url);
      const next = request.nextUrl.pathname + request.nextUrl.search;
      if (next !== "/") url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "Sesja wygasła — zaloguj się ponownie" }, { status: 401 });
  }

  // Przesuwane okno: raz dziennie świeże ciasteczko na kolejny rok.
  const response = NextResponse.next();
  const fresh = await refreshSession(session);
  if (fresh) response.cookies.set(SESSION_COOKIE, fresh, cookieOptions);
  return response;
}

export const config = {
  // Bez logowania: /login (strona i jej akcje), /calendar/<token>.ics (tajny token), /api/notify
  // (CRON_SECRET), statyczne pliki, ikony, manifest, sw.js i offline.html — przeglądarka pobiera je w tle.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|calendar/|api/notify|sw.js|offline.html).*)"],
};
