import type { Hot } from "@/lib/hot";
import { AVAILABILITY_LABEL, CHANNEL_SHORT, RELATION_LABEL } from "@/lib/labels";
import { pitchMessage } from "@/lib/messages";
import type { ReadyBit } from "@/lib/bit-ready";
import type { Mgm } from "@/lib/mgm";
import type { FollowUp, Writing } from "@/lib/planning";
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
  const tickets = e.availability ? ` · <b style="color:#b45309">${AVAILABILITY_LABEL[e.availability]}</b>` : "";
  const who = g.matches
    .map((m) => {
      const when =
        (m.lastPlayedTogether ? `, wspólny wieczór ${fmtDate(m.lastPlayedTogether)}` : "") +
        (m.lastMessageAt ? `, pisałeś ${fmtDate(m.lastMessageAt)}${m.lastMessageReplied ? "" : " bez odpowiedzi"}` : "");
      return `<b>${esc(m.name)}</b> (${esc(RELATION_LABEL[m.relation])}${when})`;
    })
    .join(", ");
  return `<tr><td style="padding:8px 0;border-bottom:1px solid #e5ece8">
    <a href="${esc(e.url)}" style="color:#13824a;font-weight:600;text-decoration:none">${esc(e.title)}</a><br>
    <span style="color:#5b6b63;font-size:13px">${esc(fmtDateTime(e.startsAt))} · ${esc(where)}${travel}${more}${tickets}</span>
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

const muted = (s: string) => `<span style="color:#5b6b63;font-size:13px">${s}</span>`;

function followUpSection(items: FollowUp[]) {
  if (!items.length) return "";
  const rows = items.map((g) => {
    const used = g.used.map((c) => CHANNEL_SHORT[c] ?? c).join(", ");
    const meta = [
      fmtDateTime(g.startsAt),
      g.headlinerName,
      g.daysLeft <= 1 ? "już jutro" : `za ${g.daysLeft} dni`,
      `cisza ${g.quietDays} dni`,
      used && `pisałeś: ${used}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const next = g.next ? `ponów na: <b>${esc(g.next)}</b>` : "pisałeś już wszędzie";
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #e5ece8">
      <a href="${APP_URL}/gigs/${g.id}" style="color:#13824a;font-weight:600;text-decoration:none">${esc(g.title)}</a><br>
      ${muted(esc(meta))}<br><span style="font-size:13px">${next}</span>
    </td></tr>`;
  });
  return `<h3 style="margin:20px 0 4px;font-size:15px">Do ponowienia · ${items.length}</h3>
    ${muted("Granie za ~1,5 tygodnia albo mniej, a odpowiedzi brak — przypomnij się, najlepiej innym kanałem.")}
    <table style="width:100%;border-collapse:collapse">${rows.join("")}</table>`;
}

function hotSection(items: Hot[]) {
  if (!items.length) return "";
  const rows = items.map((h) => {
    const meta = [fmtDateTime(h.startsAt), [h.venueName, h.cityName].filter(Boolean).join(", "), fmtTravel(h.travelMinutes)]
      .filter(Boolean)
      .join(" · ");
    const why = [h.friend, ...h.reasons.filter((r) => r !== "znajomy")].filter(Boolean).join(" · ");
    const msg = pitchMessage({ startsAt: h.startsAt, cityName: h.cityName, openMic: h.isOpenMic });
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #e5ece8">
      <a href="${esc(h.url)}" style="color:#13824a;font-weight:600;text-decoration:none">${esc(h.title)}</a><br>
      ${muted(esc(meta))}${why ? `<br><span style="font-size:13px">${esc(why)}</span>` : ""}
      <div style="margin-top:4px;padding:6px 8px;background:#f2f5f3;border-radius:6px;font-size:13px">${esc(msg)}</div>
    </td></tr>`;
  });
  return `<h3 style="margin:20px 0 4px;font-size:15px">🔥 Najgorętsze okazje · ${items.length}</h3>
    ${muted("Za 1–3 tygodnie — w sam raz, żeby zaklepać miejsce. Tekst wiadomości gotowy do skopiowania.")}
    <table style="width:100%;border-collapse:collapse">${rows.join("")}</table>`;
}

