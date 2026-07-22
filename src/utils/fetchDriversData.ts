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

    let weeks = 0;
    if (cols.weeks >= 0) {
      const wv = Number(String(row[cols.weeks] ?? '').replace(/[^\d.]/g, ''));
      if (Number.isFinite(wv) && wv >= 0) weeks = Math.round(wv);
    }
    if (weeks === 0 && startDate) {
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

/** Fallback sample roster — used until the sheet is shared publicly. */
function sampleDrivers(): DriverRow[] {
  const rows: Array<[string, string, string | null, number, DriverStatus]> = [
    ['Eddie', '2026-01-06', null, 28, 'active'],
    ['George Asimah', '2026-01-08', '2026-02-12', 5, 'left'],
    ['Alfred Cheruiyot', '2026-01-10', null, 27, 'active'],
    ['Maher Alqasas', '2026-01-12', '2026-01-28', 2, 'left'],
    ['Dennis Knox', '2026-01-14', null, 26, 'active'],
    ['Jose Perez', '2026-01-16', '2026-03-20', 9, 'left'],
    ['Francois N.', '2026-01-18', '2026-02-01', 2, 'left'],
    ['Anthony Thompson', '2026-01-20', null, 25, 'active'],
    ['Lemuel Bradshaw', '2026-01-22', '2026-04-10', 11, 'left'],
    ['Todd Tarter', '2026-02-03', null, 23, 'active'],
    ['JB Butler', '2026-02-05', '2026-02-26', 3, 'left'],
    ['Johnny Person', '2026-02-07', null, 22, 'active'],
    ['Yikealo Abraha', '2026-02-09', '2026-05-15', 14, 'left'],
    ['Henry Ford', '2026-02-11', '2026-03-04', 3, 'left'],
    ['Figaro Somel', '2026-02-13', null, 21, 'active'],
    ['Danny Trotter', '2026-02-15', '2026-04-01', 6, 'left'],
    ['Ramiro Ramirez', '2026-02-17', null, 20, 'active'],
    ['Harold Dwight', '2026-02-19', '2026-03-10', 3, 'left'],
    ['Cedric Terrell', '2026-03-02', null, 19, 'active'],
    ['Charles Hardin', '2026-03-04', '2026-03-25', 3, 'left'],
    ['Shahram Nematov', '2026-03-06', null, 18, 'active'],
    ['Jaime Parrales', '2026-03-08', '2026-05-20', 10, 'left'],
    ['Eric Gborglah', '2026-03-10', '2026-04-07', 4, 'left'],
    ['Nikila Woods', '2026-03-12', null, 17, 'active'],
    ['Eric Neely', '2026-03-14', '2026-06-01', 11, 'left'],
    ['Manuel Talavera', '2026-03-16', null, 17, 'active'],
    ['James Cross', '2026-04-02', '2026-04-20', 3, 'left'],
    ['Terrance Check', '2026-04-04', null, 14, 'active'],
    ['Bobby Keys', '2026-04-06', '2026-05-18', 6, 'left'],
    ['Stephen Gbeyor', '2026-04-08', null, 13, 'active'],
    ['Shernard Fields', '2026-04-10', '2026-04-24', 2, 'left'],
    ['Mendez Jose', '2026-04-12', null, 13, 'active'],
    ['Keshuan London', '2026-04-14', '2026-06-10', 8, 'left'],
    ['Coby Graves', '2026-04-16', null, 12, 'active'],
    ['David Russell', '2026-05-02', '2026-05-16', 2, 'left'],
    ['Rodney Allen', '2026-05-04', null, 10, 'active'],
    ['Maxo Joseph', '2026-05-06', '2026-06-20', 6, 'left'],
    ['Charles Moore', '2026-05-08', null, 9, 'active'],
    ['Glenda Gipson', '2026-05-10', '2026-05-24', 2, 'left'],
    ['Mohammed Ali', '2026-05-12', null, 9, 'active'],
    ['Khalid EL Yakine', '2026-05-14', '2026-06-28', 6, 'left'],
    ['Issa Hussein', '2026-05-16', null, 8, 'active'],
    ['Dominique Bolding', '2026-06-02', null, 6, 'active'],
    ['Tony Brown', '2026-06-04', '2026-06-18', 2, 'left'],
    ['Jonathan Busby', '2026-06-06', null, 5, 'active'],
    ['Dyone Youmans', '2026-06-08', null, 5, 'active'],
    ['Charles Coleman', '2026-06-10', '2026-06-24', 2, 'left'],
    ['Ryan Haskell', '2026-06-12', null, 4, 'active'],
    ['James Gaines', '2026-06-14', null, 4, 'active'],
    ['Robert', '2026-06-16', null, 3, 'active'],
  ];

  return rows.map(([name, startDate, endDate, weeks, status]) => ({
    name, startDate, endDate, weeks, status,
  }));
}

function emptyResult(error?: string, source: 'live' | 'sample' = 'sample'): DriversDataResult {
  const drivers = sampleDrivers();
  return { drivers, summary: buildSummary(drivers), error, source };
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
