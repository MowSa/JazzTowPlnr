'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Plane,
  LayoutList,
  ScanLine,
  Moon,
  ListChecks,
  ArrowRight,
  LayoutDashboard,
  FileOutput,
  GanttChart,
  PanelLeftClose,
  PanelLeftOpen,
  Files,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
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
import { stationTimezone, towStatus, statusNames } from '@/lib/console';
import {
  nextIncludedPickup,
  nextPickupNowStamp,
  type OvernightSnapshot,
} from '@/lib/planner-session';
import { previewArrivalToast } from '@/components/yul-ops/arrival-toasts';
import { ToastInbox } from '@/components/yul-ops/toast-inbox';
export type { OvernightSnapshot };

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
  // Workflow rail: the desk runs load → plan → verify → finalize. Grouping
  // follows that arc so the nav reads as a process, not a flat page list.
  const groups = [
    {
      caption: 'Plan',
      items: [
        { id: 'overview', label: 'Overview', Icon: LayoutDashboard, count: 0 },
        { id: 'moves', label: 'Tow Plan', Icon: LayoutList, count: towCount },
      ],
    },
    {
      caption: 'Verify',
      items: [
        {
          id: 'mismatch',
          label: 'Gate Verification',
          Icon: ScanLine,
          count: gateCount,
        },
        { id: 'occupancy', label: 'Gate Timeline', Icon: GanttChart, count: 0 },
      ],
    },
    {
      caption: 'Overnight',
      items: [
        {
          id: 'shutdown',
          label: 'Overnight Plan',
          Icon: Moon,
          count: overnightCount,
        },
      ],
    },
    {
      caption: 'Finalize',
      items: [
        {
          id: 'review',
          label: 'Review & Resolve',
          Icon: ListChecks,
          count: reviewCount,
        },
        { id: 'sheet', label: 'Reports / Outputs', Icon: FileOutput, count: 0 },
      ],
    },
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
          {groups.map(({ caption, items }) => (
            <div key={caption} className="nav-group">
              <div className="nav-caption">{caption}</div>
              <SidebarMenu>
                {items.map(({ id, label, Icon, count }) => (
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
        <Link className="yul-live-link" href="/yul">
          <span className="yul-live-dot" aria-hidden="true">
            <i />
          </span>
          Live Map
        </Link>
        <Button variant="ghost" className="yul-preview-toast-link" onClick={previewArrivalToast}>
          Preview toast
        </Button>
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
  moves = [],
  onNextPickup,
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
  moves?: Move[];
  onNextPickup?: (fin: string) => void;
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
      hourCycle: 'h23',
    }).format(instant);
  const nowStamp = now ? nextPickupNowStamp(now, station, date) : null;
  const next = nextIncludedPickup(moves, date, nowStamp);
  const nextMinutes =
    next && nowStamp !== null
      ? Math.round((Date.parse(`${date}T${next.pickup}:00Z`) - nowStamp) / 60000)
      : null;
  const nextDue = !next
    ? ''
    : /^([01]\d|2[0-3]):[0-5]\d$/.test(next.actualPickup)
      ? 'in progress'
      : nextMinutes === null
        ? ''
        : nextMinutes > 0
          ? `${nextMinutes}m`
          : nextMinutes === 0
            ? 'now'
            : 'due';
  return (
    <header className="console-station no-print">
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
        <div className="station-clock-stack">
          <div>
            <small>{zone ? 'LOCAL' : 'ZONE UNKNOWN'}</small>
            <strong>{now && zone ? time(now, zone) : '—'}</strong>
          </div>
          <div>
            <small>UTC</small>
            <strong>{now ? time(now, 'UTC') : '—'}</strong>
          </div>
        </div>
        {next && (
          <button
            type="button"
            className="next-pickup"
            onClick={() => onNextPickup?.(next.fin)}
            aria-label={`Next pickup FIN ${next.fin} at ${next.pickup} from ${next.from} to ${next.to}`}
          >
            <small>NEXT</small>
            <strong>
              {next.pickup} · {next.fin} · {next.from || '?'} → {next.to || '?'}
              {nextDue ? ` · ${nextDue}` : ''}
            </strong>
          </button>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="source-files-button"
        onClick={onFiles}
        aria-label="Source files"
        title={
          uploadedAt
            ? `Schedule loaded ${new Date(uploadedAt).toLocaleString()}`
            : 'Manage source files'
        }
      >
        <Files />
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
      <div className="header-tools">
        <ThemeToggle />
        {now !== null && <ToastInbox now={now} />}
      </div>
    </header>
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
