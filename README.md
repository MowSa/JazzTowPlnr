# JazzTow

Daily aircraft tow planner for turn-view CSV exports. Includes the supplied YUL September 5, 2026 schedule as an explicitly labeled sample. Uploads are parsed in the browser and are not sent to an application backend. Working edits are session-only; download the CSV or print the sheet to preserve results.

## Run

Requires Node 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

## Confirmed operating rules

- Use the operating date and station from the CSV report footer. An upload-date override is available when the footer is absent.
- Ignore alphabetic terminal gate prefixes and numeric leading zeroes: C74 = 74, A2 = 02. Preserve holding-stand identifiers such as S4B and gate suffixes such as 12A.
- Same-day arrival and departure at different gates: one tow at the arrival TOA, rounded to the nearest five-minute pickup interval.
- Arrival on the operating date and next departure on a later date: tow from arrival gate to BSE at TOA.
- Arrival before the operating date and departure on the operating date: BSE to departure gate, pickup 60 minutes before TOD. Starting location is inferred and requires review.
- Same-gate stays strictly greater than 180 minutes are optional. User decides to stay or specifies a holding stand. A holding decision creates two moves, at TOA and TOD minus 60 minutes.
- Missing times, gates, or aircraft identification are review exceptions. Cancelled entries are skipped. Exact duplicate rows are counted and skipped.
- TOD means time of departure and TOA means time of arrival. Time suffixes are preserved: A is actual, E is estimated and S is scheduled. A flight with an actual departure in column L no longer requires a tow move.
- Local wall-clock times are represented internally using UTC arithmetic without timezone conversion. A/E/S indicators are preserved in source view. Calculations use the CSV time present, which can be actual, estimated, or scheduled.
- Gate-open times stay blank until manually entered. Gate-sheet import, gate occupancy conflict checks, taxi/tow duration, release time estimation, resources, and fleet availability are not implemented.
- Pickups on adjacent days are flagged and left blank; they are never silently assigned to the sheet date. Date resolution uses the nearest valid adjacent calendar month, with suspicious durations flagged.
- Each move is individually reviewed. Sheets stay labeled DRAFT when included moves, required long-stay decisions, incomplete rows or paired-tow issues remain unresolved. A draft is downloadable/printable for planning.

## Tow sheet

Columns follow the supplied tow sheet: arrival flight, FIN, tow from/to, scheduled pickup, aircraft release, gate opens, actual pickup/drop, departure flight/time and tower. Included moves are ordered by pickup time. Export is CSV with formula-injection escaping; print uses a landscape sheet and supports the browser's Save as PDF destination. No messages are sent to towers.

Users can add a tow move manually from the Tow moves toolbar. FIN, tow-from location, tow-to location and scheduled pickup are required; the remaining fields are optional.

## Validation

Node tests cover the supplied data (53 active turns, 6 cancellations, 3 gate changes, 6 BSE moves, 1 long stay and 43 no-tow turns after completed departures are excluded), quoted CSVs, bad input, missing data, day/month/year boundaries, timing validation, paired holding moves and CSV escaping. Type checking and production compilation are also performed. Browser interaction / visual QA was not requested and has not been performed.

Optional WebMCP tools `analyze_flight_csv` and `read_tow_plan` are feature-detected on document.modelContext and share the visible app state. A supported WebMCP validation context was not available; their browser registration and execution remain unverified.
