# JazzTow

Daily aircraft tow planner for turn-view CSV exports. Every new page session starts empty, with no uploaded file, report date, tow moves or shutdown rows. The historical CSV is kept only as a test fixture and is not imported by the app. Uploads are parsed in the browser and are not sent to an application backend. Working edits are session-only; download the CSV or print the sheet to preserve results.

## Run

Requires Node 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

## Deployment

JazzTow is deployed on Netlify. The build publishes Vinext client assets from `dist/client`; requests that do not match a static asset are rendered by the generated Vinext server through the `vinext` Netlify Function. Keep `netlify.toml` and `netlify/functions/vinext.mjs` intact when changing the build or routing setup.

Netlify builds require Node 22. The production site must be published by a Netlify user or token with production-deploy permission; deploy previews can be used to verify changes before publishing.

### Access control

Every request, including static assets, is protected by the Netlify Edge Function in `netlify/edge-functions/password-wall.ts`. In Netlify’s environment-variable settings, create these variables with the **Functions** scope for production and deploy previews:

- `JAZZTOW_PASSWORD`: `Jazz123`
- `JAZZTOW_SESSION_SECRET`: a unique, high-entropy secret (for example, output from `openssl rand -base64 32`)

The site fails closed with an unavailable response until both variables are present. Sessions are signed, HTTP-only, secure cookies that expire after 12 hours.

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

## Same-area routing review

US gates are 56–58 and 73–89; domestic gates are 1–49. Active same-day changes between different gates in the same area require a routing decision in Review. Confirm a direct tow, or specify a holding stand to create arrival-to-holding and holding-to-departure legs. Neither a stand nor a direct route is assumed. Unknown gates are not assigned an area. Completed departures, overnight BSE rules and same-gate long-stay decisions retain their existing behavior. Both holding legs must be included together and connected; US 73 → S4B → US 75 is valid even though the flight gates differ.

## Overnight shutdown report

Upload a flight CSV, open Shutdown, select the night (defaults to the uploaded report date), and paste maintenance-required FINs. Regeneration replaces edits; exports pause while list/date changes are unapplied. One row per FIN is generated from a turn spanning the selected night, including post-midnight arrivals before 08:00. Listed FINs absent from the schedule remain visible with missing-data warnings. Unlisted overnight FINs stay HGR pending maintenance review.

Required FINs and all unlisted overnight aircraft default to HGR. Duplicate gate assignments prevent a reviewed report.

Grooming defaults to X when the schedule shows flight activity on the selected day, including an arrival during its overnight continuation. US/TB defaults are inferred from departure gate categories and explicitly require destination confirmation; unknown gates show ? until reviewed. The CSV may contain actual/estimated departure times rather than STD; those rows are flagged and editable. The report has maintenance/other sections and all eight screenshot columns, with CSV export and landscape printing. Shutdown reporting does not automatically rewrite the separate tow plan. Changes remain in memory across tab switching but not new sessions or reloads.

## Airport gate mismatch checking

After uploading a turn-view CSV, use Mismatch to upload the airport daily planning XLSX. ExcelJS loads on demand and reads the workbook in the browser. Matching uses flight identity, arrival/departure direction and scheduled or estimated airport dates. AC / ACA / QK / JZA are grouped for the supplied feeds; other airlines remain distinct. Separate TOW rows are matched independently.

Numeric gate prefixes and suffixes are ignored for comparison: 21, A21, 21A and 21B are equivalent, as are 2 and 2A. Named locations such as BSE and S4B are preserved. This comparison rule does not rewrite the original tow plan or its gate values.

Mismatch has a five-column shadcn table (FIN, flight/date, movement, turn-view gate, airport gate), with separate Mismatches and Unverified views and compact summary badges. There are no source columns, review notes or mark-checked controls. Gate checks do not appear in Review, contribute to its badge, or affect tow-sheet draft status. Missing records and ambiguous assignments are shown as unverified, never as confirmed mismatches. Imports remain session-only.

Workbook parsing uses the documented ExcelJS XLSX load and worksheet row APIs: https://github.com/exceljs/exceljs#reading-xlsx . The supplied XLSX is retained only as a test fixture, never preloaded into the UI.
