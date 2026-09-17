'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  readAirportWorkbook,
  applyOccupancyPickups,
  type AirportPlan,
} from '@/lib/gates';
import { analyze, makeMoves, type Report, type Move } from '@/lib/tows';
import { publishScheduledArrivals } from '@/lib/yul-ops/schedule-sta';
import {
  usePlannerSessionGuard,
  createRequestGuard,
  type PlannerWork,
} from '@/hooks/use-planner-session-guard';
import {
  clearPlannerSnapshot,
  loadPlannerSnapshot,
  savePlannerSnapshot,
  type OvernightSnapshot,
  type PlannerSnapshot,
} from '@/lib/planner-session';

export const REPLACE_SCHEDULE_PROMPT =
  'Replace the current working schedule? Edits made this session will be lost.';

export const CLEAR_DESK_PROMPT =
  'Clear this desk? The working plan will be removed from this tab.';

const emptyOvernight = (): OvernightSnapshot => ({
  rows: [],
  date: '',
  dirty: false,
  generated: false,
  required: '',
  allowed: '',
  source: '',
});

export const initialReport: Report = {
  date: '',
  station: 'YUL',
  turns: [],
  cancelled: 0,
  duplicates: 0,
  warnings: [],
};

type Registry = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (v: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

/** Session-only schedule, airport plan, and import/replace handling. */
export function usePlannerSession() {
  const [uploadedAt, setUploadedAt] = useState<number | null>(null);
  const [boardFilter, setBoardFilter] = useState<
    import('@/lib/console').BoardFilter | 'ready' | 'excluded'
  >('all');
  const [selectedFin, setSelectedFin] = useState<string | null>(null);
  const [overnightSnapshot, setOvernightSnapshot] =
    useState<OvernightSnapshot>(emptyOvernight);
  const [report, setReport] = useState<Report>(initialReport);
  const [moves, setMoves] = useState<Move[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploadRevision, setUploadRevision] = useState(0);
  const [aircraftNotes, setAircraftNotes] = useState<Record<string, string>>(
    {},
  );
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dateOverride, setDateOverride] = useState('');
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [holding, setHolding] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Move | null>(null);
  const [editError, setEditError] = useState('');
  const [airport, setAirport] = useState<AirportPlan | null>(null);
  const [airportLoading, setAirportLoading] = useState(false);
  const [airportError, setAirportError] = useState('');
  const airportInput = useRef<HTMLInputElement>(null);
  const airportGeneration = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);
  const skipSave = useRef(false);

  function applySnapshot(snap: PlannerSnapshot) {
    setUploadedAt(snap.uploadedAt);
    setBoardFilter(snap.boardFilter);
    setOvernightSnapshot(snap.overnightSnapshot);
    setReport(snap.report);
    setMoves(snap.moves);
    setFileName(snap.fileName);
    setAircraftNotes(snap.aircraftNotes);
    setDateOverride(snap.dateOverride);
    setDecisions(snap.decisions);
    setHolding(snap.holding);
    setAirport(snap.airport);
    setTab(snap.tab || 'overview');
    setEditing(null);
    setSearch('');
    setError('');
    setAirportError('');
  }

  function resetDesk() {
    setUploadedAt(null);
    setBoardFilter('all');
    setSelectedFin(null);
    setOvernightSnapshot(emptyOvernight());
    setReport(initialReport);
    setMoves([]);
    setFileName('');
    setUploadRevision((v) => v + 1);
    setAircraftNotes({});
    setSourcesOpen(false);
    setTab('overview');
    setSearch('');
    setError('');
    setNotice('');
    setDateOverride('');
    setDecisions({});
    setHolding({});
    setEditing(null);
    setEditError('');
    setAirport(null);
    setAirportError('');
    setAirportLoading(false);
    clearPlannerSnapshot();
  }

  function clearDesk() {
    if (!window.confirm(CLEAR_DESK_PROMPT)) return;
    resetDesk();
    setNotice('Desk cleared.');
  }

  useLayoutEffect(() => {
    const snap = loadPlannerSnapshot();
    if (snap && (snap.fileName || snap.report.date || snap.airport)) {
      applySnapshot(snap);
      skipSave.current = true;
    }
    hydrated.current = true;
  }, []);

  function go(value: string) {
    setTab(value);
  }

  const plannerWork: PlannerWork = useMemo(
    () => ({
      scheduleLoaded: !!fileName || !!report.date,
      movesCount: moves.length,
      airportLoaded: !!airport,
      editsPresent:
        report.warnings.length > 0 ||
        Object.values(aircraftNotes).some((n) => !!n.trim()),
    }),
    [fileName, report, moves.length, airport, aircraftNotes],
  );
  const { confirmReplace } = usePlannerSessionGuard(plannerWork);
  const importGuardRef = useRef(createRequestGuard());
  const importGuard = importGuardRef.current;
  const importText = useCallback(
    (text: string, name: string, date?: string) => {
      const generation = importGuard.begin();
      const result = analyze(text, date);
      if (!importGuard.isCurrent(generation)) return;
      setAirport(null);
      setAirportError('');
      setAirportLoading(false);
      setReport(result);
      setMoves(makeMoves(result));
      setFileName(name);
      setUploadedAt(Date.now());
      setBoardFilter('all');
      setSelectedFin(null);
      setAircraftNotes({});
      setOvernightSnapshot(emptyOvernight());
      setUploadRevision((v) => v + 1);
      setDecisions({});
      setHolding({});
      setEditing(null);
      setSearch('');
      setTab('overview');
      setSourcesOpen(false);
      setError('');
      setNotice(
        `${result.turns.length} aircraft turns analyzed. Review the proposed moves before issuing the sheet.`,
      );
      return result;
    },
    [importGuard],
  );

  async function uploadAirport(file: File) {
    const generation = ++airportGeneration.current;
    setAirportLoading(true);
    setAirportError('');
    try {
      if (!/\.xlsx$/i.test(file.name))
        throw Error('Upload the airport .xlsx workbook.');
      if (file.size > 10 * 1024 * 1024)
        throw Error('Use a daily workbook smaller than 10 MB.');
      const plan = await readAirportWorkbook(
        await file.arrayBuffer(),
        file.name,
      );
      if (generation !== airportGeneration.current) return;
      setAirport(plan);
      setMoves((ms) => {
        if (!report.date || (plan.date && plan.date !== report.date)) return ms;
        return applyOccupancyPickups(ms, report, plan.occupancies);
      });
      if (report.date && (!plan.date || plan.date === report.date)) {
        setNotice(
          'Airport plan loaded. Departure tow pickups now follow gate occupancy.',
        );
      }
    } catch (e) {
      if (generation === airportGeneration.current)
        setAirportError(
          e instanceof Error
            ? e.message
            : 'Could not read the airport workbook.',
        );
    } finally {
      if (generation === airportGeneration.current) setAirportLoading(false);
      if (airportInput.current) airportInput.current.value = '';
    }
  }

  async function upload(file: File) {
    setError('');
    setLoading(true);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error('Please use a CSV smaller than 5 MB.');
      if (!/\.csv$/i.test(file.name))
        throw Error('Please upload a .csv flight schedule.');
      const text = await file.text();
      analyze(text, dateOverride || undefined);
      if (!confirmReplace(REPLACE_SCHEDULE_PROMPT)) return;
      importText(text, file.name, dateOverride || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to read this file.');
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  useEffect(() => {
    const fresh = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', fresh);
    return () => window.removeEventListener('pageshow', fresh);
  }, []);

  const stateRef = useRef({ report, moves, importText });
  useEffect(() => {
    stateRef.current = { report, moves, importText };
  }, [report, moves, importText]);

  useEffect(() => {
    publishScheduledArrivals(report);
  }, [report]);

  useEffect(() => {
    const registry = (document as Document & { modelContext?: Registry })
      .modelContext;
    if (!registry?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'analyze_flight_csv',
        title: 'Analyze flight CSV',
        description:
          'Replace the current working schedule with a turn-view CSV and display suggested tows. Current edits are replaced.',
        inputSchema: {
          type: 'object',
          properties: {
            csv: { type: 'string' },
            fileName: { type: 'string' },
            operatingDate: { type: 'string' },
          },
          required: ['csv'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (input: unknown) => {
          const v = input as Record<string, unknown>;
          if (
            !v ||
            typeof v.csv !== 'string' ||
            v.csv.length > 5 * 1024 * 1024 ||
            (v.operatingDate !== undefined &&
              typeof v.operatingDate !== 'string') ||
            (v.fileName !== undefined && typeof v.fileName !== 'string')
          )
            throw Error(
              'Provide CSV text and an optional operating date / filename.',
            );
          let r: Report | undefined;
          flushSync(() => {
            r = stateRef.current.importText(
              v.csv as string,
              typeof v.fileName === 'string'
                ? v.fileName
                : 'Uploaded schedule.csv',
              v.operatingDate as string | undefined,
            );
          });
          return {
            date: r!.date,
            turns: r!.turns.length,
            proposedMoves: makeMoves(r!).length,
            cancelled: r!.cancelled,
          };
        },
      },
      {
        name: 'read_tow_plan',
        title: 'Read tow plan',
        description:
          'Read the current tow plan, review status and data issues.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          date: stateRef.current.report.date,
          moves: stateRef.current.moves,
          warnings: stateRef.current.report.warnings,
        }),
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          registry.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Browser support is optional. */
      }
    }
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    document.body.dataset.printReport = tab === 'shutdown' ? 'shutdown' : 'tow';
    const prepare = () => {
      document.body.dataset.printReport =
        tab === 'shutdown' ? 'shutdown' : 'tow';
    };
    window.addEventListener('beforeprint', prepare);
    return () => window.removeEventListener('beforeprint', prepare);
  }, [tab]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (!fileName && !report.date && !airport) {
      clearPlannerSnapshot();
      return;
    }
    savePlannerSnapshot({
      v: 1,
      uploadedAt,
      report,
      moves,
      fileName,
      aircraftNotes,
      overnightSnapshot,
      airport,
      decisions,
      holding,
      dateOverride,
      boardFilter,
      tab,
    });
  }, [
    uploadedAt,
    report,
    moves,
    fileName,
    aircraftNotes,
    overnightSnapshot,
    airport,
    decisions,
    holding,
    dateOverride,
    boardFilter,
    tab,
  ]);

  return {
    uploadedAt,
    boardFilter,
    setBoardFilter,
    selectedFin,
    setSelectedFin,
    overnightSnapshot,
    setOvernightSnapshot,
    report,
    setReport,
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
    importText,
    upload,
    uploadAirport,
    clearDesk,
  };
}
