import {
  gate,
  towLocation,
  clock,
  roundPickup,
  type Report,
  type Move,
  type Turn,
} from './tows.ts';
export type Assignment = {
  flight: string;
  key: string;
  direction: 'arrival' | 'departure';
  dates: string[];
  gate: string;
  sheet: string;
  row: number;
  time: string;
};
export type GateOccupancy = {
  id: string;
  gate: string;
  airline: string;
  arrFlight: string;
  depFlight: string;
  start: string;
  end: string;
  overnight: boolean;
  towedIn: boolean;
  towedOut: boolean;
  sheet: string;
  row: number;
};
export type AirportPlan = {
  name: string;
  date: string;
  assignments: Assignment[];
  occupancies: GateOccupancy[];
  warnings: string[];
};
export type GateCheck = {
  id: string;
  turnId: string;
  fin: string;
  flight: string;
  direction: 'arrival' | 'departure';
  date: string;
  csvGate: string;
  airportGate: string;
  status: 'match' | 'mismatch' | 'unmatched' | 'ambiguous' | 'missing';
  sources: string[];
  tow: boolean;
};
export function comparisonGate(value: string) {
  const raw = (value.split('/').pop() || '').trim().toUpperCase();
  const numeric = /^(?:[AC])?(\d+)[A-Z]*$/.exec(raw);
  return numeric ? gate(numeric[1]) : raw;
}
export function flightKey(value: string) {
  const m = /^([A-Z]{2,3})\s*0*(\d+)([A-Z]?)$/.exec(value.trim().toUpperCase());
  if (!m) return '';
  const carrier = ['QK', 'JZA', 'AC', 'ACA'].includes(m[1]) ? 'AC' : m[1];
  return `${carrier}${Number(m[2])}${m[3]}`;
}
const text = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && !(v instanceof Date)) {
    const o = v as {
      result?: unknown;
      text?: string;
      richText?: { text: string }[];
    };
    return o.result !== undefined
      ? text(o.result)
      : o.text || o.richText?.map((x) => x.text).join('') || '';
  }
  return String(v).trim();
};
function dateTime(v: unknown, date1904 = false): string {
  if (v instanceof Date)
    return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 16) : '';
  if (typeof v === 'object' && v && 'result' in v)
    return dateTime((v as { result: unknown }).result, date1904);
  if (typeof v === 'number' && v > 1 && v < 100000)
    return new Date((v - (date1904 ? 24107 : 25569)) * 86400000)
      .toISOString()
      .slice(0, 16);
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)
    ? s.slice(0, 16).replace(' ', 'T')
    : '';
}
function timeMarker(v: unknown) {
  const s = text(v).toUpperCase();
  return s === 'O/N' ? 'overnight' : s === 'TOW' ? 'tow' : '';
}
export function carrierCode(flight: string) {
  const m = /^([A-Z]{2,3})/.exec(flight.trim().toUpperCase());
  if (!m) return '';
  return ['QK', 'JZA', 'AC', 'ACA'].includes(m[1]) ? 'AC' : m[1];
}
export function occupancyInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const t = Date.parse(value.length === 16 ? value + ':00Z' : value);
  return Number.isFinite(t) ? t : null;
}
export function occupancyFlights(o: GateOccupancy) {
  return o.arrFlight && o.depFlight && o.arrFlight !== o.depFlight
    ? `${o.arrFlight} / ${o.depFlight}`
    : o.arrFlight || o.depFlight;
}
export function formatOccupancyDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return 'Duration unknown';
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60),
    m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
export function occupancyKnownDuration(o: GateOccupancy) {
  const start = occupancyInstant(o.start),
    end = occupancyInstant(o.end);
  return start !== null && end !== null ? end - start : null;
}
export type OccupancyKind = 'turn' | 'arrival' | 'departure';
export type OccupancyBlock = 'stay' | 'overnight' | 'tow-in' | 'tow-out';
export type OccupancySpan = {
  start: number;
  end: number;
  estimated: boolean;
  continued: 'start' | 'end' | 'both' | null;
  kind: OccupancyKind;
  block: OccupancyBlock;
};
const TOW_IN_MS = 60 * 60000,
  TOW_OUT_MS = 30 * 60000,
  MORNING_DEP = 9 * 60 * 60000;
