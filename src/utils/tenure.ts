import type { DriverRecord } from '../types/roster';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Tenure in completed weeks, calculated from hire date:
 * - Active (no termination): hire date → today
 * - Left: hire date → termination date
 */
export function calcTenureWeeks(
  hiredDate: string | null | undefined,
  terminationDate: string | null | undefined = null,
  asOf: Date = new Date(),
): number | null {
  if (!hiredDate) return null;

  const start = parseIsoDay(hiredDate);
  if (start == null) return null;

  const end = terminationDate ? parseIsoDay(terminationDate) : startOfLocalDay(asOf);
  if (end == null || end < start) return null;

  return Math.max(0, Math.floor((end - start) / MS_PER_WEEK));
}

export function calcDriverTenureWeeks(driver: DriverRecord, asOf?: Date): number | null {
  return calcTenureWeeks(driver.hiredDate, driver.terminationDate, asOf);
}

function parseIsoDay(iso: string): number | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isNaN(t) ? null : t;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
