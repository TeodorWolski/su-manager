import { NextResponse, type NextRequest } from "next/server";

/**
 * Basic auth dla całej aplikacji. Bez APP_PASSWORD (lokalnie) — wpuszcza każdego.
 * Login dowolny, liczy się tylko hasło.
 */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SU Manager"' },
  });
}

export const config = {
  // /calendar/<token>.ics — feed dla Google Calendar, chroniony tokenem w adresie zamiast hasła.
  // /api/notify — woła go zewnętrzny cron, chroniony CRON_SECRET (patrz route).
  // Ikony, manifest i sw.js bez hasła — przeglądarka pobiera je w tle (instalacja, powiadomienia).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|calendar/|api/notify|sw.js).*)"],
};