function occupancyKind(o: GateOccupancy, block: OccupancyBlock): OccupancyKind {
  if (block === 'tow-in') return 'departure';
  if (block === 'tow-out') return 'arrival';
  if (o.arrFlight && o.depFlight) return 'turn';
  if (o.depFlight && !o.arrFlight) return 'departure';
  return 'arrival';
}
function morningDeparture(end: number, dayStart: number) {
  return end >= dayStart && end < dayStart + MORNING_DEP;
}
export function clipOccupancy(
  o: GateOccupancy,
  date: string,
): OccupancySpan | null {
  const dayStart = Date.parse(date + 'T00:00:00Z'),
    dayEnd = dayStart + 86400000;
  if (!Number.isFinite(dayStart)) return null;
  let start = occupancyInstant(o.start),
    end = occupancyInstant(o.end),
    estimated = false,
    block: OccupancyBlock = 'stay';
  const arrBeforeDay = start !== null && start < dayStart,
    depToday = end !== null && end >= dayStart && end < dayEnd;
  if (arrBeforeDay) {
    if (depToday && morningDeparture(end!, dayStart)) {
      start = dayStart;
      block = 'overnight';
    } else if (depToday) {
      start = end! - TOW_IN_MS;
      estimated = true;
      block = 'tow-in';
    } else return null;
  } else if (start === null && o.overnight && end !== null) {
    if (morningDeparture(end, dayStart)) {
      start = dayStart;
      block = 'overnight';
    } else {
      start = end - TOW_IN_MS;
      estimated = true;
      block = 'tow-in';
    }
  } else if (start === null && o.towedIn && end !== null) {
    start = end - TOW_IN_MS;
    estimated = true;
    block = 'tow-in';
  }
  if (end === null && o.towedOut && start !== null) {
    if (start < dayStart) return null;
    end = start + TOW_OUT_MS;
    estimated = true;
    block = 'tow-out';
  }
  if (start === null || end === null || end <= start) return null;
  const left = Math.max(start, dayStart),
    right = Math.min(end, dayEnd);
  if (right <= left) return null;
  const continued =
    start < dayStart && end > dayEnd
      ? 'both'
      : start < dayStart
        ? 'start'
        : end > dayEnd
          ? 'end'
          : null;
  return {
    start: left,
    end: right,
    estimated,
    continued,
    kind: occupancyKind(o, block),
    block,
  };
}
export function occupancyBlockDuration(span: OccupancySpan) {
  return formatOccupancyDuration(span.end - span.start);
}
export function occupancyKindLabel(kind: OccupancyKind) {
  return kind === 'turn'
    ? 'Turn'
    : kind === 'arrival'
      ? 'Arrival only'
      : 'Departure only';
}
export function occupancyDurationLabel(span: OccupancySpan) {
  const duration = occupancyBlockDuration(span);
  if (span.block === 'tow-in') return `${duration} tow in`;
  if (span.block === 'tow-out') return `${duration} tow out`;
  if (span.block === 'overnight') return `${duration} overnight`;
  return duration;
}
export function sortGates(gates: string[]) {
  return [...gates].sort((a, b) => {
    const an = /^(\d+)/.exec(a),
      bn = /^(\d+)/.exec(b);
    if (an && bn && Number(an[1]) !== Number(bn[1]))
      return Number(an[1]) - Number(bn[1]);
    if (!!an !== !!bn) return an ? -1 : 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}
const OCCUPANCY_GATE_ALIASES: Record<string, string> = {
  '2A': '02',
  '02A': '02',
  '5A': '05',
  '05A': '05',
  '11B': '11',
  '77B': '77',
  '79A': '79',
  '84A': '84',
};
export function occupancyRowGate(gate: string) {
  const raw = (gate || '').trim().toUpperCase();
  return OCCUPANCY_GATE_ALIASES[raw] || raw;
}
export function occupancyLanes(items: GateOccupancy[], date: string) {
  const lanes = new Map<string, number>(),
    placed: { start: number; end: number; lane: number }[] = [];
  const timed = items
    .map((o) => ({ o, span: clipOccupancy(o, date) }))
    .filter(
      (
        x,
      ): x is {
        o: GateOccupancy;
        span: NonNullable<ReturnType<typeof clipOccupancy>>;
      } => !!x.span,
    )
    .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
  for (const { o, span } of timed) {
    let lane = 0;
    while (
      placed.some(
        (p) => p.lane === lane && p.start < span.end && span.start < p.end,
      )
    )
      lane++;
    placed.push({ start: span.start, end: span.end, lane });
    lanes.set(o.id, lane);
  }
  return lanes;
}
export function occupancyConflicts(items: GateOccupancy[], date: string) {
  const ids = new Set<string>(),
    timed = items
      .map((o) => ({ o, span: clipOccupancy(o, date) }))
      .filter((x) => x.span && !x.span.estimated);
  for (let i = 0; i < timed.length; i++)
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i].span!,
        b = timed[j].span!;
      if (a.start < b.end && b.start < a.end) {
        ids.add(timed[i].o.id);
        ids.add(timed[j].o.id);
      }
    }
  return ids;
}
/** Same-gate overlaps for the full day. Filter display after, never before. */
export function occupancyConflictIds(items: GateOccupancy[], date: string) {
  const byGate = new Map<string, GateOccupancy[]>();
  for (const o of items) {
    const key = occupancyRowGate(o.gate);
    const group = byGate.get(key);
    if (group) group.push(o);
    else byGate.set(key, [o]);
  }
  const ids = new Set<string>();
  for (const group of byGate.values()) {
    for (const id of occupancyConflicts(group, date)) ids.add(id);
  }
  return ids;
}
const FIVE_MIN = 5 * 60000,
  THIRTY_MIN = 30 * 60000,
  NINETY_MIN = 90 * 60000,
  OCCUPANT_LOOKBACK = 3 * 3600000;
