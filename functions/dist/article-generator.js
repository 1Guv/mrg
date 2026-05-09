"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGenerateDailyArticle = runGenerateDailyArticle;
const googleapis_1 = require("googleapis");
const axios_1 = __importDefault(require("axios"));
const admin = __importStar(require("firebase-admin"));
// ── Constants ────────────────────────────────────────────────────────────────
const GSC_SITE_URL = "https://mrvaluations.co.uk/";
// ── Date helpers ─────────────────────────────────────────────────────────────
/**
 * Format a Date as "YYYY-MM-DD".
 * @param {Date} d - The date to format.
 * @return {string} The formatted date string.
 */
function toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
// ── GSC fetch ────────────────────────────────────────────────────────────────
/**
 * Fetch search analytics rows from Google Search Console for last 90 days.
 * @param {string} clientId - OAuth2 client ID.
 * @param {string} clientSecret - OAuth2 client secret.
 * @param {string} refreshToken - OAuth2 refresh token.
 * @return {Promise<GscRow[]>} Array of query rows.
 */
async function fetchGscRows(clientId, clientSecret, refreshToken) {
    var _a;
    const oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, "http://localhost:3456");
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const sc = googleapis_1.google.searchconsole({ version: "v1", auth: oauth2Client });
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const res = await sc.searchanalytics.query({
        siteUrl: GSC_SITE_URL,
        requestBody: {
            startDate: toYMD(startDate),
            endDate: toYMD(endDate),
            dimensions: ["query"],
            rowLimit: 500,
            dataState: "all",
        },
    });
    const rows = (_a = res.data.rows) !== null && _a !== void 0 ? _a : [];
    return rows
        .filter((r) => r.keys && r.keys.length > 0)
        .map((r) => {
        var _a, _b, _c;
        return ({
            query: r.keys[0],
            clicks: (_a = r.clicks) !== null && _a !== void 0 ? _a : 0,
            impressions: (_b = r.impressions) !== null && _b !== void 0 ? _b : 0,
            position: (_c = r.position) !== null && _c !== void 0 ? _c : 0,
        });
    });
}
// ── Keyword categorisation ───────────────────────────────────────────────────
/**
 * Categorise GSC rows into keyword candidates, sorted by impressions desc.
 * Priority: Quick Wins (position 5-40, impressions >= 2) + Untapped
 * (impressions >= 2, clicks === 0). Both lists are combined, deduped,
 * and sorted by impressions descending.
 * @param {GscRow[]} rows - GSC query rows.
 * @return {string[]} Candidate keywords ordered by impressions desc.
 */
function categoriseKeywords(rows) {
    const quickWins = rows.filter((r) => r.position >= 5 && r.position <= 40 && r.impressions >= 2);
    const untapped = rows.filter((r) => r.impressions >= 2 && r.clicks === 0);
    const combined = [...quickWins, ...untapped];
    // Dedup by query, keeping first occurrence
    const seen = new Set();
    const deduped = [];
    for (const row of combined) {
        if (!seen.has(row.query)) {
            seen.add(row.query);
            deduped.push(row);
        }
    }
    // Sort by impressions descending
    deduped.sort((a, b) => b.impressions - a.impressions);
    return deduped.map((r) => r.query);
}
// ── Gemini call ──────────────────────────────────────────────────────────────
/**
 * Call Gemini 2.5 Flash to generate a full SEO article for the given keyword.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {string} keyword - Target keyword.
 * @return {Promise<GeminiArticlePayload>} Parsed article payload from Gemini.
 */
