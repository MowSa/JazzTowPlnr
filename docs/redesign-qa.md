# Operations console redesign

## Pre-change audit

Checkpoint: `9a908d1` (clean working tree; explicit empty checkpoint).

- Route: `/`, implemented by `app/page.tsx`; tab navigation is session-local.
- `app/layout.tsx` supplies metadata and the stylesheet.
- `app/page.tsx` owns parsed report, moves, included/reviewed flags, routing decisions, uploaded airport plan, editor state, and optional WebMCP integration.
- `components/operations-console.tsx` supplies navigation, station clocks, theme preference, and aircraft drawer.
- `components/shutdown-planner.tsx` owns overnight inputs and generated editable rows. Its mounted lifetime preserves edits across tabs; schedule replacement resets it.
- `lib/tows.ts`: `parseCSV`/`analyze` parse schedules; `makeMoves`/`longMoves` calculate movements; `moveErrors`/`planIssues` validate individual and paired moves; `sheetValues`/`exportCSV` provide existing output.
- `lib/gates.ts`: `readAirportWorkbook`/`parseAirportSheets` import airport files; `compareGates` matches by flight, direction and date. Unmatched, ambiguous and missing records are not confirmed mismatches.
- `lib/shutdown.ts`: `buildShutdown` classifies overnight aircraft; `shutdownErrors`/`shutdownPlanErrors`/`shutdownDraft` validate; `shutdownCSV`/`shutdownValues` supply report content. Existing gate-request helpers remain authoritative.
- `lib/console.ts`: actual pickup/drop determine operational execution status; station clocks use known airport time zones.
- Uploads stay client-side. Fresh sessions start empty. Only theme is persisted.
- Netlify configuration, server function and password wall are outside redesign scope.

Preservation priorities: date boundaries and local-time arithmetic, paired holding legs, manual moves, independent gate comparison, reviewed/draft CSV output, print separation, and mounted overnight state.

## Baseline validation

- Bundled Node runtime used because shell Node 20 cannot run the repository's TypeScript tests.
- 44/44 existing engine tests pass.
- TypeScript passes.
- Production build passes; existing large-chunk advisory remains (ExcelJS is loaded on demand).
- Full lint has existing failures in shared UI components, React compiler checks, test promise annotations, and two mechanical library rules. These are tracked separately from newly authored code.

## Milestones

1. Pre-redesign checkpoint complete.
2. Design system and app shell: consolidated theme tokens, compact navigation, operating-day header, source drawer, temporary feedback, existing uploads and report actions retained. TypeScript and production build pass.