/** Jedna–dwie linijki o pisaniu: seria treningu puent, tydzień, co czeka na poprawkę po scenie. */
function writingSection(w: Writing | undefined, mgm: (Mgm & { ready?: ReadyBit[] }) | undefined) {
  if (!w) return "";
  const p = w.punchlines;
  const streak = p.streak > 0 ? `seria ${plural(p.streak, "dzień", "dni", "dni")} — dziś też premisa + 10 puent` : "dziś premisa + 10 puent";
  const week = `generowanie ${w.generate.done}/${w.generate.target}, redakcja ${w.edit.done}/${w.edit.target} w tym tygodniu`;
  const queue = w.queue.length
    ? `<br>Do poprawki po scenie: ${w.queue
        .slice(0, 3)
        .map((q) => `<b>${esc(q.name)}</b> ${q.reaction < 0 ? "👎" : "😐"}`)
        .join(", ")}`
    : "";
  const mgmLine = mgm
    ? `<br>${muted(`MGM: <b>${mgm.tested}/${mgm.target} min sprawdzonego</b> w tym miesiącu · niesprawdzone ${mgm.untested} min · razem ${mgm.total} min`)}${
        mgm.ready?.length ? `<br>${muted(`Gotowe do zaliczenia (siadają na scenie): ${mgm.ready.map((b) => esc(b.name)).join(", ")} — przestaw na Sprawdzony.`)}` : ""
      }`
    : "";
  return `<p style="margin:16px 0 0;padding:10px 12px;background:#f2f5f3;border-radius:8px;font-size:14px">✍️ ${streak}<br>${muted(week)}${mgmLine}${queue}</p>`;
}

export type Digest = { fresh: Opportunity[]; followUps: FollowUp[]; hot: Hot[]; writing?: Writing; mgm?: Mgm };

export function renderReport({ fresh: items, followUps, hot, writing, mgm }: Digest) {
  const friends = groupByPerformer(items.filter((o) => o.tab === "friends"));
  const openMic = groupByPerformer(items.filter((o) => o.tab === "openMic"));
  const inRange = groupByPerformer(items.filter((o) => o.tab === "inRange"));
  const unknown = new Set(items.filter((o) => o.tab === "unknownCity").map((o) => o.event.cityName)).size;
  const subject = [
    followUps.length && `${followUps.length} do ponowienia`,
    friends.length && `${friends.length} ze znajomymi`,
    openMic.length && `${openMic.length} open mic`,
    inRange.length && `${inRange.length} w zasięgu`,
    hot.length && `🔥 ${hot.length}`,
  ]
    .filter(Boolean)
    .join(", ");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;color:#1c2a23">
    <h2 style="margin:0 0 4px">SU Manager · dzień dobry</h2>
    <p style="margin:0;color:#5b6b63"><a href="${APP_URL}" style="color:#13824a">Otwórz aplikację</a></p>
    ${writingSection(writing, mgm)}
    ${followUpSection(followUps)}
    ${hotSection(hot)}
    ${friends.length || openMic.length || inRange.length ? `<h2 style="margin:28px 0 0;font-size:17px">Nowe terminy w bileteriach</h2>` : ""}
    ${section("Grają ludzie z Twojej bazy", friends)}
    ${section("Open miki", openMic)}
    ${section("W zasięgu dojazdu", inRange)}
    ${unknown ? `<p style="margin-top:20px;color:#5b6b63;font-size:13px">${plural(unknown, "miasto", "miasta", "miast")} bez czasu dojazdu — uzupełnij w aplikacji (Okazje → Uzupełnij).</p>` : ""}
  </div>`;
  return { subject: `SU Manager: ${subject || "nowe miasta do uzupełnienia"}`, html, worthSending: !!subject };
}

/** Poranny raport: składa treść i wysyła, jeśli jest co. */
export async function sendReport(digest: Digest, log: (m: string) => void) {
  const { subject, html, worthSending } = renderReport(digest);
  if (!worthSending) {
    log("nic do ponowienia, brak gorących i nowych okazji — bez maila");
    return false;
  }
  return sendMail(subject, html, log);
}

/** Wysyłka przez Resend (bez SDK). Bez klucza — tylko log, żeby lokalnie dało się testować. */
export async function sendMail(subject: string, html: string, log: (m: string) => void) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL;
  if (!key || !to) {
    log(`[mail pominięty — brak RESEND_API_KEY/REPORT_EMAIL] ${subject}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SU Manager <onboarding@resend.dev>", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  log(`mail wysłany: ${subject}`);
  return true;
}
