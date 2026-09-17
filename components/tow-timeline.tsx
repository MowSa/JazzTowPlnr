'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, PlaneLanding, PlaneTakeoff, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type Move, type Turn, type Report, timeLabel } from '@/lib/tows';
import { stationWallClockStamp, towStatus, statusNames } from '@/lib/console';

function scrollTimelineToNow(wrap: HTMLDivElement | null, leftPct: number) {
  if (!wrap) return;
  const hours = wrap.querySelector('.timeline-hours');
  if (!(hours instanceof HTMLElement)) return;
  const left = hours.offsetLeft + (hours.offsetWidth * leftPct) / 100;
  wrap.scrollLeft = Math.max(0, left - wrap.clientWidth * 0.35);
}
/** Display coordinates only: schedule timestamps already encode station wall time. */
export function TowTimeline({
  report,
  moves,
  pending,
  onFin,
  onMove,
  onReview,
  selectedFin,
}: {
  report: Report;
  moves: Move[];
  pending: Turn[];
  onFin: (fin: string) => void;
  onMove: (move: Move) => void;
  onReview: () => void;
  selectedFin: string | null;
}) {
  const start = Date.parse(report.date + 'T00:00:00Z');
  const position = (timestamp: number) =>
    Math.max(0, Math.min(100, ((timestamp - start) / 86400000) * 100));
  const pickup = (m: Move) =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(m.pickup)
      ? Date.parse(`${report.date}T${m.pickup}:00Z`)
      : null;
  const fins = [
    ...new Set([...moves.map((m) => m.fin), ...pending.map((t) => t.fin)]),
  ];
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrolledNow = useRef(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNowMs(Date.now());
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);
  const now = useMemo(
    () =>
      report.date
        ? stationWallClockStamp(nowMs, report.station || '', report.date)
        : null,
    [nowMs, report.date, report.station],
  );
  function scrollToNow() {
    if (now === null) return;
    scrollTimelineToNow(wrapRef.current, position(now));
  }
  useLayoutEffect(() => {
    if (now === null || scrolledNow.current) return;
    scrolledNow.current = true;
    const pct = Math.max(0, Math.min(100, ((now - start) / 86400000) * 100));
    scrollTimelineToNow(wrapRef.current, pct);
  }, [now, start, fins.length]);
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
  }, [fins.length]);
  return (
    <div className="timeline-wrapper" ref={wrapRef}>
      <div className="timeline-legend">
        <span>
          <PlaneLanding size={14} /> Arrival
        </span>
        <span>
          <Route size={14} /> Scheduled tow
        </span>
        <span>
          <PlaneTakeoff size={14} /> Departure
        </span>
        <span className="timeline-legend-end">
          All times local · full operating day
          {now !== null && (
            <Button
              type="button"
              variant="outline"
              className="timeline-now-button"
              onClick={scrollToNow}
              aria-label="Scroll timeline to now"
            >
              Now
            </Button>
          )}
        </span>
      </div>
      <div
        className="tow-timeline"
        aria-label={`Tow timeline for ${report.date}`}
      >
        <div className="timeline-axis">
          <div>AIRCRAFT / MOVEMENT</div>
          <div className="timeline-hours">
            {Array.from({ length: 13 }, (_, i) => (
              <span key={i} style={{ left: `${(i / 12) * 100}%` }}>
                {String(i * 2).padStart(2, '0')}:00
              </span>
            ))}
            {now !== null && (
              <span
                className="gantt-now"
                style={{ left: `${position(now)}%` }}
              />
            )}
          </div>
        </div>
        {fins.map((fin) => {
          const legs = moves.filter((m) => m.fin === fin);
          const decisions = pending.filter((t) => t.fin === fin);
          return (
            <section
              className={`timeline-aircraft ${selectedFin === fin ? 'is-selected' : ''}`}
              key={fin || 'unassigned'}
            >
              <div className="timeline-aircraft-heading">
                <Button
                  variant="link"
                  className="fin-link"
                  onClick={() => onFin(fin)}
                >
                  FIN {fin || 'unassigned'}
                </Button>
                <span>
                  {legs.length} {legs.length === 1 ? 'movement' : 'movements'}
                  {decisions.length
                    ? ` · ${decisions.length} routing decisions`
                    : ''}
                </span>
              </div>
              {legs.map((m) => {
                const turn = report.turns.find((t) => t.id === m.turnId),
                  arrival = turn?.arrival ?? null,
                  departure = turn?.departure ?? null,
                  at = pickup(m);
                const validGround =
                  arrival !== null &&
                  departure !== null &&
                  departure >= arrival &&
                  departure >= start &&
                  arrival <= start + 86400000;
                return (
                  <div
                    className={`timeline-leg ${!m.included ? 'excluded' : ''}`}
                    key={m.id}
                  >
                    <div className="timeline-leg-label">
                      <button
                        onClick={() => onMove(m)}
                        aria-label={`Edit FIN ${fin} ${m.from} to ${m.to} at ${m.pickup || 'unset time'}`}
                      >
                        <b className="mono">{m.pickup || 'Set time'}</b>
                        <span className="mono">
                          {m.from || '?'} <ArrowRight size={12} /> {m.to || '?'}
                        </span>
                        {m.gateOpen ? (
                          <small>Gate opens {m.gateOpen}</small>
                        ) : null}
                      </button>
                      <Badge
                        variant="outline"
                        className={`execution-${towStatus(m, report.date)}`}
                      >
                        {statusNames[towStatus(m, report.date)]}
                      </Badge>
                    </div>
                    <div className="timeline-track">
                      {now !== null && (
                        <span
                          className="gantt-now"
                          style={{ left: `${position(now)}%` }}
                        />
                      )}
                      {validGround && (
                        <div
                          className="ground-line"
                          style={{
                            left: `${position(arrival)}%`,
                            width: `${Math.max(0.25, position(departure) - position(arrival))}%`,
                          }}
                        />
                      )}
                      {arrival !== null && (
                        <span
                          className="flight-marker arrival-marker"
                          style={{ left: `${position(arrival)}%` }}
                          title={`Arrival ${timeLabel(arrival, report.date)} · ${turn?.arrFlight}`}
                        >
                          <PlaneLanding size={13} />
                        </span>
                      )}
                      {departure !== null && (
                        <span
                          className="flight-marker departure-marker"
                          style={{ left: `${position(departure)}%` }}
                          title={`Departure ${timeLabel(departure, report.date)} · ${turn?.depFlight}`}
                        >
                          <PlaneTakeoff size={13} />
                        </span>
                      )}
                      {at !== null ? (
                        <button
                          className={`tow-marker marker-${towStatus(m, report.date)}`}
                          style={{ left: `${position(at)}%` }}
                          onClick={() => onMove(m)}
                          aria-label={`Tow FIN ${fin} at ${m.pickup}, ${m.from} to ${m.to}`}
                        >
                          <span className="marker-dot" />
                          <span
                            className={`marker-label ${position(at) > 78 ? 'label-left' : ''}`}
                          >
                            {m.pickup} <ArrowRight size={12} /> {m.to || '?'}
                          </span>
                        </button>
                      ) : (
                        <button
                          className="timeline-missing"
                          onClick={() => onMove(m)}
                        >
                          Pickup requires review
                        </button>
                      )}
                      <div className="timeline-flight-labels">
                        <span>
                          ARR {turn?.arrFlight || '—'} ·{' '}
                          {timeLabel(arrival, report.date)} ·{' '}
                          {turn?.from || '—'}
                        </span>
                        <span>
                          DEP {turn?.depFlight || '—'} ·{' '}
                          {timeLabel(departure, report.date)} ·{' '}
                          {turn?.to || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {decisions.map((t) => (
                <div className="timeline-decision" key={t.id}>
                  <Route size={16} />
                  <span className="mono">
                    {t.from} → {t.to}
                  </span>
                  <span>
                    {t.kind === 'long' ? 'Long stay' : 'Same-area routing'} ·{' '}
                    {timeLabel(t.arrival, report.date)} to{' '}
                    {timeLabel(t.departure, report.date)}
                  </span>
                  <Button variant="outline" onClick={onReview}>
                    Resolve route <ArrowRight size={14} />
                  </Button>
                </div>
              ))}
            </section>
          );
        })}
        {!fins.length && (
          <div className="empty-state">No aircraft match this view.</div>
        )}
      </div>
    </div>
  );
}
