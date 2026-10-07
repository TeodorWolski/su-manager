/**
 * Niedzielne podsumowanie tygodnia mailem (GitHub Actions, .github/workflows/weekly.yml).
 * Lokalnie: pnpm weekly   (bez RESEND_API_KEY mail jest tylko logowany; --html plik.html zapisuje podgląd)
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { oncePerDay } from "@/lib/app-state";
import { getWeekly, renderWeekly } from "@/lib/weekly";
import { sendMail } from "@/scraper/email";

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

async function main() {
  const { subject, html } = renderWeekly(await getWeekly());
  const preview = process.argv.indexOf("--html");
  if (preview > 0) writeFileSync(process.argv[preview + 1], html);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  if (preview < 0 && !(await oncePerDay("weekly-mail", today, process.env.FORCE_MAIL === "true"))) {
    log("podsumowanie już dziś wysłane");
    return;
  }
  await sendMail(subject, html, log);
}

main();
