import { redirect } from "next/navigation";
import { db, passkeys } from "@/db";
import { currentSession } from "@/lib/auth";
import { authEnabled } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Logowanie · SU Manager" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  // Już zalogowany (albo logowanie wyłączone lokalnie) — od razu do apki.
  if (!authEnabled() || (await currentSession())) redirect(target);
  const anyPasskey = (await db.select({ id: passkeys.id }).from(passkeys).limit(1)).length > 0;
  return (
    <div className="flex min-h-[80vh] flex-col justify-center">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-[28px] font-semibold tracking-tight">
            <span className="text-primary">●</span> SU Manager
          </div>
          <p className="text-muted-foreground mt-1 text-[15px]">Zaloguj się, żeby wejść.</p>
        </div>
        <LoginForm next={target} anyPasskey={anyPasskey} />
        <p className="text-muted-foreground mt-6 text-center text-[12.5px] leading-relaxed">
          Sesja trzyma się na tym urządzeniu przez rok. Wylogujesz urządzenia w Więcej → Bezpieczeństwo.
        </p>
      </div>
    </div>
  );
}
