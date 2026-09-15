// Run with Node 22.13+ and PLAYWRIGHT_MODULE set to an installed playwright package.
// Uses existing fixtures and explicitly synthetic QA schedules; no app data is preloaded.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sampleCSV } from '../tests/fixtures/sample.ts';
import { analyze, makeMoves, parseCSV } from '../lib/tows.ts';
import ExcelJS from 'exceljs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = fileURLToPath(new URL('../output/playwright/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1366, height: 900 },
  acceptDownloads: true,
});
page.setDefaultTimeout(10000);
const failures = [],
  results = [],
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, status: 'passed' });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.message });
    results.push({ name, status: 'failed', error: e.message });
    console.log('FAIL', name, e.message);
    await page.screenshot({
      path: out + 'failure-' + failures.length + '.png',
      fullPage: true,
    });
    throw e;
  }
};
const nav = async (name) => {
  await page.getByRole('button', { name, exact: true }).click();
};
const upload = async (text = sampleCSV, name = 'qa-turn-view.csv') => {
  await page
    .locator('input[type=file][accept*=csv]')
    .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });
  await page.locator('.metric-strip').waitFor();
};
const close = async () => {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
};
const snap = async (name) => {
  await page.screenshot({ path: out + name + '.png', fullPage: true });
};
const saveDownload = async (action, name) => {
  const event = page.waitForEvent('download');
  await action();
  const download = await event;
  await download.saveAs(out + name);
  return readFile(out + name, 'utf8');
};
const header =
  'Incoming,,,,,,,,Outgoing,,,,,\nOrigin,TOD,TOA,PAX,Flight,"Terminal\n/ Gate",Tail,"Turn Time\n(HH:MM)","Terminal\n/ Gate",Flight,PAX,TOD,TOA,Destination\n';
const fixture = (rows, date = '05Sep26') =>
  header +
  rows +
  '\n"Report Parameters (in Detail) :\nReport Period: ' +
  date +
  ' 00:00 - ' +
  date +
  ' 23:59 LT\nStation: YUL"';
const row = (
  fin,
  from = '02',
  to = '75',
  arrival = '0800/05 S',
  departure = '1000/05 S',
  flight = 1,
  duration = '02:00',
) =>
  `YTZ,0700/05 S,${arrival},,QK ${flight},${from},${fin},${duration},${to},QK ${flight + 1},,${departure},,YTZ`;
