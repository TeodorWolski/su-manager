import { desc } from "drizzle-orm";
import { PendingButton } from "@/components/form";
import { Empty, PageHeader, Pill, Section } from "@/components/ios";
import { db, passkeys, sessions } from "@/db";
import { currentSession } from "@/lib/auth";
import { fmtDate } from "@/lib/time";
import { deletePasskey, logout, logoutDevice, logoutOthers } from "./actions";
import { AddPasskey } from "./passkey-button";

/** „iPhone · Safari” z user-agenta — na liście sesji. */
function device(ua: string | null) {
  if (!ua) return "Nieznane urządzenie";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Urządzenie";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${os} · ${browser}` : os;
}

export default async function SecurityPage({ searchParams }: PageProps<"/settings/security">) {
  const { setup } = await searchParams;
  const [me, keys, devices] = await Promise.all([
    currentSession(),
    db.select().from(passkeys).orderBy(desc(passkeys.createdAt)),
    db.select().from(sessions).orderBy(desc(sessions.lastSeenAt)),
  ]);
  return (
    <>
      <PageHeader title="Bezpieczeństwo" back={{ href: "/more", label: "Więcej" }} />

      {setup === "1" && !keys.length && (
        <Section footer="Face ID / Touch ID zamiast hasła — szybciej, a passkeya nie da się wyłudzić ani zgadnąć. Hasło zostaje jako zapasowe.">
          <div className="px-4 pt-3 text-[16px] font-medium">Włącz logowanie Face ID</div>
          <AddPasskey prominent />
        </Section>
      )}

      <Section title="Face ID / passkeys" footer="Passkey jest przypisany do urządzenia (na iPhonie synchronizuje się przez pęk kluczy iCloud).">
        {keys.map((k) => (
          <div key={k.id} className="border-border/70 flex items-center gap-3 border-b px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[15px]">{k.name}</div>
              <div className="text-muted-foreground text-[12.5px]">
                dodany {fmtDate(k.createdAt.slice(0, 10))}
                {k.lastUsedAt && ` · ostatnio ${fmtDate(k.lastUsedAt.slice(0, 10))}`}
              </div>
            </div>
            <form action={deletePasskey.bind(null, k.id)}>
              <PendingButton className="text-destructive h-8 text-[14px]">Usuń</PendingButton>
            </form>
          </div>
        ))}
        {!(setup === "1" && !keys.length) && <AddPasskey />}
      </Section>

      <Section
        title="Zalogowane urządzenia"
        footer="Sesja trwa rok od ostatniego użycia. Zgubiony telefon? „Wyloguj wszystkie inne” — albo zmień APP_PASSWORD w Vercelu, to wyloguje wszystko."
      >
        {devices.length ? (
          devices.map((d) => (
            <div key={d.id} className="border-border/70 flex items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[15px]">
                  {device(d.userAgent)}
                  {d.id === me?.hash && <Pill tone="success">to urządzenie</Pill>}
                </div>
                <div className="text-muted-foreground text-[12.5px]">
                  {d.method === "passkey" ? "Face ID" : "hasło"} · ostatnio {fmtDate(d.lastSeenAt.slice(0, 10))}
                </div>
              </div>
              {d.id !== me?.hash && (
                <form action={logoutDevice.bind(null, d.id)}>
                  <PendingButton className="text-destructive h-8 text-[14px]">Wyloguj</PendingButton>
                </form>
              )}
            </div>
          ))
        ) : (
          <Empty>Logowanie wyłączone (lokalnie, bez APP_PASSWORD).</Empty>
        )}
        {devices.length > 1 && (
          <form action={logoutOthers} className="border-t p-2">
            <PendingButton className="text-destructive h-10 w-full text-[15px]">Wyloguj wszystkie inne</PendingButton>
          </form>
        )}
      </Section>

      <Section>
        <form action={logout}>
          <PendingButton className="text-destructive h-12 w-full text-[16px]">Wyloguj się z tego urządzenia</PendingButton>
        </form>
      </Section>
    </>
  );
}
