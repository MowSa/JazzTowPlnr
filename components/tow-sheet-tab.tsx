'use client';
import { ArrowRight } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ReportTimestamp } from '@/components/report-timestamp';
import {
  sheetHeaders,
  sheetValues,
  type Report,
  type Turn,
  type Move,
} from '@/lib/tows';

const formatDate = (date: string) =>
  !date
    ? 'Upload a schedule to set the date'
    : new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });

export type TowSheetTabProps = {
  report: Report;
  selected: Move[];
  unreviewed: Move[];
  unresolved: Move[];
  pendingArea: Turn[];
  pendingLong: Turn[];
  issues: string[];
  draft: boolean;
  reviewCount: number;
  aircraftNotes: Record<string, string>;
  go: (value: string) => void;
};

export function TowSheetTab({
  report,
  selected,
  unreviewed,
  unresolved,
  pendingArea,
  pendingLong,
  issues,
  draft,
  reviewCount,
  aircraftNotes,
  go,
}: TowSheetTabProps) {
  return (
    <>
      <div className="output-readiness no-print">
        <div>
          <strong className={draft ? 'text-warning' : 'text-success'}>
            {draft
              ? 'Draft preview — review required'
              : 'Tow sheet ready for output'}
          </strong>
          <p>
            {draft
              ? `${reviewCount} review items remain. Draft export and printing are available for planning.`
              : 'All included movements satisfy the existing tow review checks.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => go('review')}>
          {draft ? 'Resolve remaining items' : 'View review summary'}
          <ArrowRight size={14} />
        </Button>
      </div>
      <section className="paper">
        <div className="paper-heading">
          <div className="paper-title">TOW SHEET</div>
          <div className="paper-brand">
            JazzTow <small>{report.station} · GROUND OPERATIONS</small>
          </div>
          <div className="paper-date">
            <span>DATE</span>
            <strong>{formatDate(report.date).toUpperCase()}</strong>
          </div>
        </div>
        <div className={`sheet-status ${draft ? 'draft' : 'ready'}`}>
          {draft ? 'DRAFT — REVIEW REQUIRED' : 'REVIEWED TOW SHEET'}
          <span>
            {draft
              ? `${unreviewed.length} moves to review · ${pendingLong.length + pendingArea.length} routing decisions pending${unresolved.length ? ` · ${unresolved.length} incomplete turns` : ''}${report.warnings.length ? ` · ${report.warnings.length} import issues` : ''}${issues.length ? ` · ${issues.length} paired-tow issues` : ''}`
              : `${selected.length} moves · All times local`}
          </span>
        </div>
        <Table className="tower-table">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              {sheetHeaders.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {selected.map((m, i) => (
              <TableRow key={m.id}>
                <TableCell>{i + 1}</TableCell>
                {sheetValues(m).map((v, j) => (
                  <TableCell key={j}>{v}</TableCell>
                ))}
              </TableRow>
            ))}
            {Array.from(
              { length: Math.max(2, 10 - selected.length) },
              (_, i) => (
                <TableRow key={`blank-${i}`}>
                  <TableCell>{selected.length + i + 1}</TableCell>
                  {sheetHeaders.map((_, j) => (
                    <TableCell key={j}>&nbsp;</TableCell>
                  ))}
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
        {Object.entries(aircraftNotes).some(
          ([fin, note]) => note.trim() && selected.some((m) => m.fin === fin),
        ) && (
          <section className="paper-notes">
            <h3>OPERATIONAL NOTES</h3>
            {Object.entries(aircraftNotes)
              .filter(
                ([fin, note]) =>
                  note.trim() && selected.some((m) => m.fin === fin),
              )
              .map(([fin, note]) => (
                <p key={fin}>
                  <strong>FIN {fin}</strong> {note}
                </p>
              ))}
          </section>
        )}
        <div className="paper-footer">
          {report.station} · {report.date} · Local time
          <ReportTimestamp station={report.station} />
          <span>Prepared with JazzTow</span>
        </div>
      </section>
      <p className="sheet-help no-print">
        TIME GATE OPENS AT is filled from airport occupancy when a departure tow
        is timed off the previous aircraft. Use the pencil beside a move to edit
        release, gate-open, actual pickup/drop, and tower fields. Print to paper
        or choose “Save as PDF”.
      </p>
    </>
  );
}
