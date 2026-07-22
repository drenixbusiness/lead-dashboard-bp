import type { HRMonthData, HRDataResult } from '../types/hr';

const SHEET_ID = '1TpoZFQdXA7wb-Ljuyw53MplTJeKCPRZTxgOyHPH0pZM';

const MONTHS: { label: string; gid: number }[] = [
  { label: 'Jan 2026', gid: 1348361704 },
  { label: 'Feb 2026', gid: 1631028660 },
  { label: 'Mar 2026', gid: 1096656459 },
  { label: 'Apr 2026', gid: 693650426  },
  { label: 'May 2026', gid: 762556289  },
  { label: 'Jun 2026', gid: 844332491  },
  { label: 'Jul 2026', gid: 1446224036 },
];

function normalizeHR(raw: string): string {
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    const cells: string[] = [];
    let inQuote = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cells.push(cell.trim()); cell = ''; }
      else { cell += ch; }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

async function fetchMonth(label: string, gid: number): Promise<HRMonthData> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res  = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${label}`);

  const rows = parseCSV(await res.text());

  // Find header row by locating "HR name" cell
  let hrCol = -1;
  let dataStartRow = -1;
  for (let r = 0; r < rows.length; r++) {
    const idx = rows[r].findIndex(c => c.toLowerCase() === 'hr name');
    if (idx !== -1) { hrCol = idx; dataStartRow = r + 1; break; }
  }

  const hires: Record<string, number> = {};
  if (hrCol !== -1) {
    for (let r = dataStartRow; r < rows.length; r++) {
      const raw = rows[r][hrCol];
      if (!raw || raw.trim() === '') continue;
      const hr = normalizeHR(raw);
      if (hr.length > 1) hires[hr] = (hires[hr] ?? 0) + 1;
    }
  }

  return {
    month: label,
    hires,
    total: Object.values(hires).reduce((s, v) => s + v, 0),
  };
}

export async function fetchHRData(): Promise<HRDataResult> {
  try {
    const data = await Promise.all(MONTHS.map(m => fetchMonth(m.label, m.gid)));
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: [], error: message };
  }
}
