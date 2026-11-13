/**
 * Mediana zaokrąglona do całości (przy parzystej liczbie próbek — średnia dwóch środkowych).
 * Liczymy nią dni, więc ułamki nic nie znaczą. Pusta lista nie ma mediany — sprawdź wcześniej.
 */
export function roundedMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
