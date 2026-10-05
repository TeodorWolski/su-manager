import { RELATION_LABEL } from "@/lib/labels";
import { groupByPerformer, type Opportunity, type OpportunityGroup } from "@/lib/opportunities";
import { plural } from "@/lib/text";
import { fmtDate, fmtDateTime, fmtTravel } from "@/lib/time";

const APP_URL = process.env.APP_URL ?? "https://su-manager.vercel.app";
const MAX_ROWS = 30;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Jeden wiersz na komika: najbliższy termin + ile jeszcze nowych. */
function row(g: OpportunityGroup) {
  const o = g.primary;
  const e = o.event;
  const where = [e.venueName, e.cityName].filter(Boolean).join(", ");
  const travel = o.city?.travelMinutes != null ? ` · ${fmtTravel(o.city.travelMinutes)}` : "";
  const more = g.others.length ? ` · +${plural(g.others.length, "termin", "terminy", "terminów")}` : "";
  const who = g.matches
    .map((m) => {
      const when = m.lastPlayedTogether ? `, wspólny wieczór ${fmtDate(m.lastPlayedTogether)}` : "";
      return `<b>${esc(m.name)}</b> (${esc(RELATION_LABEL[m.relation])}${when})`;
    })
    .join(", ");
  return `<tr><td style="padding:8px 0;border-bottom:1px solid #e5ece8">
    <a href="${esc(e.url)}" style="color:#13824a;font-weight:600;text-decoration:none">${esc(e.title)}</a><br>
    <span style="color:#5b6b63;font-size:13px">${esc(fmtDateTime(e.startsAt))} · ${esc(where)}${travel}${more}</span>
    ${who ? `<br><span style="font-size:13px">${who}</span>` : ""}
  </td></tr>`;
}

function section(title: string, groups: OpportunityGroup[]) {
  if (!groups.length) return "";
  const shown = groups.slice(0, MAX_ROWS);
  const more = groups.length - shown.length;
  return `<h3 style="margin:20px 0 4px;font-size:15px">${title} · ${groups.length}</h3>
    <table style="width:100%;border-collapse:collapse">${shown.map(row).join("")}</table>
    ${more > 0 ? `<p style="color:#5b6b63;font-size:13px">…i ${more} więcej w aplikacji.</p>` : ""}`;
}

export function renderReport(items: Opportunity[]) {
  const friends = groupByPerformer(items.filter((o) => o.tab === "friends"));
  const openMic = groupByPerformer(items.filter((o) => o.tab === "openMic"));
  const inRange = groupByPerformer(items.filter((o) => o.tab === "inRange"));
  const unknown = new Set(items.filter((o) => o.tab === "unknownCity").map((o) => o.event.cityName)).size;
  const subject = [
    friends.length && `${friends.length} ze znajomymi`,
    openMic.length && `${openMic.length} open mic`,
    inRange.length && `${inRange.length} w zasięgu`,
  ]
    .filter(Boolean)
    .join(", ");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;color:#1c2a23">
    <h2 style="margin:0 0 4px">Nowe okazje</h2>
    <p style="margin:0;color:#5b6b63">Nowe terminy w bileteriach od ostatniego raportu. <a href="${APP_URL}/events" style="color:#13824a">Otwórz w aplikacji</a></p>
    ${section("Grają ludzie z Twojej bazy", friends)}
    ${section("Open miki", openMic)}
    ${section("W zasięgu dojazdu", inRange)}
    ${unknown ? `<p style="margin-top:20px;color:#5b6b63;font-size:13px">${plural(unknown, "miasto", "miasta", "miast")} bez czasu dojazdu — uzupełnij w aplikacji (Okazje → Uzupełnij).</p>` : ""}
  </div>`;
  return { subject: `SU Manager: ${subject || "nowe miasta do uzupełnienia"}`, html, worthSending: !!subject };
}

/** Wysyłka przez Resend (bez SDK). Bez klucza — tylko log, żeby lokalnie dało się testować. */
export async function sendReport(items: Opportunity[], log: (m: string) => void) {
  const { subject, html, worthSending } = renderReport(items);
  if (!worthSending) {
    log("same nowe miasta bez dojazdu — bez maila");
    return;
  }
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL;
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
