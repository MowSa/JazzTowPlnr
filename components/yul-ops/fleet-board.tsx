'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from './app-header';
import { OperationsSummary, StatusPill } from './status-pill';
import { SettingsPopover } from './settings-popover';
import { openLiveMapFlight } from './arrival-toasts';
import { useLiveFlights, useNextLivePollAt } from './use-live-flights';
import { isAircraftStale, isFeedStale } from '@/lib/yul-ops/freshness';
import { matchesFilters } from '@/lib/yul-ops/filter';
import {
  flightLabel,
  formatAgo,
  formatClockShort,
  formatFt,
  formatHeading,
  formatKm,
  formatKt,
  nextLiveUpdateLabel,
  routeLabel,
} from '@/lib/yul-ops/format';
import { flightPhase, flightPhaseLabel } from '@/lib/yul-ops/status';
import { YUL } from '@/lib/yul-ops/constants';
import type { FlightFilters, LiveAircraft } from '@/lib/yul-ops/types';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const EMPTY_AIRCRAFT: LiveAircraft[] = [];
const EMPTY_FILTERS: FlightFilters = {
  direction: 'ALL',
  aircraftType: '',
  airport: '',
  registration: '',
  flightNumber: '',
  query: '',
};

type SortKey =
  | 'registration'
  | 'flight'
  | 'type'
  | 'direction'
  | 'phase'
  | 'route'
  | 'altitude'
  | 'speed'
  | 'distance'
  | 'eta'
  | 'updated';

function compareText(a?: string, b?: string) {
  return (a || '—').localeCompare(b || '—', 'en', { numeric: true, sensitivity: 'base' });
}

function compareNum(a?: number, b?: number) {
  const left = Number.isFinite(a) ? (a as number) : Number.POSITIVE_INFINITY;
  const right = Number.isFinite(b) ? (b as number) : Number.POSITIVE_INFINITY;
  return left - right;
}

function sortFleet(aircraft: LiveAircraft[], key: SortKey, dir: 'asc' | 'desc', now: number) {
  const sign = dir === 'asc' ? 1 : -1;
  return [...aircraft].sort((a, b) => {
    let result = 0;
    if (key === 'registration') result = compareText(a.registration || a.id, b.registration || b.id);
    else if (key === 'flight') result = compareText(flightLabel(a), flightLabel(b));
    else if (key === 'type') result = compareText(a.aircraftType, b.aircraftType);
    else if (key === 'direction') result = compareText(a.direction, b.direction);
    else if (key === 'phase') result = compareText(flightPhase(a, now), flightPhase(b, now));
    else if (key === 'route') result = compareText(routeLabel(a.origin, a.destination), routeLabel(b.origin, b.destination));
    else if (key === 'altitude') result = compareNum(a.altitudeFt, b.altitudeFt);
    else if (key === 'speed') result = compareNum(a.groundSpeedKt, b.groundSpeedKt);
    else if (key === 'distance') result = compareNum(a.distanceFromYulKm, b.distanceFromYulKm);
    else if (key === 'eta') result = compareNum(a.eta ? Date.parse(a.eta) : undefined, b.eta ? Date.parse(b.eta) : undefined);
    else result = compareNum(a.lastUpdated, b.lastUpdated);
    return result * sign;
  });
}

