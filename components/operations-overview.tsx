'use client';
import { shutdownErrors } from '@/lib/shutdown';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Moon,
  ScanLine,
  Route,
  FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type Report, type Move, type Turn, timeLabel } from '@/lib/tows';
import { type GateCheck } from '@/lib/gates';
import { type OvernightSnapshot } from './operations-console';
import { towStatus, statusNames } from '@/lib/console';
export function OperationsOverview({
  report,
  moves,
  pending,
  reviewCount,
  gateChecks,
  airportLoaded,
  overnight,
  overnightCount,
  draft,
  go,
  onFin,
}: {
  report: Report;
  moves: Move[];
  pending: Turn[];
  reviewCount: number;
  gateChecks: GateCheck[];
  airportLoaded: boolean;
  overnight: OvernightSnapshot;
  overnightCount: number;
  draft: boolean;
  go: (page: string) => void;
  onFin: (fin: string) => void;
}) {
  const conflicts = gateChecks.filter((c) => c.status === 'mismatch');
  const planned = moves
    .filter((m) => m.included)
    .sort((a, b) => (a.pickup || '99').localeCompare(b.pickup || '99'));
  const matched = gateChecks.filter((c) => c.status === 'match').length;
  const unverified = gateChecks.length - matched - conflicts.length;
  return (
    <div className="overview-workspace">
      <div className="metric-strip" aria-label="Operating day summary">
        {[
          {
            label: 'Aircraft turns',
            value: report.turns.length,
            page: 'schedule',
          },
          { label: 'Tow movements', value: planned.length, page: 'moves' },
          {
            label: 'Tow review items',
            value: reviewCount,
            page: 'review',
            tone: 'warning',
          },
          {
            label: 'Gate mismatches',
            value: airportLoaded ? conflicts.length : '—',
            page: 'mismatch',
            tone: conflicts.length ? 'danger' : '',
          },
          {
            label: 'Overnight aircraft',
            value: overnightCount,
            page: 'shutdown',
          },
        ].map((m) => (
          <button
            key={m.label}
            onClick={() => go(m.page)}
            className={m.tone ? `text-${m.tone}` : ''}
          >
            <strong>{m.value}</strong>
            <span>
              {m.label}
              <ArrowRight size={13} />
            </span>
          </button>
        ))}
      </div>
      <div className="overview-grid">
        <section className="overview-attention">
          <div className="section-heading">
            <h2>Attention required</h2>
            <span className="section-kicker">EXCEPTIONS FIRST</span>
          </div>
          {pending.slice(0, 3).map((t) => (
            <article className="attention-item" key={t.id}>
              <span className="attention-icon">
                <Route size={19} />
              </span>
              <div>
                <div className="attention-title">
                  <Button
                    variant="link"
                    className="fin-link"
                    onClick={() => onFin(t.fin)}
                  >
                    FIN {t.fin || 'unassigned'}
                  </Button>
                  <Badge variant="outline" className="execution-review">
                    Needs decision
                  </Badge>
                </div>
                <h3>
                  {t.kind === 'same-area'
                    ? 'Confirm tow routing'
                    : 'Long stay decision'}
                </h3>
                <p>
                  <span className="mono">
                    {t.from} → {t.to}
                  </span>{' '}
                  · {t.arrFlight} arrives {timeLabel(t.arrival, report.date)}
                  <br />
                  {t.depFlight} departs {timeLabel(t.departure, report.date)}
                  {t.duration !== null
                    ? ` · ${Math.floor(t.duration / 60)}h ${t.duration % 60}m on ground`
                    : ''}
                </p>
              </div>
              <Button variant="outline" onClick={() => go('review')}>
                Review <ArrowRight size={14} />
              </Button>
            </article>
          ))}
          {pending.length > 3 && (
            <Button variant="ghost" onClick={() => go('review')}>
              View {pending.length - 3} more routing decisions{' '}
              <ArrowRight size={14} />
            </Button>
          )}
          {conflicts.slice(0, 2).map((c) => (
            <article className="attention-item conflict" key={c.id}>
              <span className="attention-icon">
                <AlertTriangle size={19} />
              </span>
              <div>
                <div className="attention-title">
                  <Button
                    variant="link"
                    className="fin-link"
                    onClick={() => onFin(c.fin)}
                  >
                    FIN {c.fin || 'unassigned'}
                  </Button>
                  <Badge variant="outline" className="count-conflict">
                    Gate mismatch
                  </Badge>
                </div>
                <h3>
                  {c.flight} · {c.direction}
                </h3>
                <p>
                  Turn schedule <b className="mono">{c.csvGate}</b> → Airport
                  plan <b className="mono">{c.airportGate}</b>
                </p>
              </div>
              <Button variant="outline" onClick={() => go('mismatch')}>
                Compare <ArrowRight size={14} />
              </Button>
            </article>
          ))}
          {reviewCount > pending.length && (
            <button className="attention-summary" onClick={() => go('review')}>
              <FileCheck2 size={18} />
              <span>
                <strong>
                  {reviewCount - pending.length} additional tow review items
                </strong>
                <small>
                  Movement review, source exceptions, or paired-tow checks
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
          )}
          {!draft && !conflicts.length && (
            <div className="clear-state">
              <CheckCircle2 size={23} />
              <div>
                <h3>No tow decisions or gate conflicts</h3>
                <p>
                  {airportLoaded
                    ? 'All compared assignments match.'
                    : 'Airport gates have not been verified yet.'}
                </p>
              </div>
            </div>
          )}
          <div className="readiness-line">
            <span className={draft ? 'text-warning' : 'text-success'}>
              {draft
                ? 'Draft tow plan · review required'
                : 'Tow plan ready for output'}
            </span>
            <Button
              variant="ghost"
              onClick={() => go(draft ? 'review' : 'sheet')}
            >
              {draft ? 'Review & resolve' : 'Preview sheet'}{' '}
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>
        <div className="overview-secondary">
          <section>
            <div className="section-heading">
              <h2>
                <Moon size={17} /> Overnight snapshot
              </h2>
            </div>
            <strong className="snapshot-number">
              {overnightCount}
              <small> aircraft</small>
            </strong>
            <p>
              {overnight.generated
                ? `Night of ${overnight.date}`
                : 'Detected from the turn schedule · assignments not prepared'}
            </p>
            {overnight.generated && (
              <div className="snapshot-details">
                <span>
                  {overnight.rows.filter((r) => r.maintenance).length} required
                  at BSE / HGR
                </span>
                <span>
                  {overnight.rows.filter((r) => r.gateAllowed).length} on the
                  gate-permitted list
                </span>
                <span className="text-warning">
                  {overnight.dirty
                    ? 'Inputs changed — regenerate report'
                    : `${overnight.rows.filter((r) => !r.reviewed || shutdownErrors(r).length > 0 || r.requestStatus === 'pending').length} awaiting review`}
                </span>
              </div>
            )}
            <Button variant="ghost" onClick={() => go('shutdown')}>
              Open overnight plan <ArrowRight size={14} />
            </Button>
          </section>
          <section>
            <div className="section-heading">
              <h2>
                <ScanLine size={17} /> Gate verification
              </h2>
            </div>
            {airportLoaded ? (
              <div className="verification-summary">
                <span>
                  <b className="text-success">{matched}</b> matched
                </span>
                <span>
                  <b className={conflicts.length ? 'text-danger' : ''}>
                    {conflicts.length}
                  </b>{' '}
                  mismatches
                </span>
                <span>
                  <b>{unverified}</b> unverified
                </span>
              </div>
            ) : (
              <p>
                Airport plan not loaded. Upload the daily workbook to compare
                assignments.
              </p>
            )}
            <div className="overview-gate-links">
              <Button variant="ghost" onClick={() => go('mismatch')}>
                {airportLoaded ? 'Review comparison' : 'Load airport plan'}{' '}
                <ArrowRight size={14} />
              </Button>
              <Button variant="ghost" onClick={() => go('occupancy')}>
                Gate timeline <ArrowRight size={14} />
              </Button>
            </div>
          </section>
        </div>
      </div>
      <section className="planned-section">
        <div className="section-heading">
          <div>
            <h2>Planned tows</h2>
            <p className="section-subtitle">
              Operating-day pickup order · {report.date}
            </p>
          </div>
          <Button variant="ghost" onClick={() => go('moves')}>
            View all tows <ArrowRight size={15} />
          </Button>
        </div>
        <div className="planned-list">
          {planned.slice(0, 6).map((m) => (
            <button
              className="planned-row"
              key={m.id}
              onClick={() => onFin(m.fin)}
            >
              <strong className="mono">
                {m.pickup || 'Unset'}
                {m.gateOpen ? (
                  <small>Opens {m.gateOpen}</small>
                ) : null}
              </strong>
              <b className="mono">FIN {m.fin || '—'}</b>
              <span className="mono">
                {m.from || '?'} <ArrowRight size={14} /> {m.to || '?'}
              </span>
              <span>{m.arrFlight || m.depFlight || 'Manual move'}</span>
              <Badge
                variant="outline"
                className={`execution-${towStatus(m, report.date)}`}
              >
                {statusNames[towStatus(m, report.date)]}
              </Badge>
              <ArrowRight size={15} />
            </button>
          ))}
          {!planned.length && (
            <div className="empty-state">
              <CheckCircle2 />
              {pending.length
                ? 'Resolve routing decisions to determine additional moves.'
                : 'No tow movements included for this operating day.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
