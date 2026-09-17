'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { AppHeader, type MainTab } from './app-header';
import { FlightSidebar } from './flight-sidebar';
import { CesiumGlobe, type GlobeHandle } from './cesium-globe';
import { FollowPill, MapControls, ViewSwitch } from './map-controls';
import { SelectedFlightPanel } from './selected-flight-panel';
import { OperationsSummary, StatusPill } from './status-pill';
import { SettingsPopover } from './settings-popover';
import { useLiveFlights, useNextLivePollAt } from './use-live-flights';
import { isAircraftStale, isFeedStale } from '@/lib/yul-ops/freshness';
import { matchesFilters, sortFlights, type FlightSortKey } from '@/lib/yul-ops/filter';
import { flightLabel, nextLiveUpdateLabel } from '@/lib/yul-ops/format';
import type { FlightFilters, LiveAircraft } from '@/lib/yul-ops/types';
import { consumePendingFlight } from './arrival-toasts';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';

const EMPTY_AIRCRAFT: LiveAircraft[] = [];

const EMPTY_FILTERS: FlightFilters = {
  direction: 'ALL',
  aircraftType: '',
  airport: '',
  registration: '',
  flightNumber: '',
  query: '',
};

export function OperationsDashboard() {
  const feed = useLiveFlights();
  const nextPollAt = useNextLivePollAt();
  const globe = useRef<GlobeHandle>(null);
  const [tab, setTab] = useState<MainTab>('live');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [trails, setTrails] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [sceneMode, setSceneMode] = useState<'2D' | '3D'>('3D');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<FlightFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<FlightSortKey>('auto');
  const [now, setNow] = useState(() => Date.now());
  // Rail is open by default on wide screens, an icon strip below 1600px.
  // A manual toggle overrides the width-driven default until the next toggle.
  const narrow = useMediaQuery('(max-width: 1599px)');
  const [railPref, setRailPref] = useState<boolean | null>(null);
  const leftCollapsed = railPref ?? narrow;

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setSearchOpen(false);
    if (id) setFilters((current) => ({ ...current, query: '' }));
    else setFollow(false);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const pending = consumePendingFlight();
    const handoff = pending ? window.setTimeout(() => select(pending), 0) : null;
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id) select(id);
    };
    window.addEventListener('yul-select-flight', onSelect);
    return () => {
      if (handoff !== null) window.clearTimeout(handoff);
      window.removeEventListener('yul-select-flight', onSelect);
    };
  }, [select]);

  const aircraft = feed?.aircraft ?? EMPTY_AIRCRAFT;
  const feedStale = Boolean(feed && isFeedStale(feed, now));
  const staleIds = useMemo(
    () =>
      new Set(
        aircraft
          .filter((item) => feedStale || isAircraftStale(item, feed?.staleAfterMs, now))
          .map((item) => item.id),
      ),
    [aircraft, feedStale, feed?.staleAfterMs, now],
  );
  const staleCount = staleIds.size;
  const status = feed?.status === 'ok' && feedStale ? 'delayed' : feed?.status ?? 'error';
  const inboundCount = aircraft.filter((item) => item.direction === 'INBOUND').length;
  const outboundCount = aircraft.filter((item) => item.direction === 'OUTBOUND').length;
  const visible = useMemo(
    () => sortFlights(aircraft.filter((item) => matchesFilters(item, filters)), sortKey),
    [aircraft, filters, sortKey],
  );
  const nextPoll = nextLiveUpdateLabel(nextPollAt, now);
  const selected = visible.find((item) => item.id === selectedId) ?? null;
  const types = [...new Set(aircraft.map((item) => item.aircraftType).filter(Boolean))] as string[];
  const searchHits = useMemo(() => {
    const query = filters.query.trim().toUpperCase();
    if (!query) return [];
    return aircraft.filter((item) => matchesFilters(item, { ...EMPTY_FILTERS, query })).slice(0, 8);
  }, [aircraft, filters.query]);

  // Esc dismisses the flight card (and follow), like a map popover.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, select]);

  function changeTab(next: MainTab) {
    setTab(next);
    if (next === 'arrivals') setFilters((current) => ({ ...current, direction: 'INBOUND' }));
    else if (next === 'departures') setFilters((current) => ({ ...current, direction: 'OUTBOUND' }));
    else setFilters((current) => ({ ...current, direction: 'ALL' }));
  }

  return (
    <TooltipProvider>
      <div className="yul-app">
        <div className="yul-map">
          <CesiumGlobe
            ref={globe}
            aircraft={visible}
            feed={feed}
            selectedId={selected?.id ?? null}
            follow={follow && Boolean(selected)}
            trails={trails}
            showRoute={showRoute}
            onSelect={select}
          />
          <MapControls
            onHome={() => {
              setFollow(false);
              globe.current?.flyYul();
            }}
            onGlobe={() => {
              setFollow(false);
              globe.current?.flyHome();
            }}
            onZoomIn={() => globe.current?.zoomIn()}
            onZoomOut={() => globe.current?.zoomOut()}
          />
          <ViewSwitch
            mode={sceneMode}
            onMode={(mode) => {
              setFollow(false);
              setSceneMode(mode);
              globe.current?.setSceneMode(mode);
            }}
          />
          {follow && selected && (
            <FollowPill label={flightLabel(selected)} onStop={() => setFollow(false)} />
          )}
        </div>

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
              trails={trails}
              notice={feed?.notice}
              error={feed?.error}
              refreshIntervalMs={feed?.refreshIntervalMs}
              staleAfterMs={feed?.staleAfterMs}
              demo={feed?.mode === 'demo'}
              page="map"
              onTrails={setTrails}
            />
          }
          onQuery={(value) => {
            setFilters((current) => ({ ...current, query: value }));
            setSearchOpen(true);
          }}
          onSelect={select}
          onSearchFocus={() => setSearchOpen(true)}
          onSearchBlur={() => window.setTimeout(() => setSearchOpen(false), 180)}
        />

        <FlightSidebar
          tab={tab}
          inboundCount={inboundCount}
          outboundCount={outboundCount}
          flights={visible}
          staleIds={staleIds}
          selectedId={selected?.id ?? null}
          now={now}
          collapsed={leftCollapsed}
          sortKey={sortKey}
          filters={filters}
          types={types}
          onTab={changeTab}
          onSelect={select}
          onSort={setSortKey}
          onFilters={setFilters}
          onToggle={() => setRailPref(!leftCollapsed)}
        />

        {leftCollapsed && (
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="yul-sidebar-toggle"
            onClick={() => setRailPref(false)}
            aria-label="Expand flight list"
          >
            <PanelLeftOpen />
          </Button>
        )}

        <SelectedFlightPanel
          aircraft={selected}
          follow={follow && Boolean(selected)}
          now={now}
          source={`${feed?.mode === 'demo' ? 'Demo feed' : 'Flightradar24'}${selected && (feedStale || isAircraftStale(selected, feed?.staleAfterMs, now)) ? ' · STALE — position frozen' : ''}`}
          fetchedAt={feed?.fetchedAt}
          showRoute={showRoute}
          onFollow={setFollow}
          onClose={() => select(null)}
          onToggleRoute={() => setShowRoute((value) => !value)}
        />
      </div>
    </TooltipProvider>
  );
}
