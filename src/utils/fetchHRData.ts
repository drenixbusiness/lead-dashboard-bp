import type { HRMonthData, HRDataResult } from '../types/hr';

// Driver hire log — months listed as section headers in one sheet (gid=0).
const SHEET_ID = process.env.HR_SHEET_ID ?? '1b0KGjOtMt_Tuk7OppwjeY_boyC9Isbpe4qVKjK92SHo';
const SHEET_GID = 0;

const MONTH_ALIASES: Record<string, string> = {
  january: 'Jan 2026',
  february: 'Feb 2026',
  march: 'Mar 2026',
  april: 'Apr 2026',
  may: 'May 2026',
  june: 'Jun 2026',
  july: 'Jul 2026',
  august: 'Aug 2026',
  september: 'Sep 2026',
  october: 'Oct 2026',
  november: 'Nov 2026',
  december: 'Dec 2026',
};

function normalizeHR(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  // Keep consistent casing (Jesicaa, etc.) while fixing ALL-CAPS / mixed names
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let inQuote = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

function monthLabelFromCell(value: string): string | null {
  const key = value.trim().toLowerCase();
  return MONTH_ALIASES[key] ?? null;
}

function parseSheet(rows: string[][]): HRMonthData[] {
  // Layout: col B = month header OR driver name; col C = HR.
  // Month sections start when col B is a month name (January, February, …).
  const months: HRMonthData[] = [];
  let current: HRMonthData | null = null;

  for (const row of rows) {
    const colA = row[0] ?? '';
    const colB = row[1] ?? '';
    const colC = row[2] ?? '';

    const monthLabel = monthLabelFromCell(colB);
    if (monthLabel) {
      if (current) months.push(current);
      current = { month: monthLabel, hires: {}, total: 0 };
      continue;
    }

    // Skip header / empty rows
    const bLower = colB.toLowerCase();
    if (!current) continue;
    if (!colB || bLower === 'drivers name' || bLower.startsWith('drivers name')) continue;
    if (!colC || colC.toLowerCase() === 'hr') continue;

    // Require a driver name and an HR name; ignore junk trailing rows
    const hr = normalizeHR(colC);
    if (!hr || hr.length < 2) continue;
    // Skip rows that look like orphan numbers with no driver
    if (!colB && /^\d+$/.test(colA)) continue;

    current.hires[hr] = (current.hires[hr] ?? 0) + 1;
    current.total += 1;
  }

  if (current && current.total > 0) months.push(current);
  return months;
}

export async function fetchHRData(): Promise<HRDataResult> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching HR sheet`);

    const rows = parseCSV(await res.text());
    const data = parseSheet(rows);
    if (data.length === 0) {
      return { data: [], error: 'No HR hire rows found in sheet' };
    }
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: [], error: message };
  }
}
