export type DriverStatus = 'active' | 'left';

export interface DriverRow {
  name: string;
  startDate: string | null; // ISO YYYY-MM-DD
  endDate: string | null;
  weeks: number;
  status: DriverStatus;
}

export interface DriverTenureBucket {
  label: string;
  minWeeks: number;
  maxWeeks: number | null;
  count: number;
  color: string;
}

export interface DriverMonthMovement {
  month: string;
  onboarded: number;
  departed: number;
  headcount: number;
}

export interface DriversSummary {
  total: number;
  active: number;
  left: number;
  avgWeeks: number;
  medianWeeks: number;
  buckets: DriverTenureBucket[];
  movement: DriverMonthMovement[];
}

export interface DriversDataResult {
  drivers: DriverRow[];
  summary: DriversSummary;
  error?: string;
  source: 'live';
}
