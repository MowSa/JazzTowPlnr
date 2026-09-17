'use client';

import { useSyncExternalStore } from 'react';
import { createLiveFlightsPoller } from '@/lib/yul-ops/live-poller';

// Dashboard and the global toast host subscribe to this same client-side store.
// Construction has no side effects; the first subscriber starts polling.
const liveFlights = createLiveFlightsPoller({
  fetch: (signal) => fetch('/api/flights/live', { cache: 'no-store', signal }),
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (timer) => window.clearTimeout(timer as number),
});

export function useLiveFlights() {
  return useSyncExternalStore(
    liveFlights.subscribe,
    liveFlights.getSnapshot,
    liveFlights.getServerSnapshot,
  );
}

export function useNextLivePollAt() {
  return useSyncExternalStore(
    liveFlights.subscribe,
    liveFlights.getNextPollAt,
    () => 0,
  );
}
