/**
 * Szkielet ekranu na czas ładowania danych. Next prefetchuje go dla każdego linku,
 * więc po tapnięciu zakładki zmiana ekranu jest natychmiastowa, a dane dociągają się w tle.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Ładowanie">
      <div className="mb-6 pt-4 md:pt-8">
        <div className="bg-muted h-9 w-44 rounded-lg" />
        <div className="bg-muted mt-2 h-4 w-60 rounded" />
      </div>
      {[3, 4, 2].map((rows, i) => (
        <div key={i} className="mb-7">
          <div className="bg-muted mb-2 ml-4 h-3 w-24 rounded" />
          <div className="bg-card overflow-hidden rounded-2xl">
            {Array.from({ length: rows }, (_, j) => (
              <div key={j} className="border-border/70 flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b">
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-4 w-3/5 rounded" />
                  <div className="bg-muted h-3 w-2/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
