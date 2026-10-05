/** Małe litery bez polskich znaków — do wyszukiwania i (później) dopasowania nazwisk. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Polska odmiana liczebnika: plural(1, "wydarzenie", "wydarzenia", "wydarzeń"). */
export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return `${n} ${one}`;
  const d = n % 10;
  const t = n % 100;
  return `${n} ${d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many}`;
}
