import { CALENDAR_AHEAD_DAYS } from "./calendar-sync";

/** Nazwa kalendarza z prośbami „napisałem / czekam”, który skrypt zakłada na koncie Google. */
export const PENDING_CALENDAR_NAME = "SU · w toku";

/**
 * Skrypt Google Apps Script na koncie użytkownika (co 10 min):
 * - bilety KOLEO z Gmaila → /api/ingest/ticket,
 * - prywatny kalendarz (godziny i tytuły) → /api/ingest/calendar, a w odpowiedzi prośby „w toku”
 *   do osobnego kalendarza. Wpisy mają tag z id grania, więc skrypt poprawia i usuwa tylko swoje.
 * Czas: zawsze Europe/Warsaw (formatDate / parseDate), niezależnie od strefy projektu skryptu.
 */
export function googleScript(app: string) {
  return `// SU Manager — bilety KOLEO z Gmaila i Kalendarz Google. Wklej na script.google.com, uzupełnij TOKEN, uruchom „setup”.
const APP = '${app}';
const TOKEN = 'WKLEJ_TU_CRON_SECRET';
const QUERY = 'from:kasa.biletowa@koleo.pl -label:su-manager newer_than:14d';
const PENDING_CALENDAR = '${PENDING_CALENDAR_NAME}';
const DAYS_AHEAD = ${CALENDAR_AHEAD_DAYS};
const TZ = 'Europe/Warsaw';
const FORMAT = "yyyy-MM-dd'T'HH:mm";

function post(path, body) {
  return UrlFetchApp.fetch(APP + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + TOKEN },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
}

function checkTickets() {
  const label = GmailApp.getUserLabelByName('su-manager') || GmailApp.createLabel('su-manager');
  for (const thread of GmailApp.search(QUERY)) {
    let ok = true;
    for (const msg of thread.getMessages()) {
      const pdfs = msg.getAttachments().filter((a) => a.getContentType() === 'application/pdf' || /\\.pdf$/i.test(a.getName()));
      const bodies = pdfs.length
        ? pdfs.map((a) => ({ pdf: Utilities.base64Encode(a.getBytes()) }))
        : [{ text: msg.getPlainBody() }];
      for (const body of bodies) {
        const res = post('/api/ingest/ticket', body);
        console.log(res.getResponseCode(), res.getContentText());
        if (res.getResponseCode() === 401 || res.getResponseCode() >= 500) ok = false;
      }
    }
    if (ok) thread.addLabel(label); // oznaczony = przetworzony, drugi raz go nie weźmie
  }
}

function syncCalendar() {
  const fmt = (d) => Utilities.formatDate(d, TZ, FORMAT);
  const now = new Date();
  const until = new Date(now.getTime() + DAYS_AHEAD * 864e5);
  // Do apki idą godziny i tytuły — bez opisów, miejsc i uczestników.
  const events = CalendarApp.getDefaultCalendar()
    .getEvents(now, until)
    .filter((e) => e.getMyStatus() !== CalendarApp.GuestStatus.NO)
    .map((e) => ({ start: fmt(e.getStartTime()), end: fmt(e.getEndTime()), title: e.getTitle(), allDay: e.isAllDayEvent() }));
  const res = post('/api/ingest/calendar', { events });
  if (res.getResponseCode() !== 200) {
    console.log(res.getResponseCode(), res.getContentText());
    return;
  }
  const reply = JSON.parse(res.getContentText());
  const want = new Map(reply.pending.map((p) => [String(p.id), p]));
  let removed = 0;
  const cal = CalendarApp.getCalendarsByName(PENDING_CALENDAR)[0] || CalendarApp.createCalendar(PENDING_CALENDAR, { color: CalendarApp.Color.GRAY });
  for (const ev of cal.getEvents(new Date(now.getTime() - 7 * 864e5), new Date(until.getTime() + 864e5))) {
    const p = want.get(ev.getTag('su-gig'));
    const same = p && ev.getTitle() === p.title && fmt(ev.getStartTime()) === p.start && fmt(ev.getEndTime()) === p.end;
    if (same) want.delete(String(p.id));
    else {
      ev.deleteEvent(); // odrzucone, potwierdzone (jest już w zwykłym kalendarzu grań), minione albo zmienione
      removed++;
    }
  }
  for (const p of want.values()) {
    const ev = cal.createEvent(p.title, Utilities.parseDate(p.start, TZ, FORMAT), Utilities.parseDate(p.end, TZ, FORMAT), { description: p.url });
    ev.setTag('su-gig', String(p.id));
  }
  // Same liczby — żeby w dzienniku było widać, że synchronizacja działa.
  console.log('kalendarz: ' + events.length + ' wydarzeń, zajęte wieczory: ' + reply.busyEvenings + ', w toku: ' + reply.pending.length + ' (dodane ' + want.size + ', usunięte ' + removed + ')');
}

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkTickets').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('syncCalendar').timeBased().everyMinutes(10).create();
  checkTickets();
  syncCalendar();
}`;
}
