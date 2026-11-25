// Prints a Markdown summary of the latest Playwright run (reports/runs/*/summary.json) for the
// GitHub job page: totals, then one row per failed or flaky test with its trace ID, so the
// matching application log lines can be found without opening the artifacts.
//
//   node scripts/ci-summary.mjs "Web: firefox" >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const title = process.argv[2] ?? 'Test results';
const runsDir = path.resolve('reports/runs');
const latest = existsSync(runsDir) ? readdirSync(runsDir).sort().at(-1) : undefined;

if (latest === undefined) {
  console.log(`### ${title}\n\nNo run summary was written: the tests did not start. See the job log.\n`);
  process.exit(0);
}

const summary = JSON.parse(readFileSync(path.join(runsDir, latest, 'summary.json'), 'utf8'));
const { totals } = summary;
const cell = (value) => String(value ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 160);
const icon = totals.failed > 0 ? '❌' : totals.flaky > 0 ? '⚠️' : '✅';

const lines = [
  `### ${icon} ${title}`,
  '',
  '| Tests run | Passed | Failed | Flaky | Skipped | Did not run | Duration |',
  '|---:|---:|---:|---:|---:|---:|---:|',
  `| ${totals.tests} | ${totals.passed} | ${totals.failed} | ${totals.flaky} | ${totals.skipped} | ${totals.notRun ?? 0} | ${Math.round(summary.durationMs / 1000)} s |`,
  '',
];
if (totals.notRun > 0) lines.push(`${totals.notRun} tests did not run because something they depend on failed (see the failures below).`, '');

const problems = summary.tests.filter((t) => t.outcome === 'unexpected' || t.outcome === 'flaky');
if (problems.length > 0) {
  lines.push('| Test | Project | Outcome | Trace ID | First error |', '|---|---|---|---|---|');
  for (const t of problems) {
    const outcome = t.outcome === 'flaky' ? `flaky (${t.attempts} attempts)` : 'failed';
    lines.push(`| ${cell(t.id ?? t.title)} | ${cell(t.project)} | ${outcome} | ${t.traceId ? `\`${cell(t.traceId)}\`` : '–'} | ${cell(t.error?.split('\n')[0])} |`);
  }
  lines.push('', 'Evidence for these tests is in the job\'s `evidence-*` artifact under `reports/runs/`.', '');
}

console.log(lines.join('\n'));
