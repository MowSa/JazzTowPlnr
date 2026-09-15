'use client';
import { useState, useEffect } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type Report, type Move } from '@/lib/tows';
import { type OvernightSnapshot } from './operations-console';
export function AircraftSearch({
  report,
  moves,
  overnight,
  onFin,
}: {
  report: Report;
  moves: Move[];
  overnight: OvernightSnapshot;
  onFin: (fin: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input,textarea,select,[role="combobox"]'))
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const term = query
    .trim()
    .toLowerCase()
    .replace(/^fin\s*/, '')
    .replace(/^g(?=\d)/, '');
  const fins = [
    ...new Set([
      ...report.turns.map((t) => t.fin),
      ...moves.map((m) => m.fin),
      ...overnight.rows.map((r) => r.fin),
    ]),
  ].filter(Boolean);
  const results = fins.filter((fin) =>
    [
      fin,
      ...report.turns
        .filter((t) => t.fin === fin)
        .flatMap((t) => [t.arrFlight, t.depFlight, t.from, t.to]),
      ...moves
        .filter((m) => m.fin === fin)
        .flatMap((m) => [m.arrFlight, m.depFlight, m.from, m.to]),
      ...overnight.rows
        .filter((r) => r.fin === fin)
        .flatMap((r) => [r.ron, r.arrFlight, r.depFlight]),
    ].some((value) => value.toLowerCase().includes(term)),
  );
  return (
    <>
      <Button
        variant="outline"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search FIN, flight or gate"
      >
        <Search size={15} />
        <span>Search FIN, flight or gate…</span>
        <kbd>⌘ K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="aircraft-search-dialog">
          <DialogHeader>
            <DialogTitle>Find aircraft</DialogTitle>
            <DialogDescription>
              {report.date
                ? `${report.station} · ${report.date} · Search the analyzed operating day`
                : 'Load a turn schedule to search aircraft.'}
            </DialogDescription>
          </DialogHeader>
          <div className="search-box">
            <Search size={17} />
            <Input
              aria-label="Search aircraft"
              placeholder="FIN, flight or gate — e.g. 541 or G81"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="aircraft-search-results">
            {results.slice(0, 40).map((fin) => {
              const turns = report.turns.filter((t) => t.fin === fin),
                legs = moves.filter((m) => m.fin === fin),
                first = turns[0];
              return (
                <Button
                  variant="ghost"
                  className="aircraft-search-result"
                  key={fin}
                  onClick={() => {
                    setOpen(false);
                    onFin(fin);
                  }}
                >
                  <strong className="mono">FIN {fin}</strong>
                  <span>
                    {first
                      ? `${first.arrFlight || '—'} → ${first.depFlight || '—'}`
                      : 'Manual / overnight aircraft'}
                    <small>
                      {first
                        ? `${first.from || '?'} → ${first.to || '?'}`
                        : 'No linked schedule'}
                      {legs.length
                        ? ` · Tow ${legs.map((m) => m.pickup || 'unset').join(', ')}`
                        : ' · No tow planned'}
                      {turns.length > 1 ? ` · ${turns.length} turns` : ''}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </Button>
              );
            })}
            {!results.length && (
              <div className="empty-state">
                {report.date
                  ? 'No aircraft match your search.'
                  : 'No operating plan loaded.'}
              </div>
            )}
          </div>
          <p className="search-results-count">
            {results.length > 40
              ? `Showing 40 of ${results.length} aircraft. Refine your search.`
              : `${results.length} aircraft`}{' '}
            · Use Tab to select a result; Escape closes search.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
