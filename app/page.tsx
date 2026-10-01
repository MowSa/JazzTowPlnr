'use client';
import { shutdownErrors, shutdownPlanErrors } from '@/lib/shutdown';
import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Upload,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
  MoveRight,
  Clock3,
  Download,
  Printer,
  Plus,
  ListChecks,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { compareGates, applyOccupancyPickups } from '@/lib/gates';
import { GateVerification } from '@/components/gate-verification';
import { GateOccupancy } from '@/components/gate-occupancy';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ConsoleNav,
  StationHeader,
  AircraftDrawer,
} from '@/components/operations-console';
import { towStatus, type BoardFilter } from '@/lib/console';
import { AircraftSearch } from '@/components/aircraft-search';
import { ReviewWorkflow } from '@/components/review-workflow';
import { OperationsOverview } from '@/components/operations-overview';
import { buildShutdown } from '@/lib/shutdown';
import ShutdownPlanner from '@/components/shutdown-planner';
import {
  makeMoves,
  longMoves,
  moveErrors,
  exportCSV,
  planIssues,
  type Turn,
  type Move,
} from '@/lib/tows';
import TowMoveEditor, { commitEditedMove } from '@/components/tow-move-editor';
import { usePlannerSession } from '@/hooks/use-planner-session';
import { SourceFilesSheet } from '@/components/source-files-sheet';
import { TowMovesTab } from '@/components/tow-moves-tab';
import { TowSheetTab } from '@/components/tow-sheet-tab';
import { kindLabel, shortFlight } from '@/components/tow-labels';