async function callGemini(geminiApiKey, keyword) {
    var _a, _b, _c, _d, _e, _f;
    /* eslint-disable max-len */
    const prompt = `You are an expert SEO content writer for the UK number plate market. Write a short, punchy, visually rich SEO blog article targeting the keyword: "${keyword}".

The article is for mrvaluations.co.uk — free number plate valuations and a marketplace to list plates for sale.

Requirements:
- Tone: fun, helpful, authoritative — aimed at UK car owners
- Maximum 300 words of body content (not counting HTML markup or attributes)
- Use proper HTML tags: <h2>, <p>, <ul>, <li>, <strong> etc.
- Sprinkle relevant emojis naturally into headings and body text (e.g. 🚗 🔢 💰 ✨ 🏆)
- Use emoji as inline icons where appropriate (e.g. ✅ for list items, 👉 for CTAs)
- Include 1–2 relevant inline images using picsum.photos:
  <img src="https://picsum.photos/seed/{topic-word}/800/400" alt="{descriptive alt}" style="width:100%;border-radius:12px;margin:24px 0">
  — pick seed words related to the article topic (e.g. "car", "plates", "road", "luxury", "racing")
- Include at least 2 internal CTAs woven naturally into the content:
  1. One linking to / (e.g. <a href="/">get a free valuation</a>)
  2. One linking to /list-plate (e.g. <a href="/list-plate">list your plate for sale</a>)
- At the very end of the article, include an "expert author" callout using this exact HTML structure (fill in the placeholders):
  <div style="display:flex;align-items:center;gap:16px;padding:20px;background:#f9fafb;border-radius:12px;margin-top:40px;border:1px solid #e5e7eb">
    <img src="https://images.unsplash.com/photo-{PHOTO_ID}?w=120&h=120&fit=crop&crop=face" alt="{Name}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;border:3px solid #e5e7eb">
    <div>
      <p style="font-weight:700;margin:0 0 2px;font-size:15px">{Full Name}</p>
      <p style="color:#6b7280;margin:0;font-size:13px">{Fancy Job Title}</p>
    </div>
  </div>
  — For PHOTO_ID, pick ONE of these real Unsplash photo IDs of people with sunglasses (choose randomly, male or female):
    Male options: 1506794778202-cad84cf45f1d, 1507003211169-0a1dd7228f2d, 1500648767791-00dcc994a43e
    Female options: 1529626455594-4ff0802cfb7e, 1488426862026-3ee34a7d66df, 1531746020798-e6953c6e8e04
  — Invent a glamorous-sounding full name (e.g. "Sebastian Hartley-Cross", "Camille Dubois-Laurent")
  — Invent a very fancy made-up job title (e.g. "Chief Plate Intelligence Officer", "Head of Automotive Prestige Strategy", "Director of Vehicular Identity")
- The content field must be a complete self-contained HTML article wrapped in <article> tags

Respond ONLY with valid JSON in this exact shape (no markdown fences):
{
  "slug": "url-friendly-slug-matching-keyword",
  "title": "Engaging Article Title with an emoji",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "Compelling meta description under 155 chars",
  "category": "valuations or plates or cars",
  "content": "<article>...full HTML content here...</article>"
}`;
    /* eslint-enable max-len */
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
        "gemini-2.5-flash:generateContent";
    let response;
    try {
        response = await axios_1.default.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
        }, { headers: { "x-goog-api-key": geminiApiKey }, timeout: 240000 });
    }
    catch (axiosErr) {
        // Re-throw with the full response body so the caller can log it
        if (axios_1.default.isAxiosError(axiosErr) &&
            axiosErr.response) {
            throw new Error(`Gemini API ${axiosErr.response.status}: ` +
                JSON.stringify(axiosErr.response.data));
        }
        throw axiosErr;
    }
    const candidate = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.candidates) === null || _b === void 0 ? void 0 : _b[0];
    let rawText = (_e = (_d = (_c = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
    if (typeof rawText !== "string" || rawText.trim() === "") {
        throw new Error("article-generator: Gemini returned no usable text. " +
            `finishReason=${(_f = candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) !== null && _f !== void 0 ? _f : "unknown"}`);
    }
    // Strip markdown code fences if present
    if (rawText.trimStart().startsWith("```")) {
        rawText = rawText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "");
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch (_g) {
        throw new Error("article-generator: Gemini response was not valid JSON. " +
            `Preview: ${rawText.slice(0, 200)}`);
    }
    const requiredKeys = ["slug", "title", "metaTitle", "metaDescription", "category", "content"];
    for (const key of requiredKeys) {
        if (!parsed[key]) {
            throw new Error(`article-generator: Gemini payload missing field "${key}"`);
        }
    }
    const validCategories = ["valuations", "plates", "cars"];
    if (!validCategories.includes(parsed.category)) {
        throw new Error(`article-generator: unexpected category "${parsed.category}"`);
    }
    return parsed;
}
// ── Grounded Gemini call (news fallback) ─────────────────────────────────────
const GROUNDED_TOPICS = [
    {
        search: "latest UK private number plate auction results record prices 2025",
        category: "plates",
    },
    {
        // eslint-disable-next-line max-len
        search: "trending personalised number plates UK most valuable registrations",
        category: "valuations",
    },
    {
        search: "latest UK car news new model launches registrations 2025",
        category: "cars",
    },
];
/**
 * Call Gemini 2.5 Flash with Google Search grounding to write a news article
 * on one of the rotating fallback topics.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {number} topicIndex - Index into GROUNDED_TOPICS (cycles 0→1→2→0).
 * @return {Promise<GeminiArticlePayload>} Parsed article payload.
 */
async function callGeminiGrounded(geminiApiKey, topicIndex) {
    var _a, _b, _c, _d, _e, _f;
    const idx = topicIndex % GROUNDED_TOPICS.length;
    const { search, category } = GROUNDED_TOPICS[idx];
    /* eslint-disable max-len */
    const prompt = `Search the web for the most recent and interesting news about: "${search}".

Write a short, punchy, visually rich news blog article about what you find for mrvaluations.co.uk — a UK site offering free number plate valuations and a marketplace to list plates for sale.

Requirements:
- Tone: fun, helpful, authoritative — aimed at UK car owners
- Maximum 300 words of body content (not counting HTML markup or attributes)
- Use proper HTML tags: <h2>, <p>, <ul>, <li>, <strong> etc.
- Sprinkle relevant emojis naturally into headings and body text (e.g. 🚗 🔢 💰 ✨ 🏆)
- Use emoji as inline icons where appropriate (e.g. ✅ for list items, 👉 for CTAs)
- Include 1–2 relevant inline images using picsum.photos:
  <img src="https://picsum.photos/seed/{topic-word}/800/400" alt="{descriptive alt}" style="width:100%;border-radius:12px;margin:24px 0">
  — pick seed words related to the article topic (e.g. "car", "plates", "road", "luxury", "racing")
- Include at least 2 internal CTAs woven naturally into the content:
  1. One linking to / (e.g. <a href="/">get a free valuation</a>)
  2. One linking to /list-plate (e.g. <a href="/list-plate">list your plate for sale</a>)
- At the very end of the article, include an "expert author" callout using this exact HTML structure:
  <div style="display:flex;align-items:center;gap:16px;padding:20px;background:#f9fafb;border-radius:12px;margin-top:40px;border:1px solid #e5e7eb">
    <img src="https://images.unsplash.com/photo-{PHOTO_ID}?w=120&h=120&fit=crop&crop=face" alt="{Name}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;border:3px solid #e5e7eb">
    <div>
      <p style="font-weight:700;margin:0 0 2px;font-size:15px">{Full Name}</p>
      <p style="color:#6b7280;margin:0;font-size:13px">{Fancy Job Title}</p>
    </div>
  </div>
  — For PHOTO_ID, pick ONE of these real Unsplash photo IDs of people with sunglasses (choose randomly, male or female):
    Male options: 1506794778202-cad84cf45f1d, 1507003211169-0a1dd7228f2d, 1500648767791-00dcc994a43e
    Female options: 1529626455594-4ff0802cfb7e, 1488426862026-3ee34a7d66df, 1531746020798-e6953c6e8e04
  — Invent a glamorous-sounding full name (e.g. "Sebastian Hartley-Cross", "Camille Dubois-Laurent")
  — Invent a very fancy made-up job title (e.g. "Chief Plate Intelligence Officer", "Head of Automotive Prestige Strategy")
- The category for this article is: "${category}"
- The content field must be a complete self-contained HTML article wrapped in <article> tags

Respond ONLY with valid JSON in this exact shape (no markdown fences):
{
  "slug": "url-friendly-slug-based-on-topic",
  "title": "Engaging News Article Title with an emoji",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "Compelling meta description under 155 chars",
  "category": "${category}",
  "content": "<article>...full HTML content here...</article>"
}`;
    /* eslint-enable max-len */
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
        "gemini-2.5-flash:generateContent";
    let response;
    try {
        response = await axios_1.default.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { responseMimeType: "application/json" },
        }, { headers: { "x-goog-api-key": geminiApiKey }, timeout: 240000 });
    }
    catch (axiosErr) {
        if (axios_1.default.isAxiosError(axiosErr) && axiosErr.response) {
            throw new Error(`Gemini grounded API ${axiosErr.response.status}: ` +
                JSON.stringify(axiosErr.response.data));
        }
        throw axiosErr;
    }
    const candidate = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.candidates) === null || _b === void 0 ? void 0 : _b[0];
    let rawText = (_e = (_d = (_c = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
    if (typeof rawText !== "string" || rawText.trim() === "") {
        throw new Error("article-generator: Gemini grounded call returned no usable text. " +
            `finishReason=${(_f = candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) !== null && _f !== void 0 ? _f : "unknown"}`);
    }
    if (rawText.trimStart().startsWith("```")) {
        rawText = rawText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "");
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch (_g) {
        throw new Error("article-generator: Gemini grounded response was not valid JSON. " +
            `Preview: ${rawText.slice(0, 200)}`);
    }
    // Force the category to match the topic we searched for
    parsed.category = category;
    return parsed;
}
// ── Read time ────────────────────────────────────────────────────────────────
/**
 * Calculate estimated read time in minutes from HTML content.
 * Strips HTML tags, counts words, divides by 200 wpm, rounds up (min 1).
 * @param {string} html - HTML string.
 * @return {number} Estimated read time in minutes.
 */
function calcReadTime(html) {
    const text = html.replace(/<[^>]+>/g, " ");
    const wordCount = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    return Math.max(1, Math.ceil(wordCount / 200));
}
// ── Main export ──────────────────────────────────────────────────────────────
/**
 * Pull keyword opportunities from Google Search Console, pick the best unused
 * one, call Gemini to write an SEO article, and store it in Firestore.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {string} gscRefreshToken - GSC OAuth2 refresh token.
 * @param {string} gscClientId - GSC OAuth2 client ID.
 * @param {string} gscClientSecret - GSC OAuth2 client secret.
 * @return {Promise<void>}
 */
async function runGenerateDailyArticle(geminiApiKey, gscRefreshToken, gscClientId, gscClientSecret) {
    var _a, _b, _c, _d;
    const db = admin.firestore();
    // 1. Fetch GSC data
    console.log("article-generator: fetching GSC data...");
    const gscRows = await fetchGscRows(gscClientId, gscClientSecret, gscRefreshToken);
    console.log(`article-generator: received ${gscRows.length} GSC rows`);
    // 2. Categorise into candidates
    const candidates = categoriseKeywords(gscRows);
    console.log(`article-generator: ${candidates.length} keyword candidates`);
    // 3. Check used keywords
    const usedDoc = await db.collection("meta").doc("usedKeywords").get();
    const usedKeywords = usedDoc.exists ?
        ((_b = (_a = usedDoc.data()) === null || _a === void 0 ? void 0 : _a["keywords"]) !== null && _b !== void 0 ? _b : []) :
        [];
    // 4. Filter out already-used keywords
    const usedSet = new Set(usedKeywords);
    const filtered = candidates.filter((kw) => !usedSet.has(kw));
    // 5. Pick keyword or fall back to grounded news search
    let targetKeyword = null;
    let payload;
    if (filtered.length > 0) {
        targetKeyword = filtered[0];
        console.log(`article-generator: selected keyword "${targetKeyword}"`);
        // 6a. GSC keyword path — call Gemini normally
        console.log("article-generator: calling Gemini (keyword)...");
        payload = await callGemini(geminiApiKey, targetKeyword);
    }
    else {
        // 6b. No unused keywords — use Gemini with Google Search grounding
        console.log("article-generator: all GSC keywords used — " +
            "falling back to grounded news search");
        const topicDoc = await db
            .collection("meta").doc("groundedTopicIndex").get();
        const topicIndex = topicDoc.exists ?
            ((_d = (_c = topicDoc.data()) === null || _c === void 0 ? void 0 : _c["index"]) !== null && _d !== void 0 ? _d : 0) :
            0;
        console.log(`article-generator: grounded topic index ${topicIndex}`);
        payload = await callGeminiGrounded(geminiApiKey, topicIndex);
        // Advance the topic index so next fallback uses a different topic
        await db.collection("meta").doc("groundedTopicIndex").set({ index: (topicIndex + 1) % GROUNDED_TOPICS.length });
    }
    console.log(`article-generator: Gemini response received — title: "${payload.title}"`);
    // 7. Calculate read time
    const readTimeMinutes = calcReadTime(payload.content);
    // 8. Write article to Firestore
    const articleData = {
        slug: payload.slug,
        title: payload.title,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        category: payload.category,
        targetKeyword: targetKeyword !== null && targetKeyword !== void 0 ? targetKeyword : `grounded:${payload.category}`,
        content: payload.content,
        readTimeMinutes,
        publishedAt: admin.firestore.Timestamp.now(),
    };
    const docRef = await db.collection("articles").add(articleData);
    console.log(`article-generator: article written — doc ID: ${docRef.id}`);
    // 9. Mark keyword as used (only for GSC keywords, not grounded fallbacks)
    if (targetKeyword) {
        await db
            .collection("meta")
            .doc("usedKeywords")
            .set({ keywords: admin.firestore.FieldValue.arrayUnion(targetKeyword) }, { merge: true });
        console.log(`article-generator: done — keyword "${targetKeyword}" marked as used`);
    }
    else {
        console.log("article-generator: done — grounded news article, no keyword to mark");
    }
}
//# sourceMappingURL=article-generator.js.map