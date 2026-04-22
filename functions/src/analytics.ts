import {BetaAnalyticsDataClient} from "@google-analytics/data";

const GA4_PROPERTY_ID = "494849507";

export interface DailyRow {
  date: string; // "YYYY-MM-DD"
  sessions: number;
  pageViews: number;
}

export interface WeekTotals {
  sessions: number;
  pageViews: number;
}

export interface AnalyticsData {
  daily: DailyRow[]; // last 14 days, newest first
  currentWeek: WeekTotals;
  lastWeek: WeekTotals;
  allTime: WeekTotals;
}

/**
 * Returns the Monday of the ISO week containing `date`.
 * @param {Date} date - The reference date.
 * @return {Date} The Monday of the week.
 */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats a Date as "YYYY-MM-DD" using local time.
 * @param {Date} d - The date to format.
 * @return {string} The formatted date string.
 */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fetch sessions and page views from GA4.
 * @param {string} clientEmail - Service account client_email.
 * @param {string} privateKey - Service account private_key.
 * @return {Promise<AnalyticsData>} Structured analytics data.
 */
export async function fetchAnalytics(
  clientEmail: string,
  privateKey: string
): Promise<AnalyticsData> {
  const analyticsClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });

  const property = `properties/${GA4_PROPERTY_ID}`;

  // ── Daily report: last 14 days ────────────────────────────
  const [dailyResponse] = await analyticsClient.runReport({
    property,
    dimensions: [{name: "date"}],
    metrics: [
      {name: "sessions"},
      {name: "screenPageViews"},
    ],
    dateRanges: [{startDate: "14daysAgo", endDate: "today"}],
    orderBys: [{dimension: {dimensionName: "date"}, desc: true}],
  });

  const daily: DailyRow[] = (dailyResponse.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? ""; // "YYYYMMDD"
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return {
      date,
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      pageViews: Number(row.metricValues?.[1]?.value ?? 0),
    };
  });

  // ── All-time report ───────────────────────────────────────
  const [allTimeResponse] = await analyticsClient.runReport({
    property,
    metrics: [
      {name: "sessions"},
      {name: "screenPageViews"},
    ],
    dateRanges: [{startDate: "2020-01-01", endDate: "today"}],
  });

  const allTimeRow = allTimeResponse.rows?.[0];
  const allTime: WeekTotals = {
    sessions: Number(allTimeRow?.metricValues?.[0]?.value ?? 0),
    pageViews: Number(allTimeRow?.metricValues?.[1]?.value ?? 0),
  };

  // ── Derive week totals from daily rows ────────────────────
  const today = new Date();
  const currentWeekMonday = getMondayOf(today);
  const lastWeekMonday = new Date(currentWeekMonday);
  lastWeekMonday.setDate(lastWeekMonday.getDate() - 7);
  const lastWeekSunday = new Date(currentWeekMonday);
  lastWeekSunday.setDate(lastWeekSunday.getDate() - 1);

  const currentWeekStart = toYMD(currentWeekMonday);
  const lastWeekStart = toYMD(lastWeekMonday);
  const lastWeekEnd = toYMD(lastWeekSunday);

  const sumWhere = (pred: (d: string) => boolean): WeekTotals =>
    daily
      .filter((r) => pred(r.date))
      .reduce(
        (acc, r) => ({
          sessions: acc.sessions + r.sessions,
          pageViews: acc.pageViews + r.pageViews,
        }),
        {sessions: 0, pageViews: 0}
      );

  const currentWeek = sumWhere((d) => d >= currentWeekStart);
  const lastWeek = sumWhere((d) => d >= lastWeekStart && d <= lastWeekEnd);

  return {daily, currentWeek, lastWeek, allTime};
}
