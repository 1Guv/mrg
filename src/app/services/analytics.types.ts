export interface DailyRow {
  date: string;       // "YYYY-MM-DD"
  sessions: number;
  pageViews: number;
}

export interface WeekTotals {
  sessions: number;
  pageViews: number;
}

export interface AnalyticsData {
  daily: DailyRow[];
  currentWeek: WeekTotals;
  lastWeek: WeekTotals;
  allTime: WeekTotals;
}
