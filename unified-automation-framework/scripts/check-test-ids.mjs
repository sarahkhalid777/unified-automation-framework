// Fails if a test has no ID or one ID is declared in two places. Runs `playwright test --list`,
// so nothing is executed and the application doesn't need to be up. Mobile specs (WebdriverIO,
// not Playwright) are read as source: every it('...') title is checked.
// Data-driven tests share an ID on purpose; they come from one declaration (same file and line).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const SETUP_PROJECTS = new Set(['app-health', 'test-data']);
const TEST_ID = /^[A-Z]+(?:-[A-Z0-9]+)*-\d{3}\s/;
const MOBILE_DIR = 'tests/mobile';

const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const output = execFileSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const report = JSON.parse(output);

const titles = []; // { title, where }
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    const projects = new Set(spec.tests.map((t) => t.projectName));
    if (![...projects].every((p) => SETUP_PROJECTS.has(p))) titles.push({ title: spec.title, where: `${spec.file}:${spec.line}` });
  }
  for (const child of suite.suites ?? []) walk(child);
};
report.suites.forEach(walk);

for (const file of readdirSync(MOBILE_DIR).filter((f) => f.endsWith('.spec.ts'))) {
  readFileSync(`${MOBILE_DIR}/${file}`, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const match = /\bit\(\s*['"`]([^'"`]+)/.exec(line);
      if (match) titles.push({ title: match[1], where: `mobile/${file}:${index + 1}` });
    });
}

const problems = [];
const declarations = new Map();

for (const { title, where } of titles) {
  if (!TEST_ID.test(title)) {
    problems.push(`No test ID: "${title}" (${where})`);
    continue;
  }
  const id = title.split(/\s/)[0];
  declarations.set(id, (declarations.get(id) ?? new Set()).add(where));
}

for (const [id, places] of declarations) {
  if (places.size > 1) problems.push(`${id} is declared in ${places.size} places: ${[...places].join(', ')}`);
}

if (problems.length > 0) {
  console.error(`Test ID check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Test ID check passed: ${declarations.size} test IDs, ${titles.length} tests.`);