function SortHead({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <TableHead>
      <button type="button" className="yul-fleet-sort" onClick={() => onSort(column)}>
        {label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </TableHead>
  );
}

export function FleetBoard() {
  const feed = useLiveFlights();
  const nextPollAt = useNextLivePollAt();
  const [filters, setFilters] = useState<FlightFilters>(EMPTY_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sortKey, setSortKey] = useState<SortKey>('registration');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    document.title = 'Fleet | Jazz @ YUL';
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const aircraft = feed?.aircraft ?? EMPTY_AIRCRAFT;
  const feedStale = Boolean(feed && isFeedStale(feed, now));
  const staleIds = new Set(
    aircraft.filter((item) => feedStale || isAircraftStale(item, feed?.staleAfterMs, now)).map((item) => item.id),
  );
  const staleCount = staleIds.size;
  const status = feed?.status === 'ok' && feedStale ? 'delayed' : feed?.status ?? 'error';
  const visible = useMemo(
    () => sortFleet(aircraft.filter((item) => matchesFilters(item, filters)), sortKey, sortDir, now),
    [aircraft, filters, sortKey, sortDir, now],
  );
  const nextPoll = nextLiveUpdateLabel(nextPollAt, now);
  const searchHits = useMemo(() => {
    const query = filters.query.trim().toUpperCase();
    if (!query) return [];
    return aircraft.filter((item) => matchesFilters(item, { ...EMPTY_FILTERS, query })).slice(0, 8);
  }, [aircraft, filters.query]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of aircraft) {
      const type = item.aircraftType || 'Unknown';
      counts.set(type, (counts.get(type) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [aircraft]);

  const phaseCounts = useMemo(() => {
    const counts = { arriving: 0, taxiing: 0, airborne: 0 };
    for (const item of aircraft) counts[flightPhase(item, now)] += 1;
    return counts;
  }, [aircraft, now]);

  const inbound = aircraft.filter((item) => item.direction === 'INBOUND').length;
  const outbound = aircraft.filter((item) => item.direction === 'OUTBOUND').length;

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'eta' || key === 'updated' || key === 'altitude' ? 'desc' : 'asc');
    }
  }

  return (
    <TooltipProvider>
      <div className="yul-app is-fleet">
        <AppHeader
          query={filters.query}
          hits={searchHits}
          searchOpen={searchOpen}
          summary={<OperationsSummary aircraft={aircraft} />}
          statusPill={
            <StatusPill
              status={status}
              demo={feed?.mode === 'demo'}
              stale={feedStale}
              staleCount={staleCount}
              nextPoll={nextPoll}
              notice={feed?.notice}
              error={feed?.error}
              refreshIntervalMs={feed?.refreshIntervalMs}
              staleAfterMs={feed?.staleAfterMs}
            />
          }
          settings={
            <SettingsPopover
              trails={false}
              showTrails={false}
              notice={feed?.notice}
              error={feed?.error}
              refreshIntervalMs={feed?.refreshIntervalMs}
              staleAfterMs={feed?.staleAfterMs}
              demo={feed?.mode === 'demo'}
              page="fleet"
              onTrails={() => {}}
            />
          }
          onQuery={(value) => {
            setFilters((current) => ({ ...current, query: value }));
            setSearchOpen(true);
          }}
          onSelect={openLiveMapFlight}
          onSearchFocus={() => setSearchOpen(true)}
          onSearchBlur={() => window.setTimeout(() => setSearchOpen(false), 180)}
        />

        <div className="yul-fleet">
          <div className="yul-fleet-intro">
            <div>
              <h1>Observed fleet</h1>
              <p>
                Every Jazz tail currently showing inbound or outbound at YUL, with the fields that
                would not fit in the live-flight list.
              </p>
            </div>
          </div>

          <p className="yul-fleet-summaryline">
            <strong>{aircraft.length}</strong> tails observed
            <span className="sep">·</span>
            <strong>{inbound}</strong> in / <strong>{outbound}</strong> out
            <span className="sep">·</span>
            {typeCounts.map(([type, count]) => `${type} ×${count}`).join(', ')}
            <span className="sep">·</span>
            <strong>{phaseCounts.airborne}</strong> airborne,{' '}
            <strong>{phaseCounts.arriving}</strong> arriving,{' '}
            <strong>{phaseCounts.taxiing}</strong> taxiing
          </p>

          {visible.length ? (
            <Table className="yul-fleet-table">
              <TableHeader>
                <TableRow>
                  <SortHead label="Tail" column="registration" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="Flight" column="flight" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <TableHead>Callsign</TableHead>
                  <SortHead label="Type" column="type" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="Dir" column="direction" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="Phase" column="phase" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="Route" column="route" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="Alt" column="altitude" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="Spd" column="speed" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <TableHead>Hdg</TableHead>
                  <SortHead label="vs YUL" column="distance" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="ETA" column="eta" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <SortHead label="Updated" column="updated" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                  <TableHead>Squawk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => {
                  const phase = flightPhase(item, now);
                  const etaMs = item.eta ? Date.parse(item.eta) : Number.NaN;
                  const inbound = item.direction === 'INBOUND';
                  return (
                    <TableRow
                      key={item.id}
                      className={cn('yul-fleet-row', staleIds.has(item.id) && 'is-stale')}
                      onClick={() => openLiveMapFlight(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openLiveMapFlight(item.id);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Open ${flightLabel(item)} on the live map`}
                    >
                      <TableCell className="font-semibold">{item.registration || '—'}</TableCell>
                      <TableCell>{flightLabel(item)}</TableCell>
                      <TableCell>{item.callsign || '—'}</TableCell>
                      <TableCell>{item.aircraftType || '—'}</TableCell>
                      <TableCell>
                        <span className={inbound ? 'in' : 'out'}>{inbound ? 'In' : 'Out'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`yul-fleet-phase is-${phase}`}>
                          {flightPhaseLabel(phase)}
                        </Badge>
                      </TableCell>
                      <TableCell>{routeLabel(item.origin, item.destination) || '—'}</TableCell>
                      <TableCell>{formatFt(item.altitudeFt) || '—'}</TableCell>
                      <TableCell>{formatKt(item.groundSpeedKt) || '—'}</TableCell>
                      <TableCell>{formatHeading(item.headingDeg) || '—'}</TableCell>
                      <TableCell>{formatKm(item.distanceFromYulKm) || '—'}</TableCell>
                      <TableCell>
                        {Number.isFinite(etaMs) ? (
                          <span className="yul-fleet-eta">
                            {formatClockShort(etaMs, YUL.timeZone)}
                            <small>{formatClockShort(etaMs)}z</small>
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{formatAgo(item.lastUpdated, now)}</TableCell>
                      <TableCell>{item.squawk || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Empty className="yul-fleet-empty">
              <EmptyTitle>No observed Jazz tails</EmptyTitle>
              <EmptyDescription>The live YUL feed has no aircraft in this filter.</EmptyDescription>
            </Empty>
          )}
        </div>

      </div>
    </TooltipProvider>
  );
}
