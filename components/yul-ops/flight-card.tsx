'use client';

import { PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { formatDuration, formatFt, flightLabel } from '@/lib/yul-ops/format';
import { routeProgress } from '@/lib/yul-ops/progress';
import { flightPhase, flightPhaseLabel } from '@/lib/yul-ops/status';
import type { LiveAircraft } from '@/lib/yul-ops/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PHASE_CLASS = {
  arriving: 'is-arriving',
  airborne: 'is-airborne',
  taxiing: 'is-taxiing',
} as const;

export function FlightCard({
  aircraft,
  selected,
  stale,
  now,
  onSelect,
}: {
  aircraft: LiveAircraft;
  selected: boolean;
  stale: boolean;
  now: number;
  onSelect: (id: string) => void;
}) {
  const inbound = aircraft.direction === 'INBOUND';
  const climb = (aircraft.verticalSpeedFpm ?? 0) >= 0;
  const progress = routeProgress(aircraft, now);
  const phase = flightPhase(aircraft, now);
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'yul-flight grid h-auto w-full items-start whitespace-normal rounded-xl p-2.5 text-left',
        selected && 'is-selected',
      )}
      onClick={() => onSelect(aircraft.id)}
    >
      <span className={`yul-flight-icon ${inbound ? 'is-in' : 'is-out'}`} aria-hidden="true">
        {inbound ? <PlaneLanding size={16} /> : <PlaneTakeoff size={16} />}
      </span>
      <div>
        <div className="yul-flight-code">
          {flightLabel(aircraft)}
          <small>{aircraft.aircraftType || ''}</small>
        </div>
        <div className="yul-flight-route">
          {aircraft.origin || '—'} → {aircraft.destination || '—'}
        </div>
        <div className="yul-flight-meta">
          <span>
            {climb ? '↑' : '↓'} {formatFt(aircraft.altitudeFt) || '—'}
          </span>
          {!stale && inbound && progress.remainingKm !== undefined && (
            <span>
              {formatDuration(progress.remainingMs) ? `${formatDuration(progress.remainingMs)} · ` : ''}
              {Math.round(progress.remainingKm)} km
            </span>
          )}
        </div>
      </div>
      <Badge variant="outline" title={stale ? 'Stale data — position frozen; arrival notices suppressed' : undefined} className={cn('yul-phase self-center justify-self-end', stale ? 'text-muted-foreground' : PHASE_CLASS[phase])}>
        {stale ? 'Stale' : flightPhaseLabel(phase)}
      </Badge>
    </Button>
  );
}
