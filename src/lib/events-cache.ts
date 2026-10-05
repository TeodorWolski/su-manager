import "server-only";
import { unstable_cache } from "next/cache";
import { EVENTS_TAG, loadUpcomingEvents } from "./opportunities";

/**
 * ~1500 wydarzeń zmienia się raz dziennie (cron rano) — nie ma sensu ciągnąć ich z bazy
 * przy każdym wejściu w Okazje. Akcje na wydarzeniach unieważniają tag od razu,
 * a nowe wydarzenia z crona pojawią się najpóźniej po godzinie.
 */
export const loadUpcomingEventsCached = unstable_cache(loadUpcomingEvents, ["upcoming-events"], {
  tags: [EVENTS_TAG],
  revalidate: 3600,
});