export default function Home() {
  const {
    uploadedAt,
    boardFilter,
    setBoardFilter,
    selectedFin,
    setSelectedFin,
    overnightSnapshot,
    setOvernightSnapshot,
    report,
    moves,
    setMoves,
    fileName,
    uploadRevision,
    aircraftNotes,
    setAircraftNotes,
    sourcesOpen,
    setSourcesOpen,
    tab,
    setTab,
    search,
    setSearch,
    error,
    setError,
    notice,
    setNotice,
    loading,
    dragging,
    setDragging,
    dateOverride,
    setDateOverride,
    decisions,
    setDecisions,
    holding,
    setHolding,
    editing,
    setEditing,
    editError,
    setEditError,
    airport,
    airportLoading,
    airportError,
    airportInput,
    fileInput,
    go,
    upload,
    uploadAirport,
    clearDesk,
  } = usePlannerSession();
  const [towView, setTowView] = useState('timeline');
  const [towSort, setTowSort] = useState('pickup');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const gateChecks = useMemo(
    () => (airport ? compareGates(report, airport, moves) : []),
    [report, airport, moves],
  );
  const mismatches = gateChecks.filter((c) => c.status === 'mismatch');
  const selected = useMemo(
    () =>
      moves
        .filter((m) => m.included)
        .sort(
          (a, b) =>
            (a.pickup || '99').localeCompare(b.pickup || '99') ||
            a.fin.localeCompare(b.fin),
        ),
    [moves],
  );
  const longTurns = report.turns.filter((t) => t.kind === 'long');
  const pendingLong = longTurns.filter((t) => !decisions[t.id]);
  const areaTurns = report.turns.filter((t) => t.kind === 'same-area');
  const pendingArea = areaTurns.filter((t) => !decisions[t.id]);
  const unresolved = moves.filter(
    (m) => m.kind === 'incomplete' && !m.reviewed,
  );
  const unreviewed = selected.filter(
    (m) => !m.reviewed || moveErrors(m, report.date).length > 0,
  );
  const isNewManual =
    editing?.kind === 'manual' && !moves.some((m) => m.id === editing.id);
  const issues = planIssues(moves);
  const draft =
    pendingArea.length > 0 ||
    issues.length > 0 ||
    unreviewed.length > 0 ||
    pendingLong.length > 0 ||
    unresolved.length > 0 ||
    report.warnings.length > 0;
  const filtered = moves
    .filter(
      (m) =>
        (boardFilter === 'all' || towStatus(m, report.date) === boardFilter) &&
        `${m.fin} ${m.arrFlight} ${m.depFlight} ${m.from} ${m.to}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      towSort === 'fin'
        ? a.fin.localeCompare(b.fin, undefined, { numeric: true }) ||
          a.pickup.localeCompare(b.pickup)
        : (a.pickup || '99').localeCompare(b.pickup || '99') ||
          a.fin.localeCompare(b.fin),
    );
  const reviewCount =
    pendingLong.length +
    pendingArea.length +
    unresolved.length +
    report.warnings.length +
    unreviewed.filter((m) => m.kind !== 'incomplete').length +
    issues.length;
  const detectedOvernight = useMemo(
    () => (report.date ? buildShutdown(report, report.date, '', '') : []),
    [report],
  );
  function patch(id: string, values: Partial<Move>) {
    setMoves((ms) => ms.map((m) => (m.id === id ? { ...m, ...values } : m)));
  }
  function addManual() {
    setEditing({
      id: `manual-${crypto.randomUUID()}`,
      turnId: '',
      fin: '',
      arrFlight: '',
      depFlight: '',
      from: '',
      to: '',
      pickup: '',
      release: '',
      gateOpen: '',
      actualPickup: '',
      actualDrop: '',
      depTime: '',
      tower: '',
      kind: 'manual',
      included: true,
      reviewed: false,
      reason: 'Manually added tow move',
      earliest: null,
      latest: null,
      warnings: [],
    });
    setEditError('');
  }
  function reviewMove(m: Move) {
    const errors = moveErrors(m, report.date);
    if (errors.length) {
      setEditing(m);
      setEditError(errors.join(' '));
      return;
    }
    patch(m.id, { reviewed: !m.reviewed });
  }
  function decideLong(t: Turn, tow: boolean) {
    try {
      const added = tow
        ? longMoves(t, holding[t.id] || '')
        : t.kind === 'same-area'
          ? makeMoves({
              ...report,
              turns: [
                {
                  ...t,
                  kind: 'gate',
                  reason: 'Direct same-area tow confirmed during review.',
                },
              ],
            })
          : [];
      const timed =
        airport?.occupancies.length &&
        (!airport.date || airport.date === report.date)
          ? applyOccupancyPickups(added, report, airport.occupancies)
          : added;
      setMoves((ms) => [...ms.filter((m) => m.turnId !== t.id), ...timed]);
      setDecisions((ds) => ({
        ...ds,
        [t.id]: tow ? 'tow' : t.kind === 'same-area' ? 'direct' : 'stay',
      }));
      setError('');
      setNotice(
        tow
          ? `FIN ${t.fin}: added a holding move and return move.`
          : t.kind === 'same-area'
            ? `FIN ${t.fin}: direct tow ${t.from} → ${t.to} added.`
            : `FIN ${t.fin}: marked to stay at gate ${t.from}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveEdit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const result = commitEditedMove(editing, moves, report.date);
    if ('error' in result) {
      setEditError(result.error);
      return;
    }
    const { saved, creating } = result;
    setMoves((ms) =>
      creating
        ? [...ms, saved]
        : ms.map((m) => (m.id === saved.id ? saved : m)),
    );
    setEditing(null);
    setEditError('');
    setNotice(
      `FIN ${editing.fin}: ${creating ? 'manual tow added' : 'move saved and reviewed'}.`,
    );
  }
  function download() {
    const data = exportCSV(report, selected, draft);
    const url = URL.createObjectURL(
      new Blob([data], { type: 'text/csv;charset=utf-8;' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `tow-sheet-${report.station}-${report.date}${draft ? '-DRAFT' : ''}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${draft ? 'Draft' : 'Reviewed'} tow sheet downloaded.`);
  }
  function print() {
    document.body.dataset.printReport = 'tow';
    flushSync(() => setTab('sheet'));
    window.print();
  }
  return (
    <SidebarProvider
      className={`operations-shell ${navCollapsed ? 'nav-collapsed' : ''}`}
    >
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <ConsoleNav
        tab={tab}
        go={go}
        reviewCount={reviewCount}
        gateCount={mismatches.length}
        overnightCount={
          overnightSnapshot.rows.filter(
            (r) =>
              !r.reviewed ||
              shutdownErrors(r).length > 0 ||
              r.requestStatus === 'pending',
          ).length +
          shutdownPlanErrors(overnightSnapshot.rows).length +
          (overnightSnapshot.dirty ? 1 : 0)
        }
        towCount={selected.length}
        collapsed={navCollapsed}
        toggle={() => setNavCollapsed((v) => !v)}
      />
      <div className="console-main">
        <StationHeader
          station={report.station}
          date={report.date || airport?.date || ''}
          uploadedAt={uploadedAt}
          turns={report.turns.length}
          tows={selected.length}
          actions={reviewCount}
          airportLoaded={!!airport}
          dateMismatch={
            !!airport?.date && !!report.date && airport.date !== report.date
          }
          onFiles={() => setSourcesOpen(true)}
          moves={moves}
          onNextPickup={(fin) => {
            setSelectedFin(fin);
            go('moves');
          }}
          search={
            <AircraftSearch
              report={report}
              moves={moves}
              overnight={overnightSnapshot}
              onFin={setSelectedFin}
            />
          }
        />
        <main id="workspace" tabIndex={-1}>
          <div
            className={`page-heading no-print${tab === 'occupancy' || tab === 'moves' ? ' is-compact' : ''}`}
          >
            <div className="heading-copy">
              <div className="eyebrow">{report.station} / OPERATING PLAN</div>
              <div className="title-line">
                <h1>
                  {
                    (
                      {
                        overview: 'Operations Overview',
                        moves: 'Tow Plan',
                        schedule: 'Flight Schedule',
                        sheet: 'Reports / Outputs',
                        mismatch: 'Gate Verification',
                        occupancy: 'Gate Timeline',
                        shutdown: 'Overnight Plan',
                        review: 'Review & Resolve',
                      } as Record<string, string>
                    )[tab]
                  }
                </h1>
                <Badge
                  variant="outline"
                  className={`plan-status ${!fileName ? 'is-new' : draft ? 'is-draft' : 'is-ready'}`}
                >
                  {!fileName
                    ? airport
                      ? 'Airport plan loaded'
                      : 'No plan loaded'
                    : draft
                      ? 'Draft tow plan'
                      : 'Tow plan ready'}
                </Badge>
              </div>
              <p className="section-subtitle">
                {tab === 'mismatch'
                  ? 'Compare Jazz turn-view gates with airport assignments.'
                  : tab === 'occupancy'
                    ? 'Airport gate occupancy from the daily planning workbook.'
                    : tab === 'shutdown'
                      ? 'Aircraft positions and maintenance requirements for the night.'
                      : tab === 'review'
                        ? 'Resolve operational decisions before issuing the plan.'
                        : tab === 'overview'
                          ? 'The operating picture, with exceptions first.'
                          : 'Aircraft movements · All schedule times local'}
              </p>
            </div>
          </div>
          <SourceFilesSheet
            sourcesOpen={sourcesOpen}
            setSourcesOpen={setSourcesOpen}
            error={error}
            dragging={dragging}
            setDragging={setDragging}
            fileName={fileName}
            report={report}
            dateOverride={dateOverride}
            setDateOverride={setDateOverride}
            loading={loading}
            upload={upload}
            fileInput={fileInput}
            airport={airport}
            airportLoading={airportLoading}
            airportError={airportError}
            airportInput={airportInput}
            clearDesk={clearDesk}
          />
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
            }}
          />
          <input
            hidden
            ref={airportInput}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              if (e.target.files?.[0]) void uploadAirport(e.target.files[0]);
            }}
          />
          {loading && (
            <output className="analysis-progress no-print">
              <span className="analysis-pulse" />
              <div>
                <strong>Analyzing operating plan…</strong>
                <p>
                  Reading aircraft turns and calculating proposed movements.
                </p>
              </div>
            </output>
          )}
          {airport?.date &&
            report.date &&
            airport.date !== report.date &&
            tab !== 'mismatch' &&
            tab !== 'occupancy' && (
              <button
                className="global-source-warning no-print"
                onClick={() => go('mismatch')}
              >
                <AlertTriangle size={16} />
                <span>
                  Source dates differ: turn schedule {report.date} / airport
                  plan {airport.date}
                </span>
                <span>
                  Check files <ArrowRight size={14} />
                </span>
              </button>
            )}
          {error && (
            <div role="alert" className="message error no-print">
              <AlertTriangle size={18} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {issues.map((issue) => (
            <div role="alert" key={issue} className="message error no-print">
              <AlertTriangle size={18} />
              {issue}
            </div>
          ))}
          {notice && (
            <output className="message notice toast no-print">
              <CheckCircle2 size={17} />
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </output>
          )}
          {!fileName && tab !== 'occupancy' && tab !== 'mismatch' ? (
            <Card className="session-empty no-print">
              <CardContent>
                <FileSpreadsheet size={34} />
                <h2>Start a new operating day</h2>
                <p>
                  Upload your flight schedule to plan tows and prepare the
                  overnight shutdown report, or open the gate timeline to
                  visualize an airport plan.
                </p>
                <Button
                  className="button primary"
                  onClick={() => fileInput.current?.click()}
                  disabled={loading}
                >
                  <Upload size={17} />
                  Upload flight schedule
                </Button>
                <Button
                  className="button"
                  variant="outline"
                  onClick={() => go('occupancy')}
                >
                  Visualize airport gate plan
                </Button>
                <small>
                  Refresh keeps the working plan in this tab. Use Clear desk in
                  Source files to start empty.
                </small>
              </CardContent>
            </Card>
          ) : !fileName ? (
            tab === 'occupancy' ? (
              <GateOccupancy
                airport={airport}
                date={airport?.date || ''}
                station={report.station}
                loading={airportLoading}
                error={airportError}
                upload={() => airportInput.current?.click()}
              />
            ) : (
              <GateVerification
                airport={airport}
                checks={gateChecks}
                date={report.date}
                loading={airportLoading}
                error={airportError}
                upload={() => airportInput.current?.click()}
                onFin={setSelectedFin}
              />
            )
          ) : (
            <>
              {tab === 'moves' && (
                <ToggleGroup
                  className="status-strip no-print"
                  aria-label="Filter tow board by status"
                  value={[boardFilter]}
                  onValueChange={(values) => {
                    setBoardFilter(
                      (values[0] || 'all') as
                        | BoardFilter
                        | 'ready'
                        | 'excluded',
                    );
                    go('moves');
                  }}
                >
                  {(
                    [
                      { id: 'all', label: 'Total tows', Icon: MoveRight },
                      {
                        id: 'review',
                        label: 'Awaiting review',
                        Icon: ListChecks,
                      },
                      { id: 'ready', label: 'Ready', Icon: Check },
                      { id: 'progress', label: 'In progress', Icon: Clock3 },
                      {
                        id: 'completed',
                        label: 'Completed',
                        Icon: CheckCircle2,
                      },
                      { id: 'excluded', label: 'Excluded', Icon: X },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <ToggleGroupItem
                      value={id}
                      key={id}
                      className={`status-tile status-${id}`}
                    >
                      <Icon size={17} />
                      <span>{label}</span>
                      <strong>
                        {(id === 'all'
                          ? moves.length
                          : moves.filter(
                              (m) => towStatus(m, report.date) === id,
                            ).length
                        )
                          .toString()
                          .padStart(2, '0')}
                      </strong>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
              <Tabs
                value={tab}
                onValueChange={(value) => go(String(value))}
                className="workspace-tabs"
              >
                <div className="workspace-toolbar no-print">
                  {['moves', 'schedule', 'sheet'].includes(tab) && (
                    <TabsList variant="line">
                      <TabsTrigger value="moves">Tow plan</TabsTrigger>
                      <TabsTrigger value="schedule">
                        Flight schedule
                      </TabsTrigger>
                      <TabsTrigger value="sheet">Printable sheet</TabsTrigger>
                    </TabsList>
                  )}
                  {['moves', 'schedule', 'sheet'].includes(tab) && (
                    <div className="actions">
                      <Button
                        className="button"
                        variant="outline"
                        onClick={addManual}
                      >
                        <Plus size={16} />
                        Add tow
                      </Button>
                      <Button
                        className="button"
                        variant="outline"
                        onClick={download}
                        disabled={!selected.length}
                      >
                        <Download size={16} />
                        Export CSV
                      </Button>
                      <Button
                        className="button"
                        variant="outline"
                        onClick={print}
                        disabled={!selected.length}
                      >
                        <Printer size={16} />
                        Print sheet
                      </Button>
                    </div>
                  )}
                </div>
                <TabsContent value="overview" className="no-print">
                  <OperationsOverview
                    report={report}
                    moves={moves}
                    pending={[...pendingArea, ...pendingLong]}
                    reviewCount={reviewCount}
                    gateChecks={gateChecks}
                    airportLoaded={!!airport}
                    overnight={overnightSnapshot}
                    overnightCount={
                      overnightSnapshot.generated
                        ? overnightSnapshot.rows.length
                        : detectedOvernight.length
                    }
                    draft={draft}
                    go={go}
                    onFin={setSelectedFin}
                  />
                </TabsContent>
                <TabsContent value="moves" className="no-print gantt-view">
                  <TowMovesTab
                    report={report}
                    moves={moves}
                    filtered={filtered}
                    selected={selected}
                    unreviewed={unreviewed}
                    pendingArea={pendingArea}
                    pendingLong={pendingLong}
                    boardFilter={boardFilter}
                    search={search}
                    setSearch={setSearch}
                    towView={towView}
                    setTowView={setTowView}
                    towSort={towSort}
                    setTowSort={setTowSort}
                    selectedFin={selectedFin}
                    setSelectedFin={setSelectedFin}
                    setEditing={setEditing}
                    setEditError={setEditError}
                    patch={patch}
                    reviewMove={reviewMove}
                    go={go}
                  />
                </TabsContent>
                <TabsContent value="review" className="no-print">
                  <ReviewWorkflow
                    report={report}
                    moves={moves}
                    decisions={decisions}
                    holding={holding}
                    issues={issues}
                    reviewCount={reviewCount}
                    draft={draft}
                    gateConflicts={mismatches.length}
                    overnight={overnightSnapshot}
                    onFin={setSelectedFin}
                    onHolding={(id, value) =>
                      setHolding((h) => ({ ...h, [id]: value }))
                    }
                    onDecision={decideLong}
                    onRevisit={(t) => {
                      setDecisions((ds) => {
                        const next = { ...ds };
                        delete next[t.id];
                        return next;
                      });
                      setMoves((ms) => ms.filter((m) => m.turnId !== t.id));
                    }}
                    onEdit={(m) => {
                      setEditing({ ...m });
                      setEditError('');
                    }}
                    onReview={reviewMove}
                    onExclude={(m) =>
                      patch(m.id, { reviewed: true, included: false })
                    }
                    go={go}
                  />
                </TabsContent>
                <TabsContent
                  value="schedule"
                  className="schedule-panel no-print"
                >
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Flight schedule</h2>
                      <span className="muted">
                        {report.turns.length} active turns · gate prefixes
                        normalized
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {[
                            'FIN #',
                            'ORIGIN',
                            'ARR FLIGHT',
                            'ARRIVAL (SOURCE)',
                            'ARR GATE',
                            'DEP GATE',
                            'DEP FLIGHT',
                            'DEPARTURE (SOURCE)',
                            'DESTINATION',
                            'RESULT',
                          ].map((h) => (
                            <TableHead key={h}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.turns.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="fin">
                              <Button
                                variant="link"
                                className="fin-link"
                                onClick={() => setSelectedFin(t.fin)}
                              >
                                {t.fin || '—'}
                              </Button>
                            </TableCell>
                            <TableCell>{t.origin}</TableCell>
                            <TableCell>
                              {shortFlight(t.arrFlight) || '—'}
                            </TableCell>
                            <TableCell>{t.arrLabel || '—'}</TableCell>
                            <TableCell>{t.from || '—'}</TableCell>
                            <TableCell>{t.to || '—'}</TableCell>
                            <TableCell>
                              {shortFlight(t.depFlight) || '—'}
                            </TableCell>
                            <TableCell>{t.depLabel || '—'}</TableCell>
                            <TableCell>{t.destination}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`reason-badge ${t.kind === 'none' ? 'neutral' : ''}`}
                              >
                                {kindLabel[t.kind]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="panel-footer">
                      TOD is departure and TOA is arrival. A / E / S mean
                      actual, estimated, and scheduled. An actual departure in
                      column L means no tow is required.
                    </div>
                  </section>
                </TabsContent>
                <TabsContent value="sheet" keepMounted className="sheet-tab">
                  <TowSheetTab
                    report={report}
                    selected={selected}
                    unreviewed={unreviewed}
                    unresolved={unresolved}
                    pendingArea={pendingArea}
                    pendingLong={pendingLong}
                    issues={issues}
                    draft={draft}
                    reviewCount={reviewCount}
                    aircraftNotes={aircraftNotes}
                    go={go}
                  />
                </TabsContent>
                <TabsContent value="mismatch" className="no-print">
                  <GateVerification
                    airport={airport}
                    checks={gateChecks}
                    date={report.date}
                    loading={airportLoading}
                    error={airportError}
                    upload={() => airportInput.current?.click()}
                    onFin={setSelectedFin}
                  />
                </TabsContent>
                <TabsContent value="occupancy" className="no-print">
                  <GateOccupancy
                    airport={airport}
                    date={report.date || airport?.date || ''}
                    station={report.station}
                    loading={airportLoading}
                    error={airportError}
                    upload={() => airportInput.current?.click()}
                  />
                </TabsContent>
                <TabsContent
                  value="shutdown"
                  keepMounted
                  className="shutdown-tab"
                >
                  <ShutdownPlanner
                    key={uploadRevision}
                    report={report}
                    initial={overnightSnapshot}
                    onSnapshot={setOvernightSnapshot}
                    onFin={setSelectedFin}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
          <footer className="app-footer no-print">
            <span>JazzTow · {report.station} operations</span>
            <span>
              Review aircraft location and operational readiness before issuing.
            </span>
          </footer>
        </main>
        <TowMoveEditor
          editing={editing}
          editError={editError}
          report={report}
          isNewManual={isNewManual}
          onChange={setEditing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSubmit={saveEdit}
        />
        <AircraftDrawer
          gateChecks={gateChecks}
          airportLoaded={!!airport}
          decisions={decisions}
          go={(page) => {
            setSelectedFin(null);
            go(page);
          }}
          note={selectedFin ? aircraftNotes[selectedFin] || '' : ''}
          onNote={(note) => {
            if (selectedFin)
              setAircraftNotes((notes) => ({ ...notes, [selectedFin]: note }));
          }}
          fin={selectedFin}
          close={() => setSelectedFin(null)}
          report={report}
          moves={moves}
          overnight={overnightSnapshot}
          edit={(m) => {
            setSelectedFin(null);
            setEditing({ ...m });
            setEditError('');
          }}
        />
      </div>
    </SidebarProvider>
  );
}
