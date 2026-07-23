import type {
  DriverRow,
  DriverStatus,
  DriversDataResult,
  DriversSummary,
  DriverTenureBucket,
  DriverMonthMovement,
} from '../types/drivers';

const SHEET_ID = process.env.DRIVERS_SHEET_ID ?? '1v3tMPvGFJ4NqIFqCF0INtNuJLYEzZkdQ0ZBqcxDno7M';
const SHEET_GID = 0;

const TENURE_BUCKETS: Omit<DriverTenureBucket, 'count'>[] = [
  { label: '1–4 wks',   minWeeks: 0,  maxWeeks: 4,  color: 'rgba(99,102,241,0.55)' },
  { label: '5–8 wks',   minWeeks: 5,  maxWeeks: 8,  color: 'rgba(99,102,241,0.7)'  },
  { label: '9–16 wks',  minWeeks: 9,  maxWeeks: 16, color: 'rgba(99,102,241,0.85)' },
  { label: '17–24 wks', minWeeks: 17, maxWeeks: 24, color: 'rgba(67,56,202,0.9)'   },
  { label: '25+ wks',   minWeeks: 25, maxWeeks: null, color: 'rgba(49,46,129,0.95)' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let inQuote = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuote = !inQuote;
      else if (ch === ',' && !inQuote) { cells.push(cell.trim()); cell = ''; }
      else cell += ch;
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim().slice(0, 200).toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('sign in');
}

/** Parse dates like 1/15/2026, 15/01/2026, 2026-01-15, Jan 15 2026, 15-Jan-2026 */
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'active') return null;

  // Excel serial date
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 40000 && n < 60000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
      return utc.toISOString().slice(0, 10);
    }
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const slash = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    let y = Number(slash[3]);
    if (y < 100) y += 2000;
    // Prefer MDY when first part > 12 is impossible → DMY; otherwise assume MDY (US sheets)
    let month: number;
    let day: number;
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { month = a; day = b; }
    else { month = a; day = b; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const named = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (named) {
    const mi = MONTH_NAMES.findIndex(m => named[1].toLowerCase().startsWith(m.toLowerCase()));
    if (mi >= 0) {
      let y = Number(named[3]);
      if (y < 100) y += 2000;
      return `${y}-${String(mi + 1).padStart(2, '0')}-${named[2].padStart(2, '0')}`;
    }
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function weeksBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso + 'T00:00:00Z').getTime();
  const b = new Date(endIso + 'T00:00:00Z').getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.max(0, Math.round((b - a) / (7 * 86400000)));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function findCol(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().replace(/\s+/g, ' ').trim();
    if (patterns.some(p => p.test(h))) return i;
  }
  return -1;
}

function inferStatus(raw: string, endDate: string | null): DriverStatus {
  const s = raw.toLowerCase().trim();
  if (s.includes('active') || s.includes('current') || s === 'yes' || s === 'y') return 'active';
  if (s.includes('left') || s.includes('inactive') || s.includes('depart') || s.includes('term') || s.includes('churn')) {
    return 'left';
  }
  return endDate ? 'left' : 'active';
}

