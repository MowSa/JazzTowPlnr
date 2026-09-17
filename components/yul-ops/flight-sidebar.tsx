'use client';

import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react';
import { FlightCard } from './flight-card';
import { FiltersForm } from './settings-popover';
import type { FlightFilters, LiveAircraft } from '@/lib/yul-ops/types';
import type { FlightSortKey } from '@/lib/yul-ops/filter';
import type { MainTab } from './app-header';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const TAB_TITLE: Record<MainTab, string> = {
  live: 'Live Flights',
  arrivals: 'Arrivals',
  departures: 'Departures',
};

export function FlightSidebar({
  tab,
  inboundCount,
  outboundCount,
  flights,
  staleIds,
  selectedId,
  now,
  collapsed,
  sortKey,
  filters,
  types,
  onTab,
  onSelect,
  onSort,
  onFilters,
  onToggle,
}: {
  tab: MainTab;
  inboundCount: number;
  outboundCount: number;
  flights: LiveAircraft[];
  staleIds: ReadonlySet<string>;
  selectedId: string | null;
  now: number;
  collapsed: boolean;
  sortKey: FlightSortKey;
  filters: FlightFilters;
  types: string[];
  onTab: (tab: MainTab) => void;
  onSelect: (id: string) => void;
  onSort: (key: FlightSortKey) => void;
  onFilters: (next: FlightFilters) => void;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="yul-left is-collapsed yul-glass" aria-label="Flight list collapsed">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label="Expand flight list"
        >
          <PanelLeftOpen />
        </Button>
        <span className="yul-rail-count is-in" title={`${inboundCount} inbound`}>
          <i aria-hidden="true" />
          {inboundCount}
        </span>
        <span className="yul-rail-count is-out" title={`${outboundCount} outbound`}>
          <i aria-hidden="true" />
          {outboundCount}
        </span>
      </aside>
    );
  }

  const activeFilters =
    filters.aircraftType || filters.airport || filters.registration || filters.flightNumber;

  return (
    <aside className="yul-left yul-glass" aria-label="Flight list">
      <div className="yul-left-head">
        <h2>{TAB_TITLE[tab]}</h2>
        <div className="yul-left-tools">
          <select
            className="yul-sort-select"
            value={sortKey}
            onChange={(event) => onSort(event.target.value as FlightSortKey)}
            aria-label="Sort flights"
          >
            <option value="auto">Sort: ETA</option>
            <option value="distance">Sort: Distance</option>
            <option value="altitude">Sort: Altitude</option>
          </select>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant={activeFilters ? 'secondary' : 'outline'}
                  size="icon-sm"
                  aria-label="Filter flights"
                />
              }
            >
              <SlidersHorizontal />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <FiltersForm filters={filters} types={types} onFilters={onFilters} />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onToggle}
            aria-label="Collapse flight list"
          >
            <PanelLeftClose />
          </Button>
        </div>
      </div>
      <ToggleGroup
        className="px-3 pb-3"
        spacing={1}
        value={[tab]}
        onValueChange={(values) => {
          const next = values[0];
          if (next === 'live' || next === 'arrivals' || next === 'departures') onTab(next);
        }}
        aria-label="Views"
      >
        <ToggleGroupItem value="live" className="h-7 rounded-full px-2.5 text-[11px]">
          Live
        </ToggleGroupItem>
        <ToggleGroupItem value="arrivals" className="h-7 rounded-full px-2.5 text-[11px]">
          Arrivals
        </ToggleGroupItem>
        <ToggleGroupItem value="departures" className="h-7 rounded-full px-2.5 text-[11px]">
          Departures
        </ToggleGroupItem>
      </ToggleGroup>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-2 px-2 pb-3">
          {flights.map((item) => (
            <FlightCard
              key={item.id}
              aircraft={item}
              selected={item.id === selectedId}
              stale={staleIds.has(item.id)}
              now={now}
              onSelect={onSelect}
            />
          ))}
          {!flights.length && (
            <Empty className="border-0 p-6">
              <EmptyDescription>No Jazz aircraft in this filter.</EmptyDescription>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
