import type { ScrapedEvent } from "./types";

/**
 * Czy przebieg źródła wygląda zdrowo. Parser rzadko się wywraca — częściej po zmianie strony
 * zwraca po cichu zero albo pół danych. Każda uwaga = czerwony build w Actions (GitHub wysyła mail).
 * `knownUpcoming` = ile nadchodzących wydarzeń z tego źródła widzieliśmy w ostatnich przebiegach.
 */
const MIN_FOR_RATIOS = 10;
/** Poniżej tylu procent poprzedniej liczby to już nie „mniej koncertów”, tylko zepsuty parser. */
const MAX_DROP = 0.5;

export function healthIssues(source: string, found: ScrapedEvent[], knownUpcoming: number): string[] {
  const issues: string[] = [];
  if (!found.length && knownUpcoming > 0) issues.push(`${source}: 0 wydarzeń (ostatnio ~${knownUpcoming})`);
  else if (knownUpcoming >= 20 && found.length < knownUpcoming * MAX_DROP) {
    issues.push(`${source}: spadek do ${found.length} wydarzeń (ostatnio ~${knownUpcoming})`);
  }
  if (found.length >= MIN_FOR_RATIOS) {
    const share = (pred: (e: ScrapedEvent) => boolean) => found.filter(pred).length / found.length;
    const noCity = share((e) => !e.cityName);
    const noTime = share((e) => e.startsAt.length <= 10);
    if (noCity > 0.3) issues.push(`${source}: ${Math.round(noCity * 100)}% wydarzeń bez miasta`);
    if (noTime > 0.4) issues.push(`${source}: ${Math.round(noTime * 100)}% wydarzeń bez godzin`);
  }
  return issues;
}
