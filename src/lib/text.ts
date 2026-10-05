/** Małe litery bez polskich znaków — do wyszukiwania i (później) dopasowania nazwisk. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
