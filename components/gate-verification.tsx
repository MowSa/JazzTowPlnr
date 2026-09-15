'use client';
import { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { GateMismatchTable } from './gate-mismatches';
import { type AirportPlan, type GateCheck } from '@/lib/gates';
export function GateVerification({
  airport,
  checks,
  date,
  loading,
  error,
  upload,
  onFin,
}: {
  airport: AirportPlan | null;
  checks: GateCheck[];
  date: string;
  loading: boolean;
  error: string;
  upload: () => void;
  onFin: (fin: string) => void;
}) {
  const [search, setSearch] = useState('');
  const mismatches = checks.filter((c) => c.status === 'mismatch'),
    matched = checks.filter((c) => c.status === 'match'),
    unverified = checks.filter(
      (c) => !['match', 'mismatch'].includes(c.status),
    );
  const different = !!airport?.date && airport.date !== date;
  const hasDay = airport?.assignments.some((a) => a.dates.includes(date));
  const visible = (items: GateCheck[]) =>
    items.filter((c) =>
      `${c.fin} ${c.flight} ${c.csvGate} ${c.airportGate}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <div className="gate-workspace">
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
            Upload the daily .xlsx airport planning workbook to verify gates
            against the turn schedule.
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
          {(different || !hasDay) && (
            <section className="date-comparison-warning">
              <AlertTriangle size={20} />
              <div>
                <h2>
                  {!hasDay
                    ? 'Airport plan cannot be fully compared'
                    : 'Source report dates differ'}
                </h2>
                <div className="source-dates">
                  <span>
                    TURN SCHEDULE<strong className="mono">{date}</strong>
                  </span>
                  <span>
                    AIRPORT WORKBOOK
                    <strong className="mono">
                      {airport.date || 'Date unavailable'}
                    </strong>
                  </span>
                </div>
                <p>
                  {!hasDay
                    ? `No ${date} airport assignments were found. Upload the airport plan for this operating day to verify its gates.`
                    : 'Individual flight dates are still checked. Only assignments with matching flight dates are compared.'}
                </p>
              </div>
              <Button variant="outline" onClick={upload} disabled={loading}>
                Replace airport plan
              </Button>
            </section>
          )}
          <div className="gate-source-bar">
            <div>
              <FileSpreadsheet size={17} />
              <span>
                <strong>{airport.name}</strong>
                <small>
                  {airport.assignments.length} dated assignments · Read in this
                  browser
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
              <strong className="text-success">{matched.length}</strong> matched
            </span>
            <span>
              <strong className={mismatches.length ? 'text-danger' : ''}>
                {mismatches.length}
              </strong>{' '}
              mismatches
            </span>
            <span>
              <strong>{unverified.length}</strong> unverified
            </span>
            <p>Unverified records are not confirmed conflicts.</p>
          </div>
          <section className="panel">
            <Tabs defaultValue="mismatches" className="gate-tabs">
              <div className="gate-filter-bar">
                <TabsList aria-label="Gate comparison results">
                  <TabsTrigger value="mismatches">
                    Mismatches {mismatches.length}
                  </TabsTrigger>
                  <TabsTrigger value="unverified">
                    Unverified {unverified.length}
                  </TabsTrigger>
                  <TabsTrigger value="matched">
                    Matched {matched.length}
                  </TabsTrigger>
                </TabsList>
                <div className="search-box">
                  <Search size={15} />
                  <Input
                    aria-label="Search gate comparisons"
                    placeholder="FIN, flight or gate"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <TabsContent value="mismatches">
                <div className="inline-note">
                  Confirm the correct assignment with the source owner, then
                  update or replace the appropriate source. Comparison does not
                  change tow routes.
                </div>
                <GateMismatchTable checks={visible(mismatches)} onFin={onFin} />
                {!visible(mismatches).length && (
                  <div className="empty-state">
                    <CheckCircle2 />
                    <div>
                      {search
                        ? 'No mismatches match your search.'
                        : matched.length && !unverified.length
                          ? 'All verified gate assignments match.'
                          : 'No confirmed gate mismatches.'}
                      {unverified.length > 0 && !search && (
                        <p className="section-subtitle">
                          {unverified.length} records could not be verified.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="unverified">
                <div className="inline-note">
                  Missing records, missing data, or ambiguous airport
                  assignments. Review source details before drawing a
                  conclusion.
                </div>
                <GateMismatchTable checks={visible(unverified)} onFin={onFin} />
                {!visible(unverified).length && (
                  <div className="empty-state">
                    {search
                      ? 'No records match your search.'
                      : 'No unverified assignments.'}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="matched">
                <GateMismatchTable checks={visible(matched)} onFin={onFin} />
                {!visible(matched).length && (
                  <div className="empty-state">
                    {search
                      ? 'No records match your search.'
                      : 'No verified matches are available yet.'}
                  </div>
                )}
              </TabsContent>
            </Tabs>
            <div className="panel-footer">
              Gate letters are ignored in this comparison: 21, A21 and 21A are
              equivalent. Original route values are preserved.
            </div>
          </section>
          {airport.warnings.length > 0 && (
            <details className="source-warnings">
              <summary>
                {airport.warnings.length} workbook parsing notes
              </summary>
              {airport.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}
