'use client';
import type { Dispatch, SetStateAction } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Pencil,
  Search,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { TowTimeline } from '@/components/tow-timeline';
import { kindLabel, shortFlight } from '@/components/tow-labels';
import { towStatus, statusNames, type BoardFilter } from '@/lib/console';
import {
  moveErrors,
  timeLabel,
  type Report,
  type Turn,
  type Move,
} from '@/lib/tows';

export type TowMovesTabProps = {
  report: Report;
  moves: Move[];
  filtered: Move[];
  selected: Move[];
  unreviewed: Move[];
  pendingArea: Turn[];
  pendingLong: Turn[];
  boardFilter: BoardFilter | 'ready' | 'excluded';
  search: string;
  setSearch: (search: string) => void;
  towView: string;
  setTowView: (view: string) => void;
  towSort: string;
  setTowSort: (sort: string) => void;
  selectedFin: string | null;
  setSelectedFin: (fin: string | null) => void;
  setEditing: Dispatch<SetStateAction<Move | null>>;
  setEditError: (error: string) => void;
  patch: (id: string, values: Partial<Move>) => void;
  reviewMove: (m: Move) => void;
  go: (value: string) => void;
};

export function TowMovesTab({
  report,
  moves,
  filtered,
  selected,
  unreviewed,
  pendingArea,
  pendingLong,
  boardFilter,
  search,
  setSearch,
  towView,
  setTowView,
  towSort,
  setTowSort,
  selectedFin,
  setSelectedFin,
  setEditing,
  setEditError,
  patch,
  reviewMove,
  go,
}: TowMovesTabProps) {
  const flightCell = (flight: string, time: number | null) => (
    <>
      <span>{shortFlight(flight) || '—'}</span>
      <small>{timeLabel(time, report.date)}</small>
    </>
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            {boardFilter === 'all'
              ? 'Aircraft movements'
              : statusNames[boardFilter]}{' '}
            <span className="table-count">{filtered.length}</span>
          </h2>
          <p className="section-subtitle">
            {selected.length} included on sheet ·{' '}
            {selected.length - unreviewed.length} reviewed
          </p>
        </div>
        <div className="tow-view-controls">
          <Tabs value={towView} onValueChange={(v) => setTowView(String(v))}>
            <TabsList aria-label="Tow plan view">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="sort-control">
            Sort
            <select
              value={towSort}
              onChange={(e) => setTowSort(e.target.value)}
            >
              <option value="pickup">Pickup time</option>
              <option value="fin">FIN</option>
            </select>
          </label>
          <div className="search-box">
            <Search size={16} />
            <Input
              aria-label="Search tow moves"
              placeholder="Find aircraft, flight or gate"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      {unreviewed.length > 0 && (
        <div className="inline-note">
          <Info size={16} />
          <span>
            Review each move before issuing. BSE locations are inferred from
            overnight turns.
          </span>
        </div>
      )}
      {towView === 'timeline' ? (
        <TowTimeline
          report={report}
          moves={filtered}
          pending={
            boardFilter === 'all' || boardFilter === 'review'
              ? [...pendingArea, ...pendingLong].filter((t) =>
                  `${t.fin} ${t.arrFlight} ${t.depFlight} ${t.from} ${t.to}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
              : []
          }
          selectedFin={selectedFin}
          onFin={setSelectedFin}
          onMove={(m) => {
            setEditing({ ...m });
            setEditError('');
          }}
          onReview={() => go('review')}
        />
      ) : (
        <>
          {' '}
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'USE',
                  'FIN #',
                  'ARRIVAL',
                  'TOW ROUTE',
                  'SKED PICKUP',
                  'GATE OPENS',
                  'DEPARTURE',
                  'GROUND',
                  'STATUS',
                  'REASON',
                  'REVIEW',
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const turn = report.turns.find((t) => t.id === m.turnId);
                const errs = moveErrors(m, report.date);
                return (
                  <TableRow
                    key={m.id}
                    className={!m.included ? 'excluded' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`Include FIN ${m.fin} ${m.from} to ${m.to}`}
                        checked={m.included}
                        onCheckedChange={(v) => patch(m.id, { included: !!v })}
                      />
                    </TableCell>
                    <TableCell className="fin">
                      <Button
                        variant="link"
                        className="fin-link"
                        onClick={() => setSelectedFin(m.fin)}
                      >
                        {m.fin || '—'}
                      </Button>
                    </TableCell>
                    <TableCell className="flight-cell">
                      {flightCell(
                        m.arrFlight,
                        m.arrFlight ? (turn?.arrival ?? null) : null,
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="tow-route">
                        <span
                          className={m.from === 'BSE' ? 'gate bse' : 'gate'}
                        >
                          {m.from || '?'}
                        </span>
                        <ArrowRight size={15} />
                        <span className={m.to === 'BSE' ? 'gate bse' : 'gate'}>
                          {m.to || '?'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        className="pickup-edit"
                        onClick={() => {
                          setEditing({ ...m });
                          setEditError('');
                        }}
                        aria-label={`Edit FIN ${m.fin} pickup ${m.pickup || 'unset'}`}
                      >
                        {m.pickup || 'Set time'}
                        <Pencil size={12} />
                      </Button>
                    </TableCell>
                    <TableCell className="mono">{m.gateOpen || '—'}</TableCell>
                    <TableCell className="flight-cell">
                      <span>{shortFlight(m.depFlight) || '—'}</span>
                      <small>{m.depTime || 'No departure today'}</small>
                    </TableCell>
                    <TableCell className="mono">
                      {turn?.duration !== null && turn?.duration !== undefined
                        ? `${Math.floor(turn.duration / 60)}h ${turn.duration % 60}m`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`execution-status execution-${towStatus(m, report.date)}`}
                      >
                        {statusNames[towStatus(m, report.date)]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`reason-badge ${m.kind.startsWith('bse') ? 'blue' : m.kind === 'long' || m.kind === 'same-area' || m.kind === 'incomplete' ? 'amber' : ''}`}
                      >
                        {kindLabel[m.kind]}
                      </Badge>
                      {(m.warnings.length > 0 || errs.length > 0) && (
                        <span
                          className="row-warning"
                          title={[...m.warnings, ...errs].join(' ')}
                        >
                          <AlertTriangle size={13} /> Check details
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="row-actions">
                        <Button
                          variant="outline"
                          className={`review-button ${m.reviewed ? 'done' : ''}`}
                          onClick={() => reviewMove(m)}
                          aria-label={`${m.reviewed ? 'Undo review' : 'Review'} FIN ${m.fin} ${m.from} to ${m.to}`}
                        >
                          {m.reviewed ? (
                            <Check size={15} />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}{' '}
                          {m.reviewed ? 'Reviewed' : 'Review'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="icon-button"
                          aria-label={`Edit FIN ${m.fin} ${m.from} to ${m.to}`}
                          onClick={() => {
                            setEditing({ ...m });
                            setEditError('');
                          }}
                        >
                          <Pencil size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!filtered.length && (
            <div className="empty-state">
              {moves.length
                ? 'No moves match this status and search.'
                : 'No tow moves identified for this schedule.'}
            </div>
          )}
        </>
      )}
      <div className="panel-footer">
        <div className="review-progress">
          <CheckCircle2 size={16} />
          <span>
            {selected.length - unreviewed.length} of {selected.length} moves
            reviewed
          </span>
          <Progress
            aria-label="Included moves reviewed"
            value={
              selected.length
                ? Math.round(
                    ((selected.length - unreviewed.length) / selected.length) *
                      100,
                  )
                : 0
            }
          />
        </div>
        <span>All times local · HH:MM</span>
      </div>
    </section>
  );
}
