/**
 * Everything the reports say about a test is derived from what the test already declares:
 * the ID at the start of its title, the Playwright project it ran in and its tags. Nothing
 * has to be repeated in a separate annotation that could drift from the title.
 */

// AREA-NNN or AREA-SUBAREA-NNN, e.g. WEB-AUTH-001, API-CUSTOMER-004, INT-E2E-001.
const TEST_ID = /^([A-Z]+(?:-[A-Z0-9]+)*-\d{3})\s+(.+)$/s;

export interface TestTitle {
  id: string;
  description: string;
}

export function parseTestTitle(title: string): TestTitle | undefined {
  const match = TEST_ID.exec(title.trim());
  return match ? { id: match[1]!, description: match[2]! } : undefined;
}

const LAYERS: Record<string, string> = {
  WEB: 'Web UI',
  API: 'API',
  DB: 'Database',
  INT: 'Integration',
  FW: 'Framework',
  MOB: 'Mobile',
};

/** The test layer, taken from the ID prefix: "API-ORDER-001" -> "API". */
export function layerOf(id: string): string {
  const prefix = id.split('-')[0]!;
  return LAYERS[prefix] ?? prefix;
}

// Abbreviated area codes used in IDs; anything not listed is title-cased.
const AREAS: Record<string, string> = {
  AUTH: 'Authentication',
  PROD: 'Products',
  PRODUCT: 'Products',
  CUSTOMER: 'Customers',
  ORDER: 'Orders',
  CHK: 'Checkout',
  E2E: 'End-to-end journey',
  INFRA: 'Infrastructure',
  CONFIG: 'Configuration',
  LOG: 'Logging',
  VO: 'Value objects',
  API: 'API layer',
  DATA: 'Test data',
  REPORT: 'Reporting',
};

/** The functional area, taken from the middle of the ID: "API-ORDER-001" -> "Orders". */
export function featureOf(id: string): string {
  const area = id.split('-').slice(1, -1).join('-');
  if (!area) return 'General';
  return AREAS[area] ?? area.charAt(0) + area.slice(1).toLowerCase();
}

export type Severity = 'blocker' | 'critical' | 'normal' | 'minor' | 'trivial';

/** Smoke tests guard the main business paths, so a failure there is critical. */
export function severityOf(tags: readonly string[]): Severity {
  return tags.includes('@smoke') ? 'critical' : 'normal';
}

/**
 * The request ID prefix used for everything one test sends to the application. It starts
 * with the test ID so ShopLite's own log can be searched by test ID; the random part keeps
 * retries and other browsers apart. ShopLite accepts [\w.:-]{1,100}.
 */
export function traceIdFor(testId: string | undefined, random: string): string {
  return `${testId ?? 'qa'}.${random}`;
}