function occupancyGateKey(value: string) {
  return occupancyRowGate(comparisonGate(value));
}
function ownOccupancy(o: GateOccupancy, turn: Turn) {
  const keys = [flightKey(turn.arrFlight), flightKey(turn.depFlight)].filter(
    Boolean,
  );
  return (
    keys.includes(flightKey(o.arrFlight)) ||
    keys.includes(flightKey(o.depFlight))
  );
}
function isDepartureTow(m: Move) {
  if (!m.to || towLocation(m.to) === 'BSE') return false;
  if (m.kind === 'bse-out' || m.kind === 'gate') return true;
  return (
    (m.kind === 'long' || m.kind === 'same-area') && m.id.endsWith('-return')
  );
}
function lastOccupant(
  occupancies: GateOccupancy[],
  gate: string,
  before: number,
  date: string,
  turn: Turn,
) {
  const target = occupancyGateKey(gate);
  let best: { o: GateOccupancy; span: OccupancySpan } | null = null;
  for (const o of occupancies) {
    if (occupancyGateKey(o.gate) !== target || ownOccupancy(o, turn)) continue;
    const span = clipOccupancy(o, date);
    if (!span || span.start >= before || span.end <= before - OCCUPANT_LOOKBACK)
      continue;
    if (!best || span.end > best.span.end) best = { o, span };
  }
  return best;
}
function clampPickup(value: number, m: Move, date: string) {
  let pickup = value;
  if (m.earliest !== null && pickup < m.earliest) pickup = m.earliest;
  const start = Date.parse(date + 'T00:00:00Z'),
    end = start + 86400000;
  const outside = pickup < start || pickup >= end;
  const infeasible = m.latest !== null && pickup >= m.latest;
  return { pickup: outside ? null : roundPickup(pickup), outside, infeasible };
}
/** Time a departure tow from who is on the dest gate in the airport plan. */
export function applyOccupancyPickups(
  moves: Move[],
  report: Report,
  occupancies: GateOccupancy[],
): Move[] {
  if (!occupancies.length || !report.date) return moves;
  return moves.map((m) => {
    if (m.reviewed || m.kind === 'manual' || !isDepartureTow(m)) return m;
    const turn = report.turns.find((t) => t.id === m.turnId);
    const departure = turn?.departure ?? m.latest;
    if (!turn || departure === null) return m;
    const occupant = lastOccupant(
      occupancies,
      m.to,
      departure,
      report.date,
      turn,
    );
    if (!occupant) return m;
    const departing =
      occupant.span.kind !== 'arrival' &&
      occupant.span.block !== 'tow-out' &&
      !!occupant.o.depFlight &&
      !occupant.o.towedOut;
    const otherArrival =
      occupant.span.kind === 'arrival' ||
      occupant.span.block === 'tow-out' ||
      occupant.o.towedOut;
    const otherCompany = !!occupant.o.airline && occupant.o.airline !== 'AC';
    let raw: number | null = null,
      gateOpenAt: number | null = null,
      note = '';
    if (departing) {
      const occupantDep = occupancyInstant(occupant.o.end) ?? occupant.span.end;
      gateOpenAt = occupantDep - FIVE_MIN;
      raw = gateOpenAt - FIVE_MIN;
      note = `Pickup 5 min before gate ${m.to} opens (${clock(gateOpenAt)}), 5 min before ${occupant.o.depFlight || occupant.o.airline} departure.`;
    } else if (otherArrival && otherCompany) {
      const arrived = occupancyInstant(occupant.o.start) ?? occupant.span.start;
      const preferred = departure - NINETY_MIN;
      gateOpenAt = arrived + THIRTY_MIN;
      raw = arrived > preferred ? gateOpenAt : preferred;
      note =
        arrived > preferred
          ? `Last ${occupant.o.airline} arrival ${clock(arrived)} is inside 1h 30m of departure; pickup 30 min after that arrival.`
          : `Pickup 1h 30m before departure; ${occupant.o.airline} arrival ${clock(arrived)} tows off before then.`;
    } else return m;
    if (raw === null) return m;
    const { pickup, outside, infeasible } = clampPickup(raw, m, report.date);
    const warnings = m.warnings.filter(
      (w) =>
        !w.startsWith('Pickup 5 min before gate') &&
        !w.startsWith('Last ') &&
        !w.startsWith('Pickup 1h 30m') &&
        !w.startsWith('Calculated pickup falls outside') &&
        !w.startsWith('Gate occupancy cannot support'),
    );
    if (note) warnings.push(note);
    if (infeasible && m.latest !== null) {
      const occupantUntil =
        occupancyInstant(occupant.o.end) ?? occupant.span.end;
      warnings.push(
        `Gate occupancy cannot support this departure: ${occupant.o.depFlight || occupant.o.arrFlight || occupant.o.airline} occupies gate ${m.to} until ${clock(occupantUntil)}; calculated pickup ${clock(roundPickup(raw))} is after planned departure ${clock(m.latest)}.`,
      );
    }
    if (outside)
      warnings.push(
        'Calculated pickup falls outside the sheet date. Assign a pickup on this sheet date or coordinate on the adjacent day’s sheet.',
      );
    const open =
      gateOpenAt === null
        ? m.gateOpen
        : outside
          ? ''
          : clock(roundPickup(gateOpenAt));
    return {
      ...m,
      pickup: outside || pickup === null ? '' : clock(pickup),
      gateOpen: open,
      warnings,
    };
  });
}
function rowOccupancy(
  r: unknown[],
  columns: {
    direction: 'arrival' | 'departure';
    f: number;
    t: number;
    e: number;
  }[],
  g: number,
  sheet: string,
  row: number,
  date1904: boolean,
): GateOccupancy | null {
  const arr = columns[0],
    dep = columns[1];
  const arrFlight = text(r[arr.f]),
    depFlight = text(r[dep.f]);
  if (
    /Flight|Vol|total/i.test(arrFlight) ||
    /Flight|Vol|total/i.test(depFlight)
  )
    return null;
  const assigned = g >= 0 ? towLocation(text(r[g])) : '';
  if (!assigned) return null;
  const start = dateTime(r[arr.t], date1904) || dateTime(r[arr.e], date1904);
  const end = dateTime(r[dep.t], date1904) || dateTime(r[dep.e], date1904);
  const arrMark = timeMarker(r[arr.t]),
    depMark = timeMarker(r[dep.t]);
  const overnight = arrMark === 'overnight',
    towedIn = arrMark === 'tow',
    towedOut = depMark === 'tow';
  if (!arrFlight && !depFlight && !overnight) return null;
  if (!start && !end && !overnight && !towedIn && !towedOut) return null;
  return {
    id: `${sheet}:${row}`,
    gate: assigned,
    airline: carrierCode(arrFlight || depFlight),
    arrFlight,
    depFlight,
    start,
    end,
    overnight,
    towedIn,
    towedOut,
    sheet,
    row,
  };
}
export function parseAirportSheets(
  sheets: { name: string; rows: unknown[][] }[],
  name: string,
  date1904 = false,
): AirportPlan {
  const plan: AirportPlan = {
    name,
    date: '',
    assignments: [],
    occupancies: [],
    warnings: [],
  };
  let recognized = 0;
  for (const sheet of sheets) {
    const header = sheet.rows.findIndex(
      (r) =>
        r.some((c) => /Arr Flight/i.test(text(c))) &&
        r.some((c) => /Dep Flight/i.test(text(c))) &&
        r.some((c) => /\bGate\b/i.test(text(c))),
    );
    if (header < 0) continue;
    recognized++;
    const h = sheet.rows[header].map(text);
    const index = (pattern: RegExp) => h.findIndex((c) => pattern.test(c));
    const g = index(/\bGate\b/i);
    for (const row of sheet.rows.slice(0, header)) {
      for (const c of row) {
        const m = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text(c));
        if (m && !plan.date) plan.date = m[1];
      }
    }
    const columns = [
      {
        direction: 'arrival' as const,
        f: index(/Arr Flight/i),
        t: index(/Arr Time/i),
        e: index(/^ETA$/i),
      },
      {
        direction: 'departure' as const,
        f: index(/Dep Flight/i),
        t: index(/Dep Time/i),
        e: index(/^ETD$/i),
      },
    ];
    if (columns.some((c) => c.t < 0))
      throw Error(`Missing arrival/departure time headers in ${sheet.name}.`);
    for (let i = header + 1; i < sheet.rows.length; i++) {
      const r = sheet.rows[i];
      for (const c of columns) {
        const flight = text(r[c.f]);
        if (!flight) continue;
        const key = flightKey(flight);
        if (!key) {
          if (!/Flight|Vol|total/i.test(flight))
            plan.warnings.push(
              `${sheet.name}, row ${i + 1}: unrecognized flight ${flight}.`,
            );
          continue;
        }
        const times = [
          dateTime(r[c.t], date1904),
          dateTime(r[c.e], date1904),
        ].filter(Boolean);
        const dates = [...new Set(times.map((t) => t.slice(0, 10)))];
        if (!dates.length) {
          plan.warnings.push(
            `${sheet.name}, row ${i + 1}: ${flight} ${c.direction} has no dated time; not matched.`,
          );
          continue;
        }
        plan.assignments.push({
          flight,
          key,
          direction: c.direction,
          dates,
          gate: gate(text(r[g])),
          sheet: sheet.name,
          row: i + 1,
          time: times[0],
        });
      }
      const occupancy = rowOccupancy(
        r,
        columns,
        g,
        sheet.name,
        i + 1,
        date1904,
      );
      if (occupancy) plan.occupancies.push(occupancy);
    }
  }
  if (!recognized)
    throw Error(
      'No airport assignment table found. Expected Arr Flight, Arr Time, Dep Flight, Dep Time and Gate headers.',
    );
  if (!plan.assignments.length)
    throw Error('No dated flight assignments found in this workbook.');
  return plan;
}
export async function readAirportWorkbook(
  data: ArrayBuffer,
  name: string,
): Promise<AirportPlan> {
  const module = await import('exceljs');
  const Workbook = module.default?.Workbook || module.Workbook;
  const workbook = new Workbook();
  await workbook.xlsx.load(data);
  const sheets: { name: string; rows: unknown[][] }[] = [];
  workbook.eachSheet((sheet) => {
    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      if (rows.length > 50000)
        throw Error('Workbook has too many rows. Use a daily report.');
      const values = row.values;
      rows.push(Array.isArray(values) ? values.slice(1) : []);
    });
    sheets.push({ name: sheet.name, rows });
  });
  return parseAirportSheets(sheets, name, workbook.properties.date1904);
}
export function compareGates(
  report: Report,
  plan: AirportPlan,
  moves: Move[],
): GateCheck[] {
  const checks: GateCheck[] = [];
  for (const t of report.turns) {
    for (const direction of ['arrival', 'departure'] as const) {
      const flight = direction === 'arrival' ? t.arrFlight : t.depFlight;
      const time = direction === 'arrival' ? t.arrival : t.departure;
      if (!flight) continue;
      const date =
        time === null ? '' : new Date(time).toISOString().slice(0, 10);
      const key = flightKey(flight);
      const candidates = plan.assignments.filter(
        (a) =>
          a.key === key &&
          key &&
          a.direction === direction &&
          a.dates.includes(date),
      );
      const gates = [...new Set(candidates.map((a) => comparisonGate(a.gate)))];
      const csvGate = direction === 'arrival' ? t.from : t.to;
      const status: GateCheck['status'] =
        !date || !csvGate
          ? 'missing'
          : !candidates.length
            ? 'unmatched'
            : gates.length > 1
              ? 'ambiguous'
              : !gates[0]
                ? 'missing'
                : gates[0] === comparisonGate(csvGate)
                  ? 'match'
                  : 'mismatch';
      const active = moves.some(
        (m) =>
          m.included &&
          (m.turnId === t.id ||
            (m.fin === t.fin &&
              date === report.date &&
              flightKey(direction === 'arrival' ? m.arrFlight : m.depFlight) ===
                key)) &&
          (direction === 'arrival' ? !!m.arrFlight : !!m.depFlight),
      );
      const potential =
        ['gate', 'same-area', 'long', 'incomplete'].includes(t.kind) ||
        (t.kind === 'bse-in' && direction === 'arrival') ||
        (t.kind === 'bse-out' && direction === 'departure');
      checks.push({
        id: `${t.id}-${direction}`,
        turnId: t.id,
        fin: t.fin,
        flight,
        direction,
        date,
        csvGate,
        airportGate: gates.filter(Boolean).join(' / '),
        status,
        sources: candidates.map(
          (a) => `${a.sheet} · row ${a.row} · ${a.flight}`,
        ),
        tow: active || potential,
      });
    }
  }
  return checks;
}
