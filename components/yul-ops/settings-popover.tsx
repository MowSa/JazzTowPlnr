'use client';

import { ArrowLeft, LayoutList, Map } from 'lucide-react';
import { previewArrivalToast } from './arrival-toasts';
import type { FlightFilters } from '@/lib/yul-ops/types';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const EMPTY_FILTERS: FlightFilters = {
  direction: 'ALL',
  aircraftType: '',
  airport: '',
  registration: '',
  flightNumber: '',
  query: '',
};

export function FiltersForm({
  filters,
  types,
  onFilters,
}: {
  filters: FlightFilters;
  types: string[];
  onFilters: (next: FlightFilters) => void;
}) {
  const dirty =
    filters.aircraftType || filters.airport || filters.registration || filters.flightNumber;
  return (
    <FieldGroup className="gap-3">
      <Field>
        <FieldLabel htmlFor="yul-filter-type">Aircraft type</FieldLabel>
        <NativeSelect
          id="yul-filter-type"
          className="w-full"
          value={filters.aircraftType || 'all'}
          aria-label="Aircraft type"
          onChange={(event) =>
            onFilters({
              ...filters,
              aircraftType: event.target.value === 'all' ? '' : event.target.value,
            })
          }
        >
          <NativeSelectOption value="all">All types</NativeSelectOption>
          {types.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {type}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="yul-filter-airport">Origin / destination</FieldLabel>
        <Input
          id="yul-filter-airport"
          value={filters.airport}
          onChange={(event) => onFilters({ ...filters, airport: event.target.value })}
          placeholder="YYZ, YOW, CYUL…"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="yul-filter-reg">Registration</FieldLabel>
        <Input
          id="yul-filter-reg"
          value={filters.registration}
          onChange={(event) => onFilters({ ...filters, registration: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="yul-filter-flight">Flight number</FieldLabel>
        <Input
          id="yul-filter-flight"
          value={filters.flightNumber}
          onChange={(event) => onFilters({ ...filters, flightNumber: event.target.value })}
        />
      </Field>
      {dirty ? (
        <Button
          type="button"
          variant="ghost"
          className="justify-start px-1"
          onClick={() => onFilters({ ...EMPTY_FILTERS, direction: filters.direction, query: filters.query })}
        >
          Clear filters
        </Button>
      ) : null}
    </FieldGroup>
  );
}

export function SettingsPopover({
  trails,
  notice,
  error,
  refreshIntervalMs,
  staleAfterMs,
  onTrails,
  showTrails = true,
  demo = false,
  page = 'map',
}: {
  trails: boolean;
  notice?: string;
  error?: string;
  refreshIntervalMs?: number;
  staleAfterMs?: number;
  onTrails: (value: boolean) => void;
  showTrails?: boolean;
  demo?: boolean;
  page?: 'map' | 'fleet';
}) {
  return (
    <FieldGroup className="gap-3">
      {showTrails && (
        <Field orientation="horizontal" className="items-center justify-between">
          <Label htmlFor="yul-filter-trails">Origin trails</Label>
          <Switch
            id="yul-filter-trails"
            checked={trails}
            onCheckedChange={(checked) => onTrails(Boolean(checked))}
          />
        </Field>
      )}
      {showTrails && (
        <FieldDescription>
          Routes are great-circle arcs from the known origin airport through the current position
          to the destination. They are not a complete historical ADS-B track.
        </FieldDescription>
      )}
      <Separator />
      <div className="grid gap-1">
        {page === 'map' ? (
          <a href="/yul/fleet" className={cn(buttonVariants({ variant: 'ghost' }), 'justify-start')}>
            <LayoutList />
            Fleet board
          </a>
        ) : (
          <a href="/yul" className={cn(buttonVariants({ variant: 'ghost' }), 'justify-start')}>
            <Map />
            Live map
          </a>
        )}
        <a href="/" className={cn(buttonVariants({ variant: 'ghost' }), 'justify-start')}>
          <ArrowLeft />
          JazzTow operations console
        </a>
      </div>
      {demo && (
        <Button type="button" variant="outline" onClick={previewArrivalToast}>
          Preview arrival toast
        </Button>
      )}
      <FieldDescription>
        Poll interval {Math.round((refreshIntervalMs || 0) / 1000)}s · stale after{' '}
        {Math.round((staleAfterMs || 0) / 60000)} min
      </FieldDescription>
      {notice && <FieldDescription>{notice}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </FieldGroup>
  );
}
