import type { Opportunity } from "@/lib/opportunities";
import { RELATION_LABEL } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtTravel } from "@/lib/time";

const APP_URL = process.env.APP_URL ?? "https://su-manager.vercel.app";
const MAX_ROWS = 40;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function row(o: Opportunity) {
  const e = o.event;
  const where = [e.venueName, e.cityName].filter(Boolean).join(", ");
  const travel = o.city?.travelMinutes != null ? ` · ${fmtTravel(o.city.travelMinutes)}` : "";
  const who = o.matches
    .map((m) => {
      const when = m.lastPlayedTogether ? `, wspólny wieczór ${fmtDate(m.lastPlayedTogether)}` : "";
      return `<b>${esc(m.name)}</b> (${esc(RELATION_LABEL[m.relation])}${when})`;
    })
    .join(", ");
  return `<tr><td style="padding:8px 0;border-bottom:1px solid #e5ece8">
    <a href="${esc(e.url)}" style="color:#13824a;font-weight:600;text-decoration:none">${esc(e.title)}</a><br>
    <span style="color:#5b6b63;font-size:13px">${esc(fmtDateTime(e.startsAt))} · ${esc(where)}${travel}${o.isOpenMic ? " · open mic" : ""}</span>
    ${who ? `<br><span style="font-size:13px">${who}</span>` : ""}
  </td></tr>`;
}

function section(title: string, items: Opportunity[]) {
  if (!items.length) return "";
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;
  return `<h3 style="margin:20px 0 4px;font-size:15px">${title} · ${items.length}</h3>
    <table style="width:100%;border-collapse:collapse">${shown.map(row).join("")}</table>
    ${more > 0 ? `<p style="color:#5b6b63;font-size:13px">…i ${more} więcej w aplikacji.</p>` : ""}`;
}

export function renderReport(items: Opportunity[]) {
  const friends = items.filter((o) => o.group === "friends");
  const inRange = items.filter((o) => o.group === "inRange");
  const unknown = items.filter((o) => o.group === "unknownCity");
  const subject = [
    friends.length && `${friends.length} ze znajomymi`,
    inRange.length && `${inRange.length} w zasięgu`,
  ]
    .filter(Boolean)
    .join(", ");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;color:#1c2a23">
    <h2 style="margin:0 0 4px">Nowe okazje</h2>
    <p style="margin:0;color:#5b6b63">Od wczoraj w bileteriach. <a href="${APP_URL}/events" style="color:#13824a">Otwórz w aplikacji</a></p>
    ${section("Grają ludzie z Twojej bazy", friends)}
    ${section("W zasięgu dojazdu", inRange)}
    ${unknown.length ? `<p style="margin-top:20px;color:#5b6b63;font-size:13px">${unknown.length} wydarzeń w miastach bez czasu dojazdu — uzupełnij je w aplikacji (Okazje → Do uzupełnienia).</p>` : ""}
  </div>`;
  return { subject: `SU Manager: ${subject || "nowe wydarzenia"}`, html };
}

/** Wysyłka przez Resend (bez SDK). Bez klucza — tylko log, żeby lokalnie dało się testować. */
export async function sendReport(items: Opportunity[], log: (m: string) => void) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL;
  const { subject, html } = renderReport(items);
  if (!key || !to) {
    log(`[mail pominięty — brak RESEND_API_KEY/REPORT_EMAIL] ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SU Manager <onboarding@resend.dev>", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  log(`mail wysłany: ${subject}`);
}
