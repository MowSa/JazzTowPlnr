'use client';

import { LocateFixed, Plane, Route, X } from 'lucide-react';
import { airportName } from '@/lib/yul-ops/airports';
import { arrivalTiming } from '@/lib/yul-ops/arrival-alert';
import { YUL } from '@/lib/yul-ops/constants';
import {
  flightLabel,
  formatAgo,
  formatClockShort,
  formatDuration,
  formatFpm,
  formatFt,
  formatHeading,
  formatKm,
  formatKt,
} from '@/lib/yul-ops/format';
import { remainingMs, routeProgress } from '@/lib/yul-ops/progress';
import { flightPhase, flightPhaseLabel } from '@/lib/yul-ops/status';
import type { LiveAircraft } from '@/lib/yul-ops/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
}

function VarianceChip({ aircraft }: { aircraft: LiveAircraft }) {
  const timing = arrivalTiming(aircraft);
  if (!timing) return null;
  const label =
    timing.kind === 'on-time'
      ? 'On time vs schedule'
      : `${formatDuration(Math.abs(timing.varianceMs))} ${timing.kind} vs schedule`;
  return (
    <span className={cn('yul-variance', timing.kind !== 'on-time' && `is-${timing.kind}`)}>
      {label}
    </span>
  );
}

export function SelectedFlightPanel({
  aircraft,
  follow,
  now,
  source,
  fetchedAt,
  showRoute,
  onFollow,
  onClose,
  onToggleRoute,
}: {
  aircraft: LiveAircraft | null;
  follow: boolean;
  now: number;
  source: string;
  fetchedAt?: number;
  showRoute: boolean;
  onFollow: (value: boolean) => void;
  onClose: () => void;
  onToggleRoute: () => void;
}) {
  if (!aircraft) return null;
  const inbound = aircraft.direction === 'INBOUND';
  const progress = routeProgress(aircraft, now);
  const phase = flightPhase(aircraft, now);
  const etaMs = aircraft.eta ? Date.parse(aircraft.eta) : Number.NaN;
  const etaZulu = Number.isFinite(etaMs) ? formatClockShort(etaMs) : undefined;
  const etaYul = Number.isFinite(etaMs) ? formatClockShort(etaMs, YUL.timeZone) : undefined;
  const lastMs = aircraft.lastUpdated || fetchedAt;
  return (
    <aside className="yul-right yul-glass" aria-label="Selected flight">
      <div className="yul-right-head">
        <div>
          <h2>{flightLabel(aircraft)}</h2>
          <p>{aircraft.operator || 'Jazz Aviation'}</p>
          {aircraft.aircraftType && <p className="yul-type">{aircraft.aircraftType}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close flight panel"
        >
          <X />
        </Button>
      </div>
      <div className="yul-right-body">
        <Card className="yul-hero mx-4 mt-1 gap-0 bg-[var(--panel-2)] py-4 ring-0">
          <CardContent className="px-4">
            <div className="yul-airports">
              <div>
                <strong>{aircraft.origin || '—'}</strong>
                <small>{airportName(aircraft.origin) || ''}</small>
              </div>
              <div className="yul-route-line" aria-hidden="true">
                <Plane size={15} />
              </div>
              <div className="to">
                <strong>{aircraft.destination || '—'}</strong>
                <small>{airportName(aircraft.destination) || ''}</small>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'mt-3 border-transparent',
                phase === 'arriving' || inbound
                  ? 'bg-[var(--green-soft)] text-[var(--green)]'
                  : 'bg-[var(--blue-soft)] text-[var(--blue)]',
              )}
            >
              {flightPhaseLabel(phase)}
            </Badge>
            {inbound && <VarianceChip aircraft={aircraft} />}
            {etaYul && (
              <div className="yul-times">
                <div>
                  <span>{inbound ? 'Estimated arrival' : 'Estimated'}</span>
                  <strong>{etaYul}</strong>
                  {etaZulu && (
                    <small className="yul-time-zulu">
                      {etaZulu}
                      <span>z</span>
                    </small>
                  )}
                </div>
                {progress.remainingMs !== undefined && remainingMs(aircraft, now) !== undefined && (
                  <div>
                    <span>Time remaining</span>
                    <strong>{formatDuration(progress.remainingMs)}</strong>
                  </div>
                )}
              </div>
            )}
            {(progress.percent !== undefined || aircraft.distanceFromYulKm !== undefined) && (
              <Progress className="mt-3.5 w-full" value={progress.percent ?? 0}>
                <div className="flex w-full text-xs text-muted-foreground">
                  <span>
                    {progress.percent !== undefined
                      ? `${progress.percent}% complete`
                      : 'Distance from YUL'}
                  </span>
                  <span className="ml-auto">
                    {formatKm(aircraft.distanceFromYulKm)}
                    {progress.remainingMs !== undefined && remainingMs(aircraft, now) === undefined
                      ? ` · ${formatDuration(progress.remainingMs)}`
                      : ''}
                  </span>
                </div>
              </Progress>
            )}
          </CardContent>
        </Card>
        <Separator className="mx-4 my-1" />
        <div className="yul-kv">
          <Row label="Aircraft" value={aircraft.aircraftType} />
          <Row label="Registration" value={aircraft.registration} />
          <Row label="Callsign" value={aircraft.callsign} />
          <Row label="Altitude" value={formatFt(aircraft.altitudeFt)} />
          <Row label="Groundspeed" value={formatKt(aircraft.groundSpeedKt)} />
          <Row label="Heading" value={formatHeading(aircraft.headingDeg)} />
          <Row label="Vertical speed" value={formatFpm(aircraft.verticalSpeedFpm)} />
          <Row label="Distance from YUL" value={formatKm(aircraft.distanceFromYulKm)} />
          <Row label="Squawk" value={aircraft.squawk} />
          <Row label="Data source" value={source} />
          <Row label="Last update" value={lastMs ? `${formatAgo(lastMs, now)}` : undefined} />
        </div>
      </div>
      <div className="yul-actions">
        <Button
          type="button"
          className="h-11 w-full"
          variant={follow ? 'secondary' : 'default'}
          onClick={() => onFollow(!follow)}
        >
          <LocateFixed />
          {follow ? 'Stop following' : 'Follow aircraft'}
        </Button>
        <Button
          type="button"
          variant={showRoute ? 'secondary' : 'outline'}
          className="h-11 w-full"
          onClick={onToggleRoute}
        >
          <Route />
          {showRoute ? 'Hide route' : 'Show route'}
        </Button>
      </div>
    </aside>
  );
}
