import type { DriverRecord } from '../types/roster';
import type { HRMonthData, HRDataResult } from '../types/hr';

export type { DriverRecord };

export interface RosterResult {
  drivers: DriverRecord[];
  hrData: HRMonthData[];
  error?: string;
}

const SHEET_ID = process.env.DRIVERS_SHEET_ID ?? '1aAKDHQRg2M9MPPCVfGSv8_i32k4bPLVF9TFkWCObrkU';
const SHEET_GID = 0;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function monthFromLabel(raw: string): { index: number; label: string } | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  const idx = MONTH_NAMES.findIndex(m => key.startsWith(m.toLowerCase()));
  if (idx < 0) return null;
  // Sheet is 2026 hire log
  return { index: idx + 1, label: `${MONTH_SHORT[idx]} 2026` };
}

/**
 * Parse dates that mix MDY and DMY. Prefer the section month when ambiguous.
 * "still working" / empty → null (not terminated).
 */
function parseDate(raw: string, hintMonth?: number): string | null {
  const s = raw.trim();
  if (!s || /still\s*working/i.test(s) || /^n\/?a$/i.test(s) || s === '-') return null;

  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return null;

  let a = Number(m[1]);
  let b = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;

  let month: number;
  let day: number;

  if (a > 12 && b >= 1 && b <= 12) {
    // 14/01/2026 → DMY
    day = a; month = b;
  } else if (b > 12 && a >= 1 && a <= 12) {
    // 01/23/2026 → MDY
    month = a; day = b;
  } else if (hintMonth != null && a === hintMonth) {
    // Ambiguous but first part matches section month → MDY
    month = a; day = b;
  } else if (hintMonth != null && b === hintMonth) {
    // Ambiguous but second part matches section month → DMY
    day = a; month = b;
  } else {
    // Default MDY (Google Sheets US-style)
    month = a; day = b;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeHR(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length < 2) return null;
  if (/^hired\s*hr$/i.test(t)) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function isHeaderName(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'driver name' || n === 'n' || n.startsWith('driver name');
}

function pushDriver(
  drivers: DriverRecord[],
  nameRaw: string,
  hrRaw: string,
  hiredRaw: string,
  leftRaw: string,
  hintMonth?: number,
) {
  const name = nameRaw.trim();
  if (!name || isHeaderName(name) || /^\d+$/.test(name)) return;

  const hiredDate = parseDate(hiredRaw, hintMonth);
  if (!hiredDate) return;

  const leftTrim = leftRaw.trim();
  const stillWorking = !leftTrim || /still\s*working/i.test(leftTrim);
  // Do not pass hire-month hint for leave dates — they can fall in any later month
  const terminationDate = stillWorking ? null : parseDate(leftTrim);

  drivers.push({
    name,
    hiredDate,
    terminationDate,
    hr: normalizeHR(hrRaw),
    firstLoad: null,
  });
}

/** Side-by-side month blocks: left = cols B–E, right = cols H–K */
function parseUnifiedSheet(rows: string[][]): DriverRecord[] {
  const drivers: DriverRecord[] = [];
  let leftMonth: { index: number; label: string } | null = null;
  let rightMonth: { index: number; label: string } | null = null;

  for (const row of rows) {
    const b = row[1] ?? '';
    const c = row[2] ?? '';
    const d = row[3] ?? '';
    const e = row[4] ?? '';
    const h = row[7] ?? '';
    const i = row[8] ?? '';
    const j = row[9] ?? '';
    const k = row[10] ?? '';

    const leftMonthHit = monthFromLabel(b);
    const rightMonthHit = monthFromLabel(h);
    // March row is oddly "N,March,...,June" — month in col B with N in col A
    if (leftMonthHit && !c && !d) leftMonth = leftMonthHit;
    if (rightMonthHit && !i && !j) rightMonth = rightMonthHit;

    // Also: first header row ",January,,,,,,April,,,"
    if (leftMonthHit && /january|february|march|april|may|june/i.test(b) && !row[0]) {
      leftMonth = leftMonthHit;
    }
    if (rightMonthHit) rightMonth = rightMonthHit;

    // Skip pure header rows
    const bIsHeader = isHeaderName(b) || /^hired\s*hr$/i.test(c);
    const hIsHeader = isHeaderName(h) || /^hired\s*hr$/i.test(i);

    if (b && !bIsHeader && !leftMonthHit) {
      pushDriver(drivers, b, c, d, e, leftMonth?.index);
    }
    if (h && !hIsHeader && !rightMonthHit) {
      pushDriver(drivers, h, i, j, k, rightMonth?.index);
    }
  }

  return drivers;
}

export function buildHRDataFromRoster(drivers: DriverRecord[]): HRMonthData[] {
  const byMonth = new Map<string, { hires: Record<string, number>; sort: string }>();

  for (const d of drivers) {
    if (!d.hiredDate || !d.hr) continue;
    const [y, m] = d.hiredDate.split('-');
    const mi = Number(m) - 1;
    if (mi < 0 || mi > 11) continue;
    const label = `${MONTH_SHORT[mi]} ${y}`;
    const sort = `${y}-${m}`;
    const cur = byMonth.get(label) ?? { hires: {}, sort };
    cur.hires[d.hr] = (cur.hires[d.hr] ?? 0) + 1;
    byMonth.set(label, cur);
  }

  return [...byMonth.entries()]
    .sort((a, b) => a[1].sort.localeCompare(b[1].sort))
    .map(([month, v]) => ({
      month,
      hires: v.hires,
      total: Object.values(v.hires).reduce((s, n) => s + n, 0),
    }));
}

export async function fetchBPRosterData(): Promise<RosterResult> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (looksLikeHtml(text)) {
      throw new Error('Sheet is private — share as “Anyone with the link can view”');
    }

    const drivers = parseUnifiedSheet(parseCSV(text));
    if (drivers.length === 0) {
      throw new Error('No driver rows found in unified sheet');
    }

    return {
      drivers,
      hrData: buildHRDataFromRoster(drivers),
    };
  } catch (err) {
    return {
      drivers: [],
      hrData: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** HR monthly counts derived from the same unified driver sheet. */
export async function fetchHRDataFromRoster(): Promise<HRDataResult> {
  const { hrData, error } = await fetchBPRosterData();
  return { data: hrData, error };
}
