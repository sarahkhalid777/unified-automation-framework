import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { redactText } from '../logging/redact';
import { parseTestTitle } from './test-metadata';

export interface RunSummaryOptions {
  /** Where each run gets its own folder. */
  runsDir: string;
  /** How many run folders to keep; older ones are removed. */
  keep: number;
  /** Raw results folders that belong to a single run and must start empty (Allure appends otherwise). */
  resetDirs?: string[];
}

interface TestRecord {
  id: string | undefined;
  title: string;
  project: string;
  location: string;
  outcome: ReturnType<TestCase['outcome']>;
  status: TestResult['status'];
  attempts: number;
  durationMs: number;
  traceId: string | undefined;
  error: string | undefined;
  evidence: string[];
}

/**
 * Writes reports/runs/<timestamp>/summary.json after every run and copies the evidence of
 * failed and flaky tests next to it. Playwright clears its output folder at the start of the
 * next run, so without this a failure that doesn't reproduce leaves nothing behind.
 */
export default class RunSummaryReporter implements Reporter {
  private readonly options: RunSummaryOptions;
  private readonly startedAt = new Date();
  private readonly results = new Map<TestCase, TestResult[]>();
  private rootDir = process.cwd();
  private planned = 0;

  constructor(options: Partial<RunSummaryOptions> = {}) {
    this.options = { runsDir: 'reports/runs', keep: 20, ...options };
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.rootDir = config.configFile ? path.dirname(config.configFile) : process.cwd();
    this.planned = suite.allTests().length;
    for (const dir of this.options.resetDirs ?? []) rmSync(this.resolve(dir), { recursive: true, force: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.set(test, [...(this.results.get(test) ?? []), result]);
  }

  onEnd(result: FullResult): void {
    // `--list`, or a filter that matched nothing: not a run, and it would push real runs out of the kept history.
    if (this.results.size === 0) return;

    const runId = this.startedAt.toISOString().replace(/[:.]/g, '-');
    const runDir = path.join(this.resolve(this.options.runsDir), runId);
    mkdirSync(runDir, { recursive: true });

    const tests = [...this.results].map(([test, attempts]) => this.record(test, attempts, runDir));
    const count = (outcome: TestRecord['outcome']) => tests.filter((t) => t.outcome === outcome).length;
    const summary = {
      runId,
      startedAt: this.startedAt.toISOString(),
      durationMs: Math.round(result.duration),
      status: result.status,
      totals: {
        tests: tests.length,
        passed: count('expected'),
        failed: count('unexpected'),
        flaky: count('flaky'),
        skipped: count('skipped'),
        // Tests that never started, usually because a setup project they depend on failed.
        notRun: Math.max(0, this.planned - tests.length),
      },
      problems: tests.filter((t) => t.outcome === 'unexpected' || t.outcome === 'flaky').map((t) => `${t.id ?? t.title} [${t.project}] ${t.outcome}`),
      tests,
    };
    writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    this.prune();

    const relative = path.relative(process.cwd(), path.join(runDir, 'summary.json'));
    const problems = summary.problems.length > 0 ? ` - ${summary.problems.length} to look at` : '';
    console.log(`\nRun summary: ${relative}${problems}`);
  }

  private record(test: TestCase, attempts: TestResult[], runDir: string): TestRecord {
    const last = attempts[attempts.length - 1]!;
    const outcome = test.outcome();
    const id = parseTestTitle(test.title)?.id;
    const firstError = attempts.flatMap((a) => a.errors)[0]?.message;

    return {
      id,
      title: test.title,
      project: test.parent.project()?.name ?? '',
      location: `${path.relative(this.rootDir, test.location.file).replaceAll('\\', '/')}:${test.location.line}`,
      outcome,
      status: last.status,
      attempts: attempts.length,
      durationMs: attempts.reduce((sum, a) => sum + a.duration, 0),
      // Annotations added while the test runs are on the result, not the test case.
      traceId: [...last.annotations, ...test.annotations].find((a) => a.type === 'trace-id')?.description,
      error: firstError === undefined ? undefined : redactText(firstError).split('\n').slice(0, 3).join('\n'),
      evidence: outcome === 'unexpected' || outcome === 'flaky' ? this.keepEvidence(test, attempts, runDir, id) : [],
    };
  }

  // Copies screenshots, videos, traces and JSON attachments of every attempt that didn't pass.
  private keepEvidence(test: TestCase, attempts: TestResult[], runDir: string, id: string | undefined): string[] {
    const project = test.parent.project()?.name ?? 'project';
    const folder = `${id ?? slug(test.title)}-${project}`;
    const kept: string[] = [];

    for (const attempt of attempts.filter((a) => a.status !== 'passed' && a.status !== 'skipped')) {
      const target = path.join(runDir, 'evidence', folder, `attempt-${attempt.retry + 1}`);
      for (const [index, attachment] of attempt.attachments.entries()) {
        // allure-js-commons passes its labels to the reporter as hidden attachments; not evidence.
        if (attachment.contentType.startsWith('application/vnd.allure')) continue;
        const name = `${index}-${path.basename(attachment.path ?? attachment.name)}`;
        if (attachment.path && existsSync(attachment.path)) {
          mkdirSync(target, { recursive: true });
          copyFileSync(attachment.path, path.join(target, name));
        } else if (attachment.body) {
          mkdirSync(target, { recursive: true });
          writeFileSync(path.join(target, name), attachment.body);
        } else {
          continue;
        }
        kept.push(path.relative(runDir, path.join(target, name)).replaceAll('\\', '/'));
      }
    }
    return kept;
  }

  private prune(): void {
    const runsDir = this.resolve(this.options.runsDir);
    // Folder names are ISO timestamps, so they sort chronologically.
    const runs = readdirSync(runsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const old of runs.slice(0, Math.max(0, runs.length - this.options.keep))) {
      rmSync(path.join(runsDir, old), { recursive: true, force: true });
    }
  }

  private resolve(dir: string): string {
    return path.resolve(this.rootDir, dir);
  }
}

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
