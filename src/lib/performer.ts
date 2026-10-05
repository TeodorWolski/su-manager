import { normalize } from "./text";

/**
 * Kto występuje — wyciągnięte z tytułu, bo bileterie nie podają tego osobno.
 * „Stand-up: Bartek Strusiński” → „Bartek Strusiński”
 * „Wojciech Cejrowski Stand-up comedy” → „Wojciech Cejrowski”
 * „Mariusz Kałamaga — „Mamo, papier się skończył”” → „Mariusz Kałamaga”
 * Służy do grupowania terminów jednego komika i do „Ukryj komika”.
 */
export function performerName(title: string) {
  const cleaned = title
    .replace(/stand[\s-]?up(\s+comedy)?/gi, " ")
    .replace(/\bnowy program\b|\btrasa\b/gi, " ")
    .replace(/[„”"«»]/g, " ");
  const first = cleaned
    .split(/\s[-–—|]\s|:|\s[-–—]$|\(/)
    .map((s) => s.replace(/^[\s\-–—:|.,!]+|[\s\-–—:|.,!]+$/g, "").replace(/\s+/g, " "))
    .find((s) => s.length >= 3);
  return first ?? title.trim();
}

export const performerKey = (title: string) => normalize(performerName(title));

/** Stand-up po polsku (ew. po angielsku). Odrzucamy cyrylicę i wydarzenia wprost w innym języku. */
export function isWantedLanguage(text: string) {
  if (/[Ѐ-ӿ]/.test(text)) return false;
  return !/\b(po (ukrainsku|rosyjsku|bialorusku)|in (ukrainian|russian)|ukrainian|russian|ukrainsk\w* stand)/.test(normalize(text));
}
