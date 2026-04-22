"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAnalytics = fetchAnalytics;
const data_1 = require("@google-analytics/data");
const GA4_PROPERTY_ID = "494849507";
/** Returns the Monday of the ISO week containing `date`. */
function getMondayOf(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
/** Formats a Date as "YYYY-MM-DD" using local time. */
function toYMD(d) {
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
async function fetchAnalytics(clientEmail, privateKey) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const analyticsClient = new data_1.BetaAnalyticsDataClient({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
    });
    const property = `properties/${GA4_PROPERTY_ID}`;
    // ── Daily report: last 14 days ────────────────────────────
    const [dailyResponse] = await analyticsClient.runReport({
        property,
        dimensions: [{ name: "date" }],
        metrics: [
            { name: "sessions" },
            { name: "screenPageViews" },
        ],
        dateRanges: [{ startDate: "14daysAgo", endDate: "today" }],
        orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
    });
    const daily = ((_a = dailyResponse.rows) !== null && _a !== void 0 ? _a : []).map((row) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const raw = (_c = (_b = (_a = row.dimensionValues) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : ""; // "YYYYMMDD"
        const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        return {
            date,
            sessions: Number((_f = (_e = (_d = row.metricValues) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : 0),
            pageViews: Number((_j = (_h = (_g = row.metricValues) === null || _g === void 0 ? void 0 : _g[1]) === null || _h === void 0 ? void 0 : _h.value) !== null && _j !== void 0 ? _j : 0),
        };
    });
    // ── All-time report ───────────────────────────────────────
    const [allTimeResponse] = await analyticsClient.runReport({
        property,
        metrics: [
            { name: "sessions" },
            { name: "screenPageViews" },
        ],
        dateRanges: [{ startDate: "2020-01-01", endDate: "today" }],
    });
    const allTimeRow = (_b = allTimeResponse.rows) === null || _b === void 0 ? void 0 : _b[0];
    const allTime = {
        sessions: Number((_e = (_d = (_c = allTimeRow === null || allTimeRow === void 0 ? void 0 : allTimeRow.metricValues) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) !== null && _e !== void 0 ? _e : 0),
        pageViews: Number((_h = (_g = (_f = allTimeRow === null || allTimeRow === void 0 ? void 0 : allTimeRow.metricValues) === null || _f === void 0 ? void 0 : _f[1]) === null || _g === void 0 ? void 0 : _g.value) !== null && _h !== void 0 ? _h : 0),
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
    const sumWhere = (pred) => daily
        .filter((r) => pred(r.date))
        .reduce((acc, r) => ({
        sessions: acc.sessions + r.sessions,
        pageViews: acc.pageViews + r.pageViews,
    }), { sessions: 0, pageViews: 0 });
    const currentWeek = sumWhere((d) => d >= currentWeekStart);
    const lastWeek = sumWhere((d) => d >= lastWeekStart && d <= lastWeekEnd);
    return { daily, currentWeek, lastWeek, allTime };
}
//# sourceMappingURL=analytics.js.map