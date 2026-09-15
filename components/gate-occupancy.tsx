'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Search,
  Clock3,
  PlaneLanding,
  PlaneTakeoff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  type AirportPlan,
  type GateOccupancy,
  type OccupancyKind,
  type OccupancySpan,
  clipOccupancy,
  occupancyConflicts,
  occupancyDurationLabel,
  occupancyFlights,
  occupancyKindLabel,
  occupancyLanes,
  occupancyRowGate,
  sortGates,
} from '@/lib/gates';
import { timeLabel } from '@/lib/tows';
const carriers = [
  'AC',
  'AAL',
  'UAL',
  'DAL',
  'POE',
  'WJA',
  'AIE',
  'TSC',
  'PVL',
  'CRQ',
  'FLE',
];
const TIME_SPANS = [5, 15, 30, 60] as const;
type TimeSpan = (typeof TIME_SPANS)[number];
const SLOT_PX = 32;
const GATE_COL_PX = 108;
const DAY_END_PAD = 48;
const FULL_LABEL_PX = 118;
const FLIGHT_LABEL_PX = 54;
const LANE_PX = 22;
const ROW_PAD = 4;
function scaleFor(span: TimeSpan) {
  const slotPx = SLOT_PX;
  const hourPx = (60 / span) * slotPx;
  const dayPx = hourPx * 24;
  return { span, slotPx, hourPx, dayPx, labelEvery: labelStep(span, hourPx) };
}
function labelStep(span: TimeSpan, hourPx: number) {
  const minPx = 56;
  for (const step of [60, 30, 15, 5] as const) {
    if (step < span) continue;
    if ((step / 60) * hourPx >= minPx) return step;
  }
  return 60;
}
function dayOffsetPx(timestamp: number, date: string, dayPx: number) {
  const start = Date.parse(date + 'T00:00:00Z');
  return ((timestamp - start) / 86400000) * dayPx;
}
function spanTicks(scale: ReturnType<typeof scaleFor>) {
  const ticks: { minutes: number; left: number; label: string; hour: boolean }[] =
    [];
  const shortHour = scale.span === 60 && scale.hourPx < 52;
  for (let minutes = 0; minutes <= 24 * 60; minutes += scale.span) {
    if (minutes % scale.labelEvery !== 0 && minutes !== 24 * 60) continue;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    ticks.push({
      minutes,
      left: (minutes / 60) * scale.hourPx,
      label:
        shortHour && m === 0
          ? String(h).padStart(2, '0')
          : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      hour: m === 0,
    });
  }
  return ticks;
}
function spanTimes(span: OccupancySpan, date: string) {
  return `${timeLabel(span.start, date)} → ${timeLabel(span.end, date)}`;
}
function occupancyNote(item: GateOccupancy, span: OccupancySpan) {
  return (
    [
      span.block === 'overnight'
        ? 'Stayed on gate overnight (departure before 09:00)'
        : '',
      span.block === 'tow-in' && item.towedIn
        ? 'Towed in · 1h before departure'
        : '',
      span.block === 'tow-in' && !item.towedIn
        ? 'Previous-day arrival · 1h tow in before a departure at or after 09:00'
        : '',
      span.block === 'tow-out' ? 'Towed out · 30m after arrival' : '',
      span.continued === 'end' || span.continued === 'both'
        ? 'Continues after midnight'
        : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'Scheduled occupancy from the airport workbook'
  );
}
function OccupancyKindIcon({
  kind,
  size = 12,
}: {
  kind: OccupancyKind;
  size?: number;
}) {
  if (kind === 'arrival') return <PlaneLanding size={size} />;
  if (kind === 'departure') return <PlaneTakeoff size={size} />;
  return (
    <span className="gantt-kind-turn">
      <PlaneLanding size={Math.max(10, size - 1)} />
      <PlaneTakeoff size={Math.max(10, size - 1)} />
    </span>
  );
}
function CarrierLogo({
  src,
  size,
  round = false,
}: {
  src: string;
  size: number;
  round?: boolean;
}) {
  return (
    <span
      className={`gantt-carrier-mark gantt-carrier-logo${round ? ' is-round' : ''}`}
      style={{
        width: size,
        height: size,
        ...(round
          ? {
              background: '#fff',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'inline-flex',
            }
          : { display: 'inline-flex' }),
      }}
      aria-hidden
    >
      <img src={src} alt="" width={size} height={size} draggable={false} />
    </span>
  );
}
function CarrierMark({
  carrier,
  size = 12,
}: {
  carrier: string;
  size?: number;
}) {
  const logoSize = Math.max(size + 2, 14);
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 12 12',
    className: 'gantt-carrier-mark',
    'aria-hidden': true as const,
  };
  switch (carrier) {
    case 'AC':
      return <CarrierLogo src="/carriers/ac.png" size={logoSize} round />;
    case 'AAL':
      return <CarrierLogo src="/carriers/aal.png" size={logoSize} />;
    case 'UAL':
      return <CarrierLogo src="/carriers/ual.png" size={logoSize} round />;
    case 'DAL':
      return <CarrierLogo src="/carriers/dal.png" size={logoSize} />;
    case 'POE':
      return <CarrierLogo src="/carriers/poe.png" size={logoSize} round />;
    case 'WJA':
      return <CarrierLogo src="/carriers/wja.png" size={logoSize} />;
    case 'AIE':
      return <CarrierLogo src="/carriers/aie.png" size={logoSize} round />;
    case 'TSC':
      return <CarrierLogo src="/carriers/tsc.png" size={logoSize} round />;
    case 'PVL':
      return (
        <svg {...props}>
          <path
            fill="currentColor"
            d="M2.1 9.7C3.3 6.2 4.55 3.7 6 2.05 7.45 3.7 8.7 6.2 9.9 9.7 7.85 8.7 6.85 8.45 6 8.45c-.85 0-1.85.25-3.9 1.25Z"
          />
        </svg>
      );
    case 'CRQ':
      return (
        <svg {...props}>
          <path
            fill="currentColor"
            d="M1.9 8.35C1.9 5.6 3.8 2.55 6 1.5c2.2 1.05 4.1 4.1 4.1 6.85-1.25-.85-2.55-1.25-4.1-1.25s-2.85.4-4.1 1.25Z"
          />
        </svg>
      );
    case 'FLE':
      return (
        <svg {...props}>
          <path
            fill="currentColor"
            d="M2.9 2.15h4.3c1.85 0 3 1.15 3 2.7 0 1.25-.75 2.2-2 2.55l2.05 2.75H8.2L6.45 7.4H4.6v2.45H2.9V2.15Zm1.7 1.6v2.1h2.25c.85 0 1.35-.4 1.35-1.05s-.5-1.05-1.35-1.05H4.6Z"
          />
        </svg>
      );
    default:
      return null;
  }
}
function barTitle(o: GateOccupancy, date: string, span: OccupancySpan) {
  return [
    occupancyKindLabel(span.kind),
    `Gate ${o.gate}`,
    occupancyFlights(o),
    o.airline,
    occupancyDurationLabel(span),
    spanTimes(span, date),
  ]
    .filter(Boolean)
    .join(' · ');
}
function OccupancyBar({
  item,
  date,
  span,
  dayPx,
  lane,
  conflict,
  selected,
  onSelect,
}: {
  item: GateOccupancy;
  date: string;
  span: OccupancySpan;
  dayPx: number;
  lane: number;
  conflict: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const leftPx = dayOffsetPx(span.start, date, dayPx);
  const widthPx = Math.max(10, dayOffsetPx(span.end, date, dayPx) - leftPx);
  const label = occupancyFlights(item);
  const duration = occupancyDurationLabel(span);
  const details = barTitle(item, date, span);
  const truncated = widthPx < FULL_LABEL_PX;
  const compact = widthPx < FLIGHT_LABEL_PX;
  const bar = (
    <button
      className={`gantt-bar${span.estimated ? ' is-estimated' : ''}${conflict ? ' is-conflict' : ''}${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}`}
      data-carrier={carriers.includes(item.airline) ? item.airline : 'OTH'}
      data-kind={span.kind}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        top: `${ROW_PAD + lane * LANE_PX}px`,
      }}
      aria-label={details}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="gantt-bar-icon" aria-hidden>
        <CarrierMark carrier={item.airline} />
        <OccupancyKindIcon kind={span.kind} />
      </span>
      {!compact && (
        <span className="gantt-bar-copy">
          <b>{label}</b>
          {!truncated && <small>{duration}</small>}
        </span>
      )}
    </button>
  );
  return (
    <Tooltip>
      <TooltipTrigger render={bar} />
      <TooltipContent side="top" className="gantt-tooltip">
        <strong>{label || 'Flight unavailable'}</strong>
        <span>
          {occupancyKindLabel(span.kind)} · Gate {item.gate}
          {item.airline ? ` · ${item.airline}` : ''}
          {conflict ? ' · Overlap' : ''}
        </span>
        <span>
          {spanTimes(span, date)} · {duration}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
function OccupancyInspector({
  item,
  date,
  conflict,
}: {
  item: GateOccupancy;
  date: string;
  conflict: boolean;
}) {
  const span = clipOccupancy(item, date);
  if (!span) return null;
  return (
    <div className="gantt-inspector">
      <div>
        <small>GATE {item.gate}</small>
        <strong>
          <CarrierMark carrier={item.airline} size={14} />
          <OccupancyKindIcon kind={span.kind} size={15} />
          {occupancyFlights(item) || 'Flight unavailable'}
        </strong>
        <p>
          {occupancyKindLabel(span.kind)}
          {item.airline ? ` · ${item.airline}` : ''}
          {conflict ? ' · Overlaps another occupancy' : ''}
        </p>
      </div>
      <div>
        <small>ON GATE</small>
        <strong className="mono">{spanTimes(span, date)}</strong>
        <p>{occupancyDurationLabel(span)}</p>
      </div>
      <div>
        <small>SOURCE</small>
        <strong>
          {item.sheet} · row {item.row}
        </strong>
        <p>{occupancyNote(item, span)}</p>
      </div>
    </div>
  );
}
export function GateOccupancy({
  airport,
  date,
  loading,
  error,
  upload,
}: {
  airport: AirportPlan | null;
  date: string;
  loading: boolean;
  error: string;
  upload: () => void;
}) {
  const [search, setSearch] = useState('');
  const [airline, setAirline] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [timeSpan, setTimeSpan] = useState<TimeSpan>(15);
  const wrapRef = useRef<HTMLDivElement>(null);
  const keepTime = useRef<number | null>(null);
  const [trackPx, setTrackPx] = useState(0);
  const scale = useMemo(() => {
    const base = scaleFor(timeSpan);
    if (trackPx <= base.dayPx) return base;
    const hourPx = trackPx / 24;
    return {
      ...base,
      hourPx,
      dayPx: hourPx * 24,
      slotPx: hourPx * (timeSpan / 60),
      labelEvery: labelStep(timeSpan, hourPx),
    };
  }, [timeSpan, trackPx]);
  const ticks = useMemo(() => spanTicks(scale), [scale]);
  const day = airport?.date || date;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (airport?.occupancies || []).filter((o) => {
      if (airline && o.airline !== airline) return false;
      if (!q) return true;
      return `${o.gate} ${o.airline} ${o.arrFlight} ${o.depFlight}`
        .toLowerCase()
        .includes(q);
    });
  }, [airport, airline, search]);
  const gates = useMemo(
    () =>
      sortGates([
        ...new Set(
          visible
            .filter((o) => clipOccupancy(o, day))
            .map((o) => occupancyRowGate(o.gate)),
        ),
      ]),
    [visible, day],
  );
  const conflicts = useMemo(() => {
    const ids = new Set<string>();
    for (const gate of gates) {
      for (const id of occupancyConflicts(
        visible.filter((o) => occupancyRowGate(o.gate) === gate),
        day,
      ))
        ids.add(id);
    }
    return ids;
  }, [visible, gates, day]);
  const airlines = useMemo(
    () =>
      [...new Set((airport?.occupancies || []).map((o) => o.airline).filter(Boolean))]
        .sort(
          (a, b) =>
            (carriers.includes(a) ? carriers.indexOf(a) : 99) -
              (carriers.includes(b) ? carriers.indexOf(b) : 99) ||
            a.localeCompare(b),
        ),
    [airport],
  );
  const now = useMemo(() => {
    if (!day) return null;
    const n = new Date();
    const local = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    if (local !== day) return null;
    return Date.parse(
      `${day}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:00Z`,
    );
  }, [day]);
  const selectedItem = visible.find((o) => o.id === selected) || null;
  const plotted = visible.filter((o) => clipOccupancy(o, day)).length;
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () =>
      setTrackPx(Math.max(0, el.clientWidth - GATE_COL_PX - DAY_END_PAD));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [airport]);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    const t = keepTime.current;
    if (!el || t === null) return;
    el.scrollLeft = t * scale.dayPx - el.clientWidth * 0.35;
    keepTime.current = null;
  }, [scale]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 16;
      if (event.deltaMode === 2) dy *= el.clientHeight;
      if (event.shiftKey) {
        el.scrollLeft += dy || event.deltaX;
        event.preventDefault();
        return;
      }
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const page = el.closest('.console-main');
      const scroller =
        page && page.scrollHeight > page.clientHeight + 1
          ? page
          : document.scrollingElement;
      if (!(scroller instanceof HTMLElement)) return;
      event.preventDefault();
      scroller.scrollTop += dy;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [airport]);
  const changeSpan = (next: TimeSpan) => {
    const el = wrapRef.current;
    if (el && next !== timeSpan) {
      keepTime.current =
        (el.scrollLeft + el.clientWidth * 0.35) / Math.max(1, scale.dayPx);
    }
    setTimeSpan(next);
  };
  return (
    <div className="gate-workspace gantt-view">
      {error && (
        <div role="alert" className="message error">
          <AlertTriangle size={18} />
          <div>
            <strong>We couldn’t read the airport workbook.</strong>
            <p>{error}</p>
          </div>
          <Button variant="outline" onClick={upload}>
            Try another file
          </Button>
        </div>
      )}
      {!airport ? (
        <section className="gate-empty panel">
          <FileSpreadsheet size={30} />
          <h2>No airport plan loaded</h2>
          <p>
            Upload the daily airport planning workbook to see gate occupancy on
            a timeline. Rows are gates; bars show the airline, flight and how
            long the stand is occupied.
          </p>
          <Button
            className="button primary"
            onClick={upload}
            disabled={loading}
          >
            <Upload size={16} />
            {loading ? 'Reading airport assignments…' : 'Upload airport plan'}
          </Button>
          <small>
            Expected columns: Arr Flight, Arr Time, Dep Flight, Dep Time and
            Gate.
          </small>
        </section>
      ) : (
        <>
          <div className="gate-source-bar">
            <div>
              <FileSpreadsheet size={17} />
              <span>
                <strong>{airport.name}</strong>
                <small>
                  {airport.occupancies.length} gate stays · {day || 'Date unavailable'} ·
                  Read in this browser
                </small>
              </span>
            </div>
            <Button
              className="button"
              variant="outline"
              onClick={upload}
              disabled={loading}
            >
              <Upload size={15} />
              {loading ? 'Reading workbook…' : 'Replace workbook'}
            </Button>
          </div>
          <div className="gate-metric-strip">
            <span>
              <strong>{gates.length.toString().padStart(2, '0')}</strong> gates
            </span>
            <span>
              <strong>{plotted}</strong> occupancies
            </span>
            <span>
              <strong>{airlines.length}</strong> airlines
            </span>
            <span>
              <strong className={conflicts.size ? 'text-danger' : ''}>
                {conflicts.size}
              </strong>{' '}
              overlaps
            </span>
            <p>
              Previous-day arrivals stay overnight only if they depart before
              09:00.
            </p>
          </div>
          {selectedItem && (
            <OccupancyInspector
              item={selectedItem}
              date={day}
              conflict={conflicts.has(selectedItem.id)}
            />
          )}
          <section className="panel">
            <div className="gantt-toolbar">
              <div
                className="gantt-scale"
                role="radiogroup"
                aria-label="Timeline time span"
              >
                {TIME_SPANS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    role="radio"
                    aria-checked={timeSpan === minutes}
                    className={timeSpan === minutes ? 'is-active' : ''}
                    onClick={() => changeSpan(minutes)}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
              <div className="gantt-airlines" aria-label="Filter by airline">
                <button
                  className={!airline ? 'is-active' : ''}
                  onClick={() => setAirline('')}
                >
                  All
                </button>
                {airlines.map((code) => (
                  <button
                    key={code}
                    className={airline === code ? 'is-active' : ''}
                    data-carrier={code}
                    onClick={() => setAirline(code === airline ? '' : code)}
                  >
                    <CarrierMark carrier={code} size={11} />
                    {code}
                  </button>
                ))}
              </div>
              <div className="search-box">
                <Search size={15} />
                <Input
                  aria-label="Search gate occupancies"
                  placeholder="Gate, airline or flight"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="gantt-legend">
              <span className="gantt-legend-item">
                <OccupancyKindIcon kind="arrival" /> Arrival only
              </span>
              <span className="gantt-legend-item">
                <OccupancyKindIcon kind="departure" /> Departure only
              </span>
              <span className="gantt-legend-item">
                <OccupancyKindIcon kind="turn" /> Turn
              </span>
              <span>Striped bars are estimated tow blocks</span>
            </div>
            <div className="gantt-wrapper" ref={wrapRef}>
              <TooltipProvider delay={180}>
                <div
                  className="gate-gantt"
                  style={
                    {
                      '--gantt-hour': `${scale.hourPx}px`,
                      '--gantt-slot': `${scale.slotPx}px`,
                      '--gantt-day': `${scale.dayPx}px`,
                    } as React.CSSProperties
                  }
                  aria-label={`Gate occupancy timeline for ${day || 'the airport plan'}`}
                >
                  <div className="timeline-axis">
                    <div>GATE</div>
                    <div className="timeline-hours">
                      {ticks.map((tick) => (
                        <span
                          key={tick.minutes}
                          className={`${tick.minutes === 0 ? 'is-start' : tick.minutes === 24 * 60 ? 'is-end' : ''}${tick.hour ? '' : ' is-minor'}`}
                          style={{ left: `${tick.left}px` }}
                        >
                          {tick.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {gates.map((gate) => {
                    const items = visible.filter(
                      (o) => occupancyRowGate(o.gate) === gate,
                    );
                    const aliases = sortGates([
                      ...new Set(items.map((o) => o.gate).filter((g) => g !== gate)),
                    ]);
                    const lanes = occupancyLanes(items, day);
                    const laneCount =
                      Math.max(0, ...[...lanes.values()], 0) +
                      (lanes.size ? 1 : 0);
                    return (
                      <div
                        className="gantt-row"
                        key={gate}
                        style={{
                          minHeight: `${Math.max(28, ROW_PAD * 2 + laneCount * LANE_PX)}px`,
                        }}
                      >
                        <div className="gantt-gate">
                          <strong className="mono">{gate}</strong>
                          {aliases.length > 0 && (
                            <small className="mono">{aliases.join(' · ')}</small>
                          )}
                        </div>
                        <div className="timeline-track gantt-track">
                          {now !== null && (
                            <span
                              className="gantt-now"
                              style={{
                                left: `${dayOffsetPx(now, day, scale.dayPx)}px`,
                              }}
                            />
                          )}
                          {items.map((o) => {
                            const span = clipOccupancy(o, day);
                            if (!span) return null;
                            return (
                              <OccupancyBar
                                key={o.id}
                                item={o}
                                date={day}
                                span={span}
                                dayPx={scale.dayPx}
                                lane={lanes.get(o.id) || 0}
                                conflict={conflicts.has(o.id)}
                                selected={selected === o.id}
                                onSelect={() =>
                                  setSelected((id) =>
                                    id === o.id ? null : o.id,
                                  )
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {!gates.length && (
                    <div className="empty-state">
                      {airport.occupancies.length
                        ? 'No gate stays match this airline and search.'
                        : 'No dated gate occupancies were found in this workbook.'}
                    </div>
                  )}
                </div>
              </TooltipProvider>
            </div>
            <div className="panel-footer">
              <div className="review-progress">
                <Clock3 size={16} />
                <span>
                  {plotted} occupancies on {day || 'an unspecified date'}
                </span>
              </div>
              <span>
                Tow in before departure is 1h. Arrival then tow off is 30m.
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
