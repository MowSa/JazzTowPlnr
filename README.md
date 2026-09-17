# JazzTow

Daily aircraft tow planner for turn-view CSV exports. A new tab starts empty. Refresh keeps the working plan in this browser tab; use Clear desk in Source files to start over. The historical CSV is kept only as a test fixture and is not imported by the app. Uploads are parsed in the browser and are not sent to an application backend. Working edits stay in the tab session; download the CSV or print the sheet to preserve results outside the browser.

## Run

Requires Node 22.13+ (Node 24 recommended). Vinext uses `fs.promises.glob`, which Node 20 does not export. With nvm:

```sh
nvm install 24
nvm use
npm install
npm run dev
npm run check # lint, typecheck (without incremental output), domain tests
npm run build
npx playwright install chromium # once after npm ci / Playwright upgrades
npm run test:ui # starts and stops its own demo-mode dev server
npm run test:ui:smoke # quick empty-state, invalid-upload, and schedule-upload checks
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
- Gate-open times stay blank until an airport planning workbook is imported. That import fills occupancy-based pickup and TIME GATE OPENS AT for unreviewed departure tows. Same-gate overlap warnings are computed from the full operating day, then filtered for display. Occupant times that cannot meet the planned departure are warned and left for review rather than silently clamped. Taxi/tow duration, release time estimation, resources, and fleet availability are not implemented.
- Pickups on adjacent days are flagged and left blank; they are never silently assigned to the sheet date. Date resolution uses the nearest valid adjacent calendar month, with suspicious durations flagged.
- Each move is individually reviewed. Sheets stay labeled DRAFT when included moves, required long-stay decisions, incomplete rows or paired-tow issues remain unresolved. A draft is downloadable/printable for planning.

## Tow sheet

Columns follow the supplied tow sheet: arrival flight, FIN, tow from/to, scheduled pickup, aircraft release, gate opens, actual pickup/drop, departure flight/time and tower. Included moves are ordered by pickup time. Export is CSV with formula-injection escaping; print uses a landscape sheet and supports the browser's Save as PDF destination. No messages are sent to towers.

Users can add a tow move manually from the Tow moves toolbar. FIN, tow-from location, tow-to location and scheduled pickup are required; the remaining fields are optional.

## Validation

Node tests cover the supplied data (53 active turns, 6 cancellations, 3 gate changes, 6 BSE moves, 1 long stay and 43 no-tow turns after completed departures are excluded), quoted CSVs, bad input, missing data, day/month/year boundaries, timing validation, paired holding moves, occupancy pickup feasibility, and CSV escaping. `npm run check` runs lint, typecheck, and domain tests. `npm run test:ui:smoke` covers empty-state, invalid-upload, and schedule-upload browser checks; `npm run test:ui` is the fuller Playwright pass. GitHub Actions runs lint, typecheck, domain tests, production build, and the browser smoke job.

Optional WebMCP tools `analyze_flight_csv` and `read_tow_plan` are feature-detected on document.modelContext and share the visible app state. A supported WebMCP validation context was not available; their browser registration and execution remain unverified.

## Same-area routing review

US gates are 56–58 and 73–89; domestic gates are 1–49. Active same-day changes between different gates in the same area require a routing decision in Review. Confirm a direct tow, or specify a holding stand to create arrival-to-holding and holding-to-departure legs. Neither a stand nor a direct route is assumed. Unknown gates are not assigned an area. Completed departures, overnight BSE rules and same-gate long-stay decisions retain their existing behavior. Both holding legs must be included together and connected; US 73 → S4B → US 75 is valid even though the flight gates differ.

## Overnight shutdown report

Upload a flight CSV, open Shutdown, select the night (defaults to the uploaded report date), and paste maintenance-required FINs. Regeneration replaces edits; exports pause while list/date changes are unapplied. One row per FIN is generated from a turn spanning the selected night, including post-midnight arrivals before 08:00. Listed FINs absent from the schedule remain visible with missing-data warnings. Unlisted overnight FINs stay HGR pending maintenance review.

Required FINs and all unlisted overnight aircraft default to HGR. Duplicate gate assignments prevent a reviewed report.

Grooming defaults to X when the schedule shows flight activity on the selected day, including an arrival during its overnight continuation. US/TB defaults are inferred from departure gate categories and explicitly require destination confirmation; unknown gates show ? until reviewed. The CSV may contain actual/estimated departure times rather than STD; those rows are flagged and editable. The report has maintenance/other sections and all eight screenshot columns, with CSV export and landscape printing. Shutdown reporting does not automatically rewrite the separate tow plan. Changes remain in this browser tab across refresh until Clear desk.

## Airport gate mismatch checking

After uploading a turn-view CSV, use Mismatch to upload the airport daily planning XLSX. ExcelJS loads on demand and reads the workbook in the browser. Matching uses flight identity, arrival/departure direction and scheduled or estimated airport dates. AC / ACA / QK / JZA are grouped for the supplied feeds; other airlines remain distinct. Separate TOW rows are matched independently.

Numeric gate prefixes and suffixes are ignored for comparison: 21, A21, 21A and 21B are equivalent, as are 2 and 2A. Named locations such as BSE and S4B are preserved. This comparison rule does not rewrite the original tow plan or its gate values.

Mismatch has a five-column shadcn table (FIN, flight/date, movement, turn-view gate, airport gate), with separate Mismatches and Unverified views and compact summary badges. There are no source columns, review notes or mark-checked controls. Gate checks do not appear in Review, contribute to its badge, or affect tow-sheet draft status. Missing records and ambiguous assignments are shown as unverified, never as confirmed mismatches. Imports remain session-only.

Workbook parsing uses the documented ExcelJS XLSX load and worksheet row APIs: https://github.com/exceljs/exceljs#reading-xlsx . The supplied XLSX is retained only as a test fixture, never preloaded into the UI.

## Gate occupancy timeline

After the airport workbook is loaded, Gate Timeline plots known occupancies for the operating day. Overlaps are calculated from every occupancy on a stand, so hiding an airline does not clear a remaining aircraft's warning. The now-line uses the station timezone at minute resolution, including on the Tow Plan timeline. Occupancy-based pickups that cannot occur before planned departure stay visible as review warnings.

## Jazz YUL Operations

`/yul` is a separate operations map: a dark AOC-style dashboard with a Cesium 3D globe of Jazz Aviation flights arriving at or departing Montréal–Trudeau (YUL/CYUL). It is a visualization, not dispatch or ATC.

Open [http://localhost:3000/yul](http://localhost:3000/yul) after `npm run dev`, or use **YUL live map** in the JazzTow sidebar.

### Setup

```sh
cp .env.example .env.local
```

`.env.local` fields:

| Variable | Where it is used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | Client badge + server feed | `true` serves mock Jazz/YUL traffic and never calls FR24 |
| `FR24_API_KEY` | Server only (`/api/flights/live`) | Official FR24 token. Never `NEXT_PUBLIC_` |
| `CESIUM_ION_TOKEN` | Server (`/api/cesium/token`) then Cesium in the browser | Optional. Dark Carto tiles work without it |
| `FR24_REFRESH_INTERVAL` | Server cache + client poll (ms) | Floor is 15 000 ms (Explorer is 10 req/min) |
| `FR24_STALE_MS` | Feed and source-position freshness limit (ms) | Stale aircraft stay visible but freeze; stale arrival notices are suppressed |

Demo mode is also used when `FR24_API_KEY` is empty. For live FR24 data set `NEXT_PUBLIC_DEMO_MODE=false` and a production API token.

The FR24 key is read only in the Next/Vinext route handler. The browser calls `/api/flights/live` and receives the normalized `LiveAircraft[]` model.

### Flightradar24 (official API, inspected 2026-09-15)

Source: [FR24 API docs](https://fr24api.flightradar24.com/docs/endpoints/overview), [Getting started](https://fr24api.flightradar24.com/docs/getting-started), [Credit overview](https://fr24api.flightradar24.com/docs/credit-overview), [Authentication](https://fr24api.flightradar24.com/docs/authentication), [Sandbox](https://fr24api.flightradar24.com/docs/sandbox-environment).

1. **Live endpoint.** `GET https://fr24api.flightradar24.com/api/live/flight-positions/full` with `Authorization: Bearer <token>` and `Accept-Version: v1`. The **full** resource is required because origin, destination, aircraft type, registration, `operating_as`, and ETA are not on the light positions endpoint.
2. **Explorer plan.** Explorer is the hobby/testing tier: **$9/month, 30 000 credits, 10 queries/minute, 30 days of history**. Live flight positions (full and light) are billed endpoints on that plan. Sandbox keys return static sample JSON, ignore filters, and do not consume credits — they cannot drive a YUL Jazz board.
3. **Jazz identifier.** Jazz Aviation is **ICAO `JZA`**, IATA `QK`, radio callsign prefix `JZA`. FR24 `operating_as` is the operating-carrier ICAO (the field to filter on). `painted_as` is often `ACA` because the metal flies as Air Canada Express. Marketed flight numbers are often `AC####`. This app **never** treats an `AC` flight number as Jazz. Server filter: `operating_as=JZA`. Local fallback only if `operating_as` is missing: callsign starts with `JZA`.
4. **YUL inbound/outbound on FR24.** The `airports` query supports `inbound:`, `outbound:`, and `both:` plus IATA/ICAO. This app requests `airports=both:YUL` together with `operating_as=JZA` and `categories=P`.
5. **Local filter still required.** FR24 AND-combines query params, but we still drop anything that is not Jazz **and** (origin YUL/CYUL or destination YUL/CYUL), and we assign `INBOUND` / `OUTBOUND` from those airports. Distance to YUL is computed locally (haversine). Globe motion between polls is interpolated locally and labelled as such.
6. **Credits.** Live flight positions **full** costs **8 credits per returned flight**. An empty result costs **1 credit**. A typical Jazz/YUL airborne set of 8 aircraft is **64 credits per poll**.
7. **Polling on Explorer.** Rate limit allows a poll every 6 seconds; **credits do not**. Continuous 24/7 polling:

   | Interval | ~8 aircraft (64 cr/poll) | Fits 30 000 Explorer credits/month? |
   | --- | --- | --- |
   | 60 s | ~2.8M credits | No |
   | 2 min (default) | ~1.4M credits | No — for interactive sessions, not a wall display |
   | ~90 min | ~30k credits | Yes, if the board stays up all month |
   | 15 min | ~184k credits | No |

   Default `FR24_REFRESH_INTERVAL=120000` (2 minutes) with server-side caching so extra browser tabs do not multiply FR24 calls. Interpolation keeps the globe moving between snapshots. For a month-long Explorer deployment raise the interval substantially or use Essential/Advanced. One failed FR24 call does not clear the board; the last good snapshot is kept.

This map is not an official Jazz, Air Canada, or NAV CANADA system. Interpolated positions and locally calculated distances must not be treated as surveillance truth.