try {
  await check('No-source state and dark theme', async () => {
    await page.goto(process.env.QA_URL || 'http://localhost:3000');
    await page.getByRole('button', { name: 'Use light mode' }).waitFor();
    assert.equal(await page.locator('.session-empty').count(), 1);
    assert.equal(await page.locator('.metric-strip').count(), 0);
    await snap('01-empty-dark');
  });
  await check('Invalid CSV and empty schedule are human-readable', async () => {
    for (const csv of ['not,a,turn,view', header]) {
      await page
        .locator('input[type=file][accept*=csv]')
        .setInputFiles({
          name: 'invalid.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        });
      await page.locator('.message.error').first().waitFor();
      assert.equal(await page.locator('.metric-strip').count(), 0);
    }
  });
  await check(
    'Schedule upload, parsing, tow generation and default overview',
    async () => {
      await upload();
      assert.equal(
        await page.locator('.metric-strip strong').nth(0).innerText(),
        '53',
      );
      assert.equal(
        await page.locator('.metric-strip strong').nth(1).innerText(),
        String(makeMoves(analyze(sampleCSV)).length),
      );
      assert.equal(await page.locator('h1').innerText(), 'Operations Overview');
      await snap('02-overview-dark-1366');
    },
  );
  await check(
    'Timeline, table, sorting and included/excluded movement',
    async () => {
      await nav('Tow Plan');
      assert.equal(await page.locator('.timeline-leg').count(), 8);
      await snap('03-timeline-dark');
      await page.getByRole('tab', { name: 'Table', exact: true }).click();
      const checks = page.locator('.panel input[type=checkbox]');
      const checkbox = page
        .getByRole('checkbox', { name: /Include FIN/ })
        .first();
      await checkbox.click();
      assert.equal(await page.locator('tr.excluded').count(), 1);
      await checkbox.click();
      await page.locator('.sort-control select').selectOption('fin');
      await snap('04-table-dark');
      await nav('Overview');
      await nav('Tow Plan');
      assert.equal(
        await page
          .getByRole('tab', { name: 'Table', exact: true })
          .getAttribute('aria-selected'),
        'true',
      );
    },
  );
  await check(
    'Manual add, edit, validation and actual execution statuses',
    async () => {
      await page.getByRole('button', { name: 'Add tow', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('FIN # *', { exact: true }).fill('999');
      await dialog.getByLabel('Tow from *', { exact: true }).fill('S4B');
      await dialog.getByLabel('Tow to *', { exact: true }).fill('25');
      await dialog
        .getByLabel('Scheduled pickup *', { exact: true })
        .fill('12:30');
      await dialog
        .getByRole('button', { name: 'Add tow move', exact: true })
        .click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByLabel('Search tow moves').fill('999');
      assert.equal(await page.locator('.panel tbody tr').count(), 1);
      await page
        .getByRole('button', { name: 'Edit FIN 999 S4B to 25', exact: true })
        .click();
      await page.getByLabel('Actual pickup', { exact: true }).fill('12:35');
      await page.getByRole('button', { name: 'Save & mark reviewed' }).click();
      assert.match(
        await page.locator('.panel tbody').innerText(),
        /In progress/,
      );
      await page
        .getByRole('button', { name: 'Edit FIN 999 S4B to 25', exact: true })
        .click();
      await page.getByLabel('Actual drop', { exact: true }).fill('12:45');
      await page.getByRole('button', { name: 'Save & mark reviewed' }).click();
      assert.match(await page.locator('.panel tbody').innerText(), /Completed/);
      await page.getByLabel('Search tow moves').fill('');
    },
  );
  await check('Sequential long-stay and direct routing decisions', async () => {
    await nav('Review & Resolve');
    await page.getByRole('radio', { name: /Keep at gate/ }).check();
    await page.getByRole('button', { name: 'Confirm decision' }).click();
    await page.getByRole('radio', { name: /Direct tow/ }).check();
    await page.getByRole('button', { name: 'Confirm decision' }).click();
    assert.equal(await page.locator('.focused-decision').count(), 0);
    await page.locator('.resolved-decisions summary').click();
    assert.match(
      await page.locator('.resolved-decisions').innerText(),
      /Direct tow/,
    );
  });
  await check(
    'Revisit routing, holding validation, and paired moves',
    async () => {
      const resolved = page
        .locator('.resolved-row')
        .filter({ hasText: 'FIN 524' });
      await resolved.getByRole('button', { name: 'Revisit' }).click();
      await page.getByRole('radio', { name: /Via holding stand/ }).check();
      await page.getByRole('textbox', { name: /Holding stand/ }).fill('73');
      await page.getByRole('button', { name: 'Confirm decision' }).click();
      await page
        .getByText('Choose a holding stand different from both flight gates.')
        .waitFor();
      await page.getByRole('textbox', { name: /Holding stand/ }).fill('S4B');
      await page.getByRole('button', { name: 'Confirm decision' }).click();
      await nav('Tow Plan');
      await page.getByLabel('Search tow moves').fill('524');
      assert.equal(await page.locator('.panel tbody tr').count(), 2);
      assert.match(await page.locator('.panel tbody').innerText(), /16:10/);
      assert.match(await page.locator('.panel tbody').innerText(), /19:00/);
      await page
        .getByRole('checkbox', { name: /Include FIN 524/ })
        .first()
        .click();
      await page
        .getByText(/include both the holding tow and return tow/)
        .first()
        .waitFor();
      await page
        .getByRole('checkbox', { name: /Include FIN 524/ })
        .first()
        .click();
      await page.getByLabel('Search tow moves').fill('');
    },
  );
  await check('Movement review reaches ready state', async () => {
    await nav('Review & Resolve');
    while (
      await page
        .getByRole('button', { name: 'Review move', exact: true })
        .count()
    )
      await page
        .getByRole('button', { name: 'Review move', exact: true })
        .first()
        .click();
    await page.getByRole('heading', { name: 'Tow review complete' }).waitFor();
    assert.match(await page.locator('.plan-status').innerText(), /READY/);
    await snap('05-review-ready');
  });
  await check(
    'Global search, gate prefix search, drawer and session note',
    async () => {
      await page
        .getByRole('button', {
          name: 'Search FIN, flight or gate',
          exact: true,
        })
        .click();
      await page.getByLabel('Search aircraft', { exact: true }).fill('FIN 524');
      await page.locator('.aircraft-search-result').click();
      await page
        .getByRole('dialog')
        .getByText('FIN 524', { exact: true })
        .waitFor();
      assert.equal(await page.locator('.rotation-tow').count(), 2);
      await page
        .getByLabel('Note for FIN 524')
        .fill('QA note: confirm stand availability.');
      await snap('06-aircraft-drawer');
      await close();
      await page
        .getByRole('button', {
          name: 'Search FIN, flight or gate',
          exact: true,
        })
        .click();
      await page.getByLabel('Search aircraft', { exact: true }).fill('G75');
      assert.ok((await page.locator('.aircraft-search-result').count()) > 0);
      await page.keyboard.press('Escape');
    },
  );
  await check(
    'Tow CSV and printable report preserve reviewed output',
    async () => {
      await nav('Reports / Outputs');
      const csv = await saveDownload(
        () =>
          page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
        'tow-sheet.csv',
      );
      const parsed = parseCSV(csv);
      assert.equal(parsed[0][3], 'REVIEWED');
      assert.equal(parsed[1].length, 12);
      assert.ok(parsed.some((r) => r.includes('999')));
      assert.ok(!csv.includes('QA note'));
      await page.evaluate(() => {
        window.print = () => window.dispatchEvent(new Event('beforeprint'));
      });
      await page
        .getByRole('button', { name: 'Print sheet', exact: true })
        .click();
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.console-nav').isVisible(), false);
      assert.equal(await page.locator('.sheet-tab').isVisible(), true);
      assert.equal(await page.locator('.shutdown-tab').isVisible(), false);
      assert.match(await page.locator('.paper').innerText(), /QA note/);
      await page.pdf({
        path: out + 'tow-sheet.pdf',
        format: 'A4',
        landscape: true,
        printBackground: true,
      });
      await page.emulateMedia({ media: 'screen' });
    },
  );
  await check(
    'Airport workbook matching, mismatches and unverified tabs',
    async () => {
      await nav('Gate Verification');
      await page
        .locator('input[type=file][accept=".xlsx"]')
        .setInputFiles(
          fileURLToPath(
            new URL('../tests/fixtures/airport-planning.xlsx', import.meta.url),
          ),
        );
      await page
        .getByRole('tab', { name: 'Mismatches 13', exact: true })
        .waitFor();
      await page.getByRole('tab', { name: 'Matched 81', exact: true }).click();
      assert.equal(
        await page.locator('.gate-comparison-table:visible tbody tr').count(),
        81,
      );
      await page
        .getByRole('tab', { name: 'Unverified 12', exact: true })
        .click();
      assert.equal(
        await page.locator('.gate-comparison-table:visible tbody tr').count(),
        12,
      );
      await page
        .getByRole('tab', { name: 'Mismatches 13', exact: true })
        .click();
      await snap('07-gates-dark');
    },
  );
  await check(
    'Invalid airport workbook preserves current comparison',
    async () => {
      await page
        .locator('input[type=file][accept=".xlsx"]')
        .setInputFiles({
          name: 'invalid.xlsx',
          mimeType: 'application/octet-stream',
          buffer: Buffer.from('invalid'),
        });
      await page.getByText('We couldn’t read the airport workbook.').waitFor();
      assert.equal(
        await page
          .getByRole('tab', { name: 'Mismatches 13', exact: true })
          .count(),
        1,
      );
    },
  );
  await check(
    'Different source dates produce warning and no false conflicts',
    async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('QA different day');
      sheet.addRow(['2026-09-12 Montréal-Trudeau']);
      sheet.addRow([
        'Arr Flight',
        'Arr Time',
        'Dep Flight',
        'Dep Time',
        'Gate',
      ]);
      sheet.addRow([
        'ACA8672',
        '2026-09-12T18:22:00',
        'ACA8851',
        '2026-09-12T19:30:00',
        '88',
      ]);
      await page
        .locator('input[type=file][accept=".xlsx"]')
        .setInputFiles({
          name: 'qa-different-day.xlsx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
        });
      await page
        .getByRole('heading', { name: 'Airport plan cannot be fully compared' })
        .waitFor();
      assert.equal(
        await page
          .getByRole('tab', { name: 'Mismatches 0', exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page.locator('.console-nav .count-conflict').count(),
        0,
      );
      await snap('08-date-mismatch');
    },
  );
  await check(
    'Overnight classification, manual FINs and generation',
    async () => {
      await nav('Overnight Plan');
      assert.equal(await page.locator('.overnight-aircraft').count(), 6);
      await page
        .getByLabel('Classification for FIN 427')
        .selectOption('required');
      await page
        .getByLabel('Classification for FIN 530')
        .selectOption('allowed');
      await page.locator('.bulk-fin-input summary').click();
      await page
        .getByLabel('Required at BSE / HGR', { exact: true })
        .fill('427 998');
      await page
        .getByRole('button', { name: 'Generate overnight report' })
        .click();
      assert.equal(await page.locator('.overnight-aircraft').count(), 7);
      await page
        .getByRole('button', { name: 'Review overnight FIN 427', exact: true })
        .click();
      await page
        .getByLabel('Comments', { exact: true })
        .fill('QA overnight note');
      await page.getByRole('button', { name: 'Save & mark reviewed' }).click();
      await nav('Overview');
      await nav('Overnight Plan');
      assert.match(
        await page
          .locator('.overnight-aircraft')
          .filter({ hasText: 'FIN 427' })
          .innerText(),
        /Reviewed/,
      );
      await snap('09-overnight-generated');
    },
  );
  await check('Overnight dirty-state and regeneration protection', async () => {
    await page
      .getByLabel('Required at BSE / HGR', { exact: true })
      .fill('427 998 997');
    assert.equal(
      await page
        .getByRole('button', { name: 'Export report', exact: true })
        .isDisabled(),
      true,
    );
    await page
      .getByRole('button', { name: 'Regenerate report', exact: true })
      .click();
    await page.getByRole('button', { name: 'Keep current report' }).click();
    assert.equal(await page.locator('.overnight-aircraft').count(), 7);
    await page
      .getByLabel('Required at BSE / HGR', { exact: true })
      .fill('427 998');
    assert.equal(
      await page
        .getByRole('button', { name: 'Export report', exact: true })
        .isDisabled(),
      false,
    );
  });
  await check('Overnight CSV, preview and print separation', async () => {
    const csv = await saveDownload(
      () =>
        page
          .getByRole('button', { name: 'Export report', exact: true })
          .click(),
      'shutdown.csv',
    );
    assert.match(csv, /QA overnight note/);
    assert.match(csv, /REQUIRED BY MAINTENANCE/);
    assert.match(csv, /DRAFT/);
    await page
      .getByRole('button', { name: 'Preview report', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Print report', exact: true })
      .click();
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.shutdown-paper').isVisible(), true);
    assert.equal(await page.locator('.sheet-tab').isVisible(), false);
    await page.pdf({
      path: out + 'shutdown.pdf',
      format: 'A4',
      landscape: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: 'screen' });
  });
  await check('Light theme and 1920px desktop layout', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole('button', { name: 'Use light mode' }).click();
    await nav('Overview');
    assert.equal(await page.locator('html').getAttribute('class'), '');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await snap('10-overview-light-1920');
    await nav('Tow Plan');
    await snap('11-table-light-1920');
  });
  await check(
    'Keyboard shortcut, focus containment and editor shortcut protection',
    async () => {
      await page.locator('h1').click();
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog').waitFor();
      await page.getByLabel('Search aircraft', { exact: true }).fill('999');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.getByLabel('Note for FIN 999').waitFor();
      await page.getByLabel('Note for FIN 999').focus();
      await page.keyboard.press('Control+k');
      assert.equal(await page.locator('.aircraft-search-dialog').count(), 0);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    },
  );
  await check('1366px layout and 200% text remain navigable', async () => {
    await page.setViewportSize({ width: 1366, height: 768 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.evaluate(
      () => (document.documentElement.style.fontSize = '200%'),
    );
    await page
      .getByRole('button', { name: 'Source files', exact: false })
      .click();
    await page
      .getByRole('heading', { name: 'Source files', exact: true })
      .waitFor();
    await close();
    await page.evaluate(() => (document.documentElement.style.fontSize = ''));
    await snap('12-table-light-1366');
  });
  await check(
    'Refresh clears source data, preserves theme preference',
    async () => {
      await page.reload();
      await page
        .getByRole('button', { name: 'Upload flight schedule', exact: true })
        .waitFor();
      assert.equal(await page.locator('.metric-strip').count(), 0);
      await page.getByRole('button', { name: 'Use dark mode' }).waitFor();
    },
  );
  await check('No-tow schedule and empty overnight state', async () => {
    await upload(fixture(row('431', '02', '02')));
    assert.equal(
      await page.locator('.metric-strip strong').nth(1).innerText(),
      '0',
    );
    await nav('Tow Plan');
    assert.match(
      await page.locator('.timeline-wrapper').innerText(),
      /No aircraft/,
    );
    await nav('Overnight Plan');
    assert.equal(await page.locator('.overnight-aircraft').count(), 0);
  });
  await check('Incomplete turn workflow', async () => {
    await upload(fixture(row('431', '', '75')));
    await nav('Review & Resolve');
    await page
      .getByRole('button', { name: 'Confirm no tow / exclude' })
      .click();
    await page.getByRole('heading', { name: 'Tow review complete' }).waitFor();
  });
  await check('Large schedule: 1000 turns and filtering', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      row(String(1000 + i), '02', '75', '0800/05 S', '1000/05 S', i * 2 + 1),
    ).join('\n');
    await upload(fixture(rows), 'qa-large-1000.csv');
    assert.equal(
      await page.locator('.metric-strip strong').nth(0).innerText(),
      '1000',
    );
    await nav('Tow Plan');
    await page.getByRole('tab', { name: 'Table', exact: true }).click();
    await page.getByLabel('Search tow moves').fill('1999');
    assert.ok((await page.locator('.panel tbody tr').count()) <= 3);
  });
  await check('No browser runtime errors', async () => {
    assert.deepEqual(errors, []);
  });
} catch (e) {
  console.error('QA stopped:', e.message);
} finally {
  await writeFile(
    out + 'qa-results.json',
    JSON.stringify({ results, failures, errors }, null, 2),
  );
  await browser.close();
}
if (failures.length) process.exitCode = 1;