function parseDriversFromRows(rows: string[][]): DriverRow[] {
  if (rows.length < 2) return [];

  const drivers: DriverRow[] = [];
  const today = todayIso();
  let cols: {
    name: number;
    start: number;
    end: number;
    weeks: number;
    weekLeft: number;
  } | null = null;

  function detectCols(headers: string[]) {
    const name = findCol(headers, [
      /drivers?\s*name/,
      /^name$/,
      /full.?name/,
      /employee/,
      /^driver$/,
    ]);
    const start = findCol(headers, [
      /start(ing)?\s*date/,
      /starting/,
      /start/,
      /came/,
      /onboard/,
      /join/,
      /hire.?date/,
    ]);
    // Prefer "left date" / "end date" — avoid matching "Week left"
    const end = findCol(headers, [
      /left\s*date/,
      /end\s*date/,
      /^left$/,
      /leave\s*date/,
      /depart/,
      /exit/,
      /terminat/,
    ]);
    // Retention weeks first; avoid "Week started" / row-index "weeks"
    const weeks = findCol(headers, [
      /^retention$/,
      /retention/,
      /tenure/,
      /duration/,
      /^weeks?\s*$/,
    ]);
    const weekLeft = findCol(headers, [/week\s*left/, /status/]);
    if (name < 0) return null;
    return { name, start, end, weeks, weekLeft };
  }

  function isHeaderRow(row: string[]): boolean {
    const joined = row.join(' ').toLowerCase();
    return /drivers?\s*name/.test(joined) && /start/.test(joined);
  }

  function isSectionTitle(name: string): boolean {
    const n = name.toLowerCase();
    return (
      /temporary|worked and left|active\s*$/i.test(n) ||
      /^(name|drivers?\s*name|total|average|weeks?)$/i.test(n)
    );
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (isHeaderRow(row)) {
      cols = detectCols(row.map(h => h.trim()));
      continue;
    }
    if (!cols) continue;

    const name = (row[cols.name] ?? '').trim();
    if (!name || /^\d+$/.test(name) || isSectionTitle(name)) continue;

    const startDate = cols.start >= 0 ? parseDate(row[cols.start] ?? '') : null;
    const endRaw = cols.end >= 0 ? (row[cols.end] ?? '') : '';
    const endDate = parseDate(endRaw);

    // Status: "Week left" is often "active"; otherwise infer from leave date
    const weekLeftRaw = cols.weekLeft >= 0 ? (row[cols.weekLeft] ?? '') : '';
    const status = inferStatus(weekLeftRaw || endRaw, endDate);

    // Always compute tenure from hire → leave/today (ignore sheet Retention column)
    let weeks = 0;
    if (startDate) {
      weeks = weeksBetween(startDate, endDate ?? today);
    }

    // Skip empty junk rows with no start date and no tenure
    if (!startDate && weeks === 0) continue;

    drivers.push({ name, startDate, endDate, weeks, status });
  }

  return drivers;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function buildBuckets(drivers: DriverRow[]): DriverTenureBucket[] {
  return TENURE_BUCKETS.map(b => ({
    ...b,
    count: drivers.filter(d => {
      if (d.weeks < b.minWeeks) return false;
      if (b.maxWeeks == null) return d.weeks >= b.minWeeks;
      return d.weeks <= b.maxWeeks;
    }).length,
  }));
}

function monthKey(iso: string): string {
  const [y, m] = iso.split('-');
  const mi = Number(m) - 1;
  return `${MONTH_NAMES[mi] ?? m} ${y}`;
}

function buildMovement(drivers: DriverRow[]): DriverMonthMovement[] {
  const map = new Map<string, { onboarded: number; departed: number; sort: string }>();

  for (const d of drivers) {
    if (d.startDate) {
      const k = monthKey(d.startDate);
      const cur = map.get(k) ?? { onboarded: 0, departed: 0, sort: d.startDate.slice(0, 7) };
      cur.onboarded += 1;
      map.set(k, cur);
    }
    if (d.endDate) {
      const k = monthKey(d.endDate);
      const cur = map.get(k) ?? { onboarded: 0, departed: 0, sort: d.endDate.slice(0, 7) };
      cur.departed += 1;
      map.set(k, cur);
    }
  }

  const sorted = [...map.entries()].sort((a, b) => a[1].sort.localeCompare(b[1].sort));
  let headcount = 0;
  return sorted.map(([month, v]) => {
    headcount += v.onboarded - v.departed;
    return {
      month,
      onboarded: v.onboarded,
      departed: v.departed,
      headcount: Math.max(0, headcount),
    };
  });
}

export function buildSummary(drivers: DriverRow[]): DriversSummary {
  const active = drivers.filter(d => d.status === 'active').length;
  const left = drivers.length - active;
  const weeks = drivers.map(d => d.weeks);
  const avgWeeks = weeks.length > 0
    ? Math.round((weeks.reduce((s, w) => s + w, 0) / weeks.length) * 10) / 10
    : 0;

  return {
    total: drivers.length,
    active,
    left,
    avgWeeks,
    medianWeeks: median(weeks),
    buckets: buildBuckets(drivers),
    movement: buildMovement(drivers),
  };
}

function emptyResult(error?: string): DriversDataResult {
  return {
    drivers: [],
    summary: {
      total: 0,
      active: 0,
      left: 0,
      avgWeeks: 0,
      medianWeeks: 0,
      buckets: [],
      movement: [],
    },
    error,
    source: 'live',
  };
}

export async function fetchDriversData(): Promise<DriversDataResult> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return emptyResult(`HTTP ${res.status} — share the sheet as “Anyone with the link can view”`);
    }

    const text = await res.text();
    if (looksLikeHtml(text)) {
      return emptyResult('Sheet is private — share as “Anyone with the link can view” to load live retention data');
    }

    const drivers = parseDriversFromRows(parseCSV(text));
    if (drivers.length === 0) {
      return emptyResult('No driver rows found — check column headers (Name, Start, Left/End, Weeks)');
    }

    return { drivers, summary: buildSummary(drivers), source: 'live' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emptyResult(message);
  }
}
