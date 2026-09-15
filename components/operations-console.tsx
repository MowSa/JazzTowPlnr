'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Plane,
  LayoutList,
  ScanLine,
  Moon,
  ListChecks,
  ArrowRight,
  Sun,
  LayoutDashboard,
  FileOutput,
  GanttChart,
  PanelLeftClose,
  PanelLeftOpen,
  Files,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type GateCheck } from '@/lib/gates';
import { Badge } from '@/components/ui/badge';
import { type Move, type Report, timeLabel } from '@/lib/tows';
import { type ShutdownRow } from '@/lib/shutdown';
import { stationTimezone, towStatus, statusNames } from '@/lib/console';
export type OvernightSnapshot = {
  rows: ShutdownRow[];
  date: string;
  dirty: boolean;
  generated: boolean;
};
export function ConsoleNav({
  tab,
  go,
  reviewCount,
  gateCount,
  overnightCount,
  towCount,
  collapsed,
  toggle,
}: {
  tab: string;
  go: (tab: string) => void;
  reviewCount: number;
  gateCount: number;
  overnightCount: number;
  towCount: number;
  collapsed: boolean;
  toggle: () => void;
}) {
  const items = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard, count: 0 },
    { id: 'moves', label: 'Tow Plan', Icon: LayoutList, count: towCount },
    {
      id: 'mismatch',
      label: 'Gate Verification',
      Icon: ScanLine,
      count: gateCount,
    },
    {
      id: 'occupancy',
      label: 'Gate Timeline',
      Icon: GanttChart,
      count: 0,
    },
    {
      id: 'shutdown',
      label: 'Overnight Plan',
      Icon: Moon,
      count: overnightCount,
    },
    {
      id: 'review',
      label: 'Review & Resolve',
      Icon: ListChecks,
      count: reviewCount,
    },
    { id: 'sheet', label: 'Reports / Outputs', Icon: FileOutput, count: 0 },
  ];
  return (
    <Sidebar collapsible="none" className="console-nav no-print">
      <SidebarHeader>
        <div className="console-logo">
          <Plane size={23} />
          <span>
            Jazz<strong>Tow</strong>
          </span>
        </div>
        <small>Operations Console</small>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Operations navigation">
          {['OPERATIONS', 'FINALIZE'].map((group, i) => (
            <div key={group}>
              <div className="nav-caption">{group}</div>
              <SidebarMenu>
                {items
                  .slice(i ? 5 : 0, i ? 7 : 5)
                  .map(({ id, label, Icon, count }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        title={label}
                        aria-label={label}
                        isActive={
                          tab === id || (id === 'moves' && tab === 'schedule')
                        }
                        onClick={() => go(id)}
                        aria-current={tab === id ? 'page' : undefined}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {count > 0 && (
                        <SidebarMenuBadge
                          className={
                            id === 'mismatch'
                              ? 'count-conflict'
                              : id === 'review' || id === 'shutdown'
                                ? 'count-review'
                                : 'count-neutral'
                          }
                        >
                          {count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </div>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="collapse-nav"
          onClick={toggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span>{collapsed ? 'Expand navigation' : 'Collapse navigation'}</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
export function StationHeader({
  station,
  date,
  uploadedAt,
  turns,
  tows,
  actions,
  airportLoaded,
  dateMismatch,
  onFiles,
  search,
}: {
  station: string;
  date: string;
  uploadedAt: number | null;
  turns: number;
  tows: number;
  actions: number;
  airportLoaded: boolean;
  dateMismatch: boolean;
  onFiles: () => void;
  search?: ReactNode;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const zone = stationTimezone(station);
  const time = (instant: number, tz: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(instant);
  const day = date
    ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Operating date pending';
  return (
    <header className="console-station no-print">
      <div className="station-identity">
        <strong>
          {station || '—'} <span>/</span> TOW CONTROL
        </strong>
        <small>{day}</small>
      </div>
      <div className="header-metrics">
        <span>
          <b>{turns}</b> turns
        </span>
        <span>
          <b>{tows}</b> tows
        </span>
        {actions > 0 && (
          <span className="text-warning">
            <b>{actions}</b> to review
          </span>
        )}
      </div>
      <div className="header-search-slot">{search}</div>
      <div className="station-clocks">
        <div>
          <small>{zone ? 'LOCAL' : 'ZONE UNKNOWN'}</small>
          <strong>{now && zone ? time(now, zone) : '—'}</strong>
        </div>
        <div>
          <small>UTC</small>
          <strong>{now ? time(now, 'UTC') : '—'}</strong>
        </div>
      </div>
      <Button
        variant="outline"
        className="source-files-button"
        onClick={onFiles}
        title={
          uploadedAt
            ? `Schedule loaded ${new Date(uploadedAt).toLocaleString()}`
            : 'Manage source files'
        }
      >
        <Files />
        <span>Source files</span>
        <span
          className={`source-indicator ${dateMismatch ? 'warning' : uploadedAt && airportLoaded ? 'verified' : ''}`}
          aria-label={
            dateMismatch
              ? 'Source dates differ'
              : uploadedAt && airportLoaded
                ? 'Both files loaded'
                : 'Files incomplete'
          }
        />
      </Button>
      <ThemeToggle />
    </header>
  );
}
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const apply = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('jazztow-theme');
      } catch {
        /* Theme still works when storage is unavailable. */
      }
      const enabled = saved ? saved === 'dark' : true;
      setDark(enabled);
      document.documentElement.classList.toggle('dark', enabled);
    };
    const timer = setTimeout(apply, 0);
    return () => clearTimeout(timer);
  }, []);
  function toggle() {
    const enabled = !dark;
    setDark(enabled);
    document.documentElement.classList.toggle('dark', enabled);
    try {
      localStorage.setItem('jazztow-theme', enabled ? 'dark' : 'light');
    } catch {
      /* Preference cannot be persisted. */
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? 'Use light mode' : 'Use dark mode'}
      title={dark ? 'Use light mode' : 'Use dark mode'}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
export function AircraftDrawer({
  fin,
  close,
  report,
  moves,
  overnight,
  edit,
  gateChecks,
  airportLoaded,
  decisions,
  go,
  note,
  onNote,
}: {
  fin: string | null;
  close: () => void;
  report: Report;
  moves: Move[];
  overnight: OvernightSnapshot;
  edit: (m: Move) => void;
  gateChecks: GateCheck[];
  airportLoaded: boolean;
  decisions: Record<string, string>;
  go: (page: string) => void;
  note: string;
  onNote: (note: string) => void;
}) {
  const turns = report.turns
    .filter((t) => t.fin === fin)
    .sort((a, b) => (a.arrival ?? 0) - (b.arrival ?? 0));
  const legs = moves
    .filter((m) => m.fin === fin)
    .sort((a, b) => a.pickup.localeCompare(b.pickup));
  const ron = overnight.rows.find((r) => r.fin === fin),
    checks = gateChecks.filter((c) => c.fin === fin);
  return (
    <Sheet
      open={!!fin}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent className="edit-sheet aircraft-drawer">
        <SheetHeader>
          <div className="eyebrow">AIRCRAFT / {report.station}</div>
          <SheetTitle>
            FIN <span className="mono">{fin}</span>
          </SheetTitle>
          <SheetDescription>
            {report.date} · Operating-day rotation
          </SheetDescription>
        </SheetHeader>
        <div className="aircraft-content">
          <section className="drawer-rotation">
            <h3>TODAY’S ROTATION</h3>
            {turns.map((t) => (
              <div className="rotation-block" key={t.id}>
                <div className="rotation-event">
                  <span className="rotation-dot" />
                  <div>
                    <small>
                      ARRIVAL · {t.origin || '—'} → {report.station}
                    </small>
                    <strong>{t.arrFlight || 'Flight unavailable'}</strong>
                    <p>
                      <span className="mono">
                        {timeLabel(t.arrival, report.date)}
                      </span>{' '}
                      · Gate <b className="mono">{t.from || '—'}</b>
                    </p>
                  </div>
                </div>
                {legs
                  .filter((m) => m.turnId === t.id)
                  .map((m) => (
                    <div className="rotation-event rotation-tow" key={m.id}>
                      <span className="rotation-dot" />
                      <div>
                        <small>TOW MOVEMENT</small>
                        <strong className="mono">
                          {m.pickup || 'Unset'} · {m.from || '?'} →{' '}
                          {m.to || '?'}
                        </strong>
                        {m.gateOpen ? (
                          <p>Gate opens {m.gateOpen}</p>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={`execution-${towStatus(m, report.date)}`}
                        >
                          {statusNames[towStatus(m, report.date)]}
                        </Badge>
                        <p>{m.reason}</p>
                        <p>
                          Actual pickup {m.actualPickup || '—'} · Drop{' '}
                          {m.actualDrop || '—'}
                        </p>
                        <Button variant="outline" onClick={() => edit(m)}>
                          Edit tow
                        </Button>
                      </div>
                    </div>
                  ))}
                {(t.kind === 'same-area' || t.kind === 'long') && (
                  <div className="rotation-decision">
                    <Badge
                      variant="outline"
                      className={
                        decisions[t.id]
                          ? 'execution-completed'
                          : 'execution-review'
                      }
                    >
                      {decisions[t.id]
                        ? decisions[t.id] === 'direct'
                          ? 'Direct tow confirmed'
                          : decisions[t.id] === 'stay'
                            ? 'Stay at gate confirmed'
                            : 'Via holding confirmed'
                        : 'Routing decision required'}
                    </Badge>
                    <Button variant="ghost" onClick={() => go('review')}>
                      Review routing <ArrowRight size={14} />
                    </Button>
                  </div>
                )}
                <div className="rotation-event">
                  <span className="rotation-dot" />
                  <div>
                    <small>
                      DEPARTURE · {report.station} → {t.destination || '—'}
                    </small>
                    <strong>{t.depFlight || 'Flight unavailable'}</strong>
                    <p>
                      <span className="mono">
                        {timeLabel(t.departure, report.date)}
                      </span>{' '}
                      · Gate <b className="mono">{t.to || '—'}</b>
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {!turns.length && <p>No linked turn schedule for this aircraft.</p>}
            {legs
              .filter((m) => !turns.some((t) => t.id === m.turnId))
              .map((m) => (
                <div className="aircraft-leg" key={m.id}>
                  <strong className="mono">
                    {m.pickup || 'Unset'} · {m.from} → {m.to}
                  </strong>
                  <p>{m.reason}</p>
                  <Badge
                    variant="outline"
                    className={`execution-${towStatus(m, report.date)}`}
                  >
                    {statusNames[towStatus(m, report.date)]}
                  </Badge>
                  <Button variant="ghost" onClick={() => edit(m)}>
                    Edit tow
                  </Button>
                </div>
              ))}
          </section>
          <section>
            <h3>GATE VERIFICATION</h3>
            {!airportLoaded ? (
              <p>Airport workbook not loaded.</p>
            ) : checks.length ? (
              checks.map((c) => (
                <div className="drawer-gate-check" key={c.id}>
                  <span>
                    {c.flight} · {c.direction}
                  </span>
                  <strong
                    className={
                      c.status === 'mismatch'
                        ? 'text-danger'
                        : c.status === 'match'
                          ? 'text-success'
                          : 'muted'
                    }
                  >
                    {c.status === 'match'
                      ? 'Verified'
                      : c.status === 'mismatch'
                        ? `${c.csvGate} → ${c.airportGate} · Mismatch`
                        : 'Unverified'}
                  </strong>
                  <small>
                    Schedule {c.csvGate || '—'} / Airport {c.airportGate || '—'}{' '}
                    · {c.date || 'Date missing'}
                  </small>
                </div>
              ))
            ) : (
              <p>No flight assignments to compare.</p>
            )}
            <Button variant="ghost" onClick={() => go('mismatch')}>
              Open gate verification <ArrowRight size={14} />
            </Button>
          </section>
          <section>
            <h3>OVERNIGHT</h3>
            {ron ? (
              <>
                <strong className="ron-location">{ron.ron}</strong>
                <Badge
                  variant="outline"
                  className={
                    overnight.dirty || !ron.reviewed
                      ? 'execution-review'
                      : 'execution-completed'
                  }
                >
                  {overnight.dirty
                    ? 'Inputs changed'
                    : ron.reviewed
                      ? 'Reviewed'
                      : 'Needs review'}
                </Badge>
                <p>
                  Night of {overnight.date} ·{' '}
                  {ron.maintenance
                    ? 'Required at BSE / HGR'
                    : ron.gateAllowed
                      ? 'On gate-permitted list'
                      : 'HGR pending classification'}
                </p>
                {ron.requestStatus === 'pending' && (
                  <p className="text-warning">
                    Gate {ron.requestedGate || 'TBC'} request pending.
                  </p>
                )}
                {ron.depFlight && (
                  <p>
                    Next flight {ron.depFlight} ·{' '}
                    <span className="mono">
                      {ron.std || 'Time unavailable'}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p>
                {overnight.generated
                  ? 'Not listed in the generated overnight report.'
                  : 'Overnight report has not been prepared.'}
              </p>
            )}
            <Button variant="ghost" onClick={() => go('shutdown')}>
              Open overnight plan <ArrowRight size={14} />
            </Button>
          </section>
          <section>
            <h3>SHIFT NOTE</h3>
            <label className="sr-only" htmlFor="aircraft-note">
              Note for FIN {fin}
            </label>
            <Textarea
              id="aircraft-note"
              placeholder="Add an operational note…"
              value={note}
              onChange={(e) => onNote(e.target.value)}
            />
            <small>
              Session only · included in printed tow notes, not CSV.
            </small>
          </section>
          <details className="source-warnings">
            <summary>Source data & warnings</summary>
            {turns.map((t) => (
              <div key={t.id}>
                <p>
                  CSV row {t.row} · {t.arrFlight} / {t.depFlight}
                </p>
                <p>
                  Arrival {t.arrLabel || '—'} · Departure {t.depLabel || '—'}
                </p>
                <p>
                  Original gates {t.rawFrom || '—'} / {t.rawTo || '—'}
                </p>
                {t.warnings.map((w) => (
                  <p className="text-warning" key={w}>
                    {w}
                  </p>
                ))}
              </div>
            ))}
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
}
