'use client';

import { useCallback, useEffect, useRef } from 'react';

export type PlannerWork = {
  scheduleLoaded: boolean;
  movesCount: number;
  airportLoaded: boolean;
  editsPresent?: boolean;
};

/** A loaded source is work too: exporting does not persist this session. */
export function hasPlannerWork(work: PlannerWork): boolean {
  return work.scheduleLoaded || work.movesCount > 0 || work.airportLoaded || !!work.editsPresent;
}

/** Shared by file uploads and synchronous WebMCP replacement. */
export function createRequestGuard() {
  let generation = 0;
  return {
    begin: () => ++generation,
    isCurrent: (token: number) => token === generation,
    invalidate: () => { generation++; },
  };
}

/** Parse and prepare everything before asking permission or mutating working state. */
export function prepareReplacement<T>(parse: () => T, confirm: () => boolean): T | null {
  const prepared = parse();
  return confirm() ? prepared : null;
}

export function usePlannerSessionGuard(work: PlannerWork) {
  const hasWork = hasPlannerWork(work);
  const workRef = useRef(hasWork);
  workRef.current = hasWork;

  useEffect(() => {
    if (!hasWork) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!workRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    // Full-document links (including /yul) and location.assign both pass
    // through this single native confirmation, avoiding duplicate dialogs.
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasWork]);

  const confirmReplace = useCallback((message: string): boolean => {
    return !workRef.current || window.confirm(message);
  }, []);
  return { confirmReplace };
}
