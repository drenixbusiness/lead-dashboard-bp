import { fetchBPRosterData } from './fetchRosterData';
import type { HRDataResult } from '../types/hr';

/** HR hires by month — derived from the unified driver sheet (same source as roster/tenure). */
export async function fetchHRData(): Promise<HRDataResult> {
  const { hrData, error } = await fetchBPRosterData();
  return { data: hrData, error };
}
