'use client';

import type { FeedStatus, LiveAircraft } from '@/lib/yul-ops/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function OperationsSummary({ aircraft }: { aircraft: LiveAircraft[] }) {
  const inbound = aircraft.filter((item) => item.direction === 'INBOUND').length;
  const outbound = aircraft.filter((item) => item.direction === 'OUTBOUND').length;
  return (
    <div className="yul-header-summary" aria-label="Operations summary">
      <div>
        <strong className="in">{inbound}</strong>
        <span>Arrivals</span>
      </div>
      <div>
        <strong className="out">{outbound}</strong>
        <span>Departures</span>
      </div>
      <div>
        <strong>{aircraft.length}</strong>
        <span>Active</span>
      </div>
    </div>
  );
}

export function StatusPill({
  status,
  demo,
  stale,
  staleCount = 0,
  nextPoll,
  notice,
  error,
  refreshIntervalMs,
  staleAfterMs,
}: {
  status: FeedStatus;
  demo: boolean;
  stale?: boolean;
  staleCount?: number;
  nextPoll?: string;
  notice?: string;
  error?: string;
  refreshIntervalMs?: number;
  staleAfterMs?: number;
}) {
  const offline = status === 'error';
  const degraded = stale || staleCount > 0 || status === 'delayed' || demo;
  const healthy = !offline && !degraded;
  const label = stale
    ? 'Stale feed'
    : offline
      ? 'Offline'
      : demo
        ? 'Demo'
        : status === 'ok'
          ? 'Live'
          : 'Delayed';
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              'yul-status-pill',
              offline && 'is-offline',
              !offline && degraded && 'is-delayed',
            )}
            aria-label={`Feed status: ${label}. Open feed details`}
          />
        }
      >
        <i className={healthy ? 'pulse' : undefined} aria-hidden="true" />
        {label}
        {staleCount > 0 && ` · ${staleCount} stale`}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="yul-status-pop">
          <div className="row">
            <span>Data source</span>
            <strong>{demo ? 'Demo feed' : 'Flightradar24'}</strong>
          </div>
          {nextPoll && (
            <div className="row">
              <span>Next update</span>
              <strong className="yul-next-poll">{nextPoll}</strong>
            </div>
          )}
          <div className="row">
            <span>Poll interval</span>
            <strong>{Math.round((refreshIntervalMs || 0) / 1000)}s</strong>
          </div>
          <div className="row">
            <span>Stale after</span>
            <strong>{Math.round((staleAfterMs || 0) / 60000)} min</strong>
          </div>
          {staleCount > 0 && (
            <div className="row">
              <span>Stale aircraft</span>
              <strong>{staleCount} — positions frozen</strong>
            </div>
          )}
          {notice && <div className="credit">{notice}</div>}
          {error && <div className="credit">{error}</div>}
          <div className="credit">
            Live positions by Flightradar24. Globe by Cesium. Routes are great-circle estimates,
            not historical tracks.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
