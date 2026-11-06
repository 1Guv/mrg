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
exports.runGenerateCelebrityArticle = runGenerateCelebrityArticle;
exports.runGenerateDailyArticle = runGenerateDailyArticle;
const googleapis_1 = require("googleapis");
const axios_1 = __importDefault(require("axios"));
const admin = __importStar(require("firebase-admin"));
const valuation_js_1 = require("./valuation.js");
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
 *
 * Authenticates as the function's own runtime service account via Application
 * Default Credentials — no key material is stored or passed in. That service
 * account is a Restricted (read-only) user on the Search Console property.
 * @return {Promise<GscRow[]>} Array of query rows.
 */
async function fetchGscRows() {
    var _a;
    const auth = new googleapis_1.google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const sc = googleapis_1.google.searchconsole({ version: "v1", auth });
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
 * Categorise GSC rows into keyword candidates, in priority order.
 * Quick Wins (position 5-40, impressions >= 2) come first, then Untapped
 * (impressions >= 2, clicks === 0). Each tier is sorted by impressions
 * descending and the merged list is deduped, keeping the earlier tier.
 * @param {GscRow[]} rows - GSC query rows.
 * @return {string[]} Candidate keywords, quick wins first.
 */
function categoriseKeywords(rows) {
    const quickWins = rows.filter((r) => r.position >= 5 && r.position <= 40 && r.impressions >= 2);
    const untapped = rows.filter((r) => r.impressions >= 2 && r.clicks === 0);
    // Sort each tier by impressions before merging. Sorting the merged list
    // instead would discard the tier split: untapped terms ranking 50th+ have
    // far more impressions than the quick wins, so they would crowd out every
    // keyword actually within reach.
    const byImpressions = (a, b) => b.impressions - a.impressions;
    const combined = [
        ...[...quickWins].sort(byImpressions),
        ...[...untapped].sort(byImpressions),
    ];
    // Dedup by query, keeping first occurrence — so a term appearing in both
    // tiers keeps its quick-win position.
    const seen = new Set();
    const deduped = [];
    for (const row of combined) {
        if (!seen.has(row.query)) {
            seen.add(row.query);
            deduped.push(row);
        }
    }
    return deduped.map((r) => r.query);
}
// ── Gemini retry ─────────────────────────────────────────────────────────────
/** Gemini returned a response we could not use — worth retrying. */
class MalformedGeminiResponse extends Error {
}
const GEMINI_ATTEMPTS = 3;
/**
 * Run a Gemini call, retrying when the response comes back unusable.
 *
 * Gemini intermittently returns text that stops mid-document while still
 * reporting finishReason STOP — roughly 1 call in 10 with search grounding
 * enabled. The output is not parseable and the whole run is lost, so retry
 * before giving up. Only malformed responses are retried; HTTP and auth
 * failures throw straight through, since repeating them cannot help.
 * @param {string} label - Call name, for logging.
 * @param {Function} attempt - The call to run.
 * @return {Promise<T>} The first successful result.
 */
async function withGeminiRetry(label, attempt) {
    let lastError;
    for (let i = 1; i <= GEMINI_ATTEMPTS; i++) {
        try {
            return await attempt();
        }
        catch (err) {
            if (!(err instanceof MalformedGeminiResponse))
                throw err;
            lastError = err;
            console.warn(`article-generator: ${label} attempt ${i}/${GEMINI_ATTEMPTS} ` +
                `unusable — ${err.message}`);
        }
    }
    throw lastError;
}
/**
 * Describe an unparseable Gemini response. The head of a truncated document
 * always looks well-formed, so report the tail and the length too.
 * @param {string} what - Which call produced it.
 * @param {string} rawText - The response text.
 * @param {string} finishReason - finishReason from the candidate.
 * @return {MalformedGeminiResponse} The error to throw.
 */
function malformed(what, rawText, finishReason) {
    return new MalformedGeminiResponse(`${what} was not valid JSON. len=${rawText.length} ` +
        `finishReason=${finishReason} ` +
        `head=${JSON.stringify(rawText.slice(0, 120))} ` +
        `tail=${JSON.stringify(rawText.slice(-120))}`);
}
/**
 * The pages and searches a grounded response was based on, so each article
 * records where its facts came from.
 * @param {GroundedCandidate} candidate - The Gemini candidate.
 * @return {Grounding} Its sources, without duplicates, and search queries.
 */
function groundingOf(candidate) {
    var _a, _b, _c, _d, _e;
    const meta = candidate === null || candidate === void 0 ? void 0 : candidate.groundingMetadata;
    const sources = new Map();
    for (const chunk of (_a = meta === null || meta === void 0 ? void 0 : meta.groundingChunks) !== null && _a !== void 0 ? _a : []) {
        const uri = (_b = chunk.web) === null || _b === void 0 ? void 0 : _b.uri;
        if (uri)
            sources.set(uri, { title: (_d = (_c = chunk.web) === null || _c === void 0 ? void 0 : _c.title) !== null && _d !== void 0 ? _d : "", uri });
    }
    return {
        sources: [...sources.values()],
        searchQueries: (_e = meta === null || meta === void 0 ? void 0 : meta.webSearchQueries) !== null && _e !== void 0 ? _e : [],
    };
}
// ── Gemini call ──────────────────────────────────────────────────────────────
// ── Shared article rules ─────────────────────────────────────────────────────
/* eslint-disable max-len */
/**
 * Writing rules every article prompt shares. Facts must come from the
 * search results so nothing is made up, and Gemini is shown the titles
 * already published so it doesn't repeat them.
 * @param {string[]} existingTitles - Titles of published articles.
 * @return {string} Prompt section listing the rules.
 */
function articleRules(existingTitles) {
    return `Requirements:
- Write in UK English for UK car owners: helpful, confident and plain-spoken
- 600–900 words of body content (not counting HTML markup), organised under clear <h2> headings
- Use proper HTML tags: <h2>, <p>, <ul>, <li>, <strong> etc. No images and no inline styles
- Only state facts, prices, dates and statistics you found in the search results. If you can't confirm something, leave it out
- Give the reader something useful: practical tips, real examples, or what the news means for plate owners
- No emojis in the body. At most one emoji, in the title
- When giving number plate examples, ONLY use realistic UK plate formats:
  - Current (2001–present): two letters, two digits, three letters — e.g. AB12 CDE
  - Prefix (1983–2001): one letter, one to three digits, three letters — e.g. A123 BCD
  - Suffix (1963–1983): three letters, one to three digits, one letter — e.g. ABC 123D
  - Dateless: any combination of 1–4 digits and 1–3 letters — e.g. 1 AB, 123 ABC
  - Never invent formats that don't match one of the above
- Include 2 internal links woven naturally into the content:
  1. One linking to / (e.g. <a href="/">get a free valuation</a>)
  2. One linking to /list-plate (e.g. <a href="/list-plate">list your plate for sale</a>)
- Do not add an author name, byline or sign-off — the site adds its own
- The content field must be a complete self-contained HTML article wrapped in <article> tags
- These titles are already published. Pick a different angle so the article is not a repeat of any of them:
${existingTitles.map((t) => `  - ${t}`).join("\n")}`;
}
/* eslint-enable max-len */
/** Honest byline added to every article in place of an invented author. */
const TEAM_BYLINE = "<p style=\"margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;" +
    "color:#6b7280;font-size:13px\">By the Mr Valuations team · " +
    "researched with AI and Google Search</p>";
/**
 * Append the team byline inside the closing </article> tag.
 * @param {string} html - Article HTML wrapped in <article> tags.
 * @return {string} The HTML with the byline added.
 */
function withByline(html) {
    return /<\/article>\s*$/i.test(html) ?
        html.replace(/<\/article>\s*$/i, `${TEAM_BYLINE}</article>`) :
        `${html}${TEAM_BYLINE}`;
}
/**
 * Titles of every published article, for the prompts' do-not-repeat list.
 * @return {Promise<string[]>} The titles.
 */
async function publishedTitles() {
    const snap = await admin.firestore().collection("articles")
        .select("title").get();
    return snap.docs.map((d) => { var _a; return String((_a = d.data().title) !== null && _a !== void 0 ? _a : ""); }).filter(Boolean);
}
/**
 * Call Gemini 2.5 Flash to generate a full SEO article for the given keyword.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {string} keyword - Target keyword.
 * @param {string[]} existingTitles - Titles already published.
 * @return {Promise<GeminiArticlePayload>} Parsed article payload from Gemini.
 */
async function callGeminiOnce(geminiApiKey, keyword, existingTitles) {
    var _a, _b, _c, _d, _e, _f, _g;
    /* eslint-disable max-len */
    const prompt = `Search the web for up-to-date, accurate information about: "${keyword}".

Then write an SEO blog article targeting that keyword for mrvaluations.co.uk — free number plate valuations and a marketplace to list plates for sale. Answer what someone searching "${keyword}" actually wants to know.

${articleRules(existingTitles)}

Respond ONLY with valid JSON in this exact shape (no markdown fences):
{
  "slug": "url-friendly-slug-matching-keyword",
  "title": "Clear, specific article title",
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
            tools: [{ google_search: {} }],
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
    // With grounding enabled, text may appear in any part
    const kParts = (_d = (_c = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _c === void 0 ? void 0 : _c.parts) !== null && _d !== void 0 ? _d : [];
    let rawText = (_e = kParts.find((p) => typeof p.text === "string" && p.text.trim() !== "")) === null || _e === void 0 ? void 0 : _e.text;
    if (typeof rawText !== "string" || rawText.trim() === "") {
        throw new MalformedGeminiResponse("article-generator: Gemini returned no usable text. " +
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
    catch (_h) {
        throw malformed("article-generator: Gemini response", rawText, String((_g = candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) !== null && _g !== void 0 ? _g : "unknown"));
    }
    const requiredKeys = ["slug", "title", "metaTitle", "metaDescription", "category", "content"];
    for (const key of requiredKeys) {
        if (!parsed[key]) {
            throw new MalformedGeminiResponse(`article-generator: Gemini payload missing field "${key}"`);
        }
    }
    const validCategories = ["valuations", "plates", "cars", "celebrities"];
    if (!validCategories.includes(parsed.category)) {
        throw new Error(`article-generator: unexpected category "${parsed.category}"`);
    }
    return Object.assign(Object.assign({}, parsed), { grounding: groundingOf(candidate) });
}
// ── Grounded Gemini call (news fallback) ─────────────────────────────────────
const GROUNDED_TOPICS = [
    {
        search: "latest UK private number plate auction results record prices",
        category: "plates",
    },
    {
        // eslint-disable-next-line max-len
        search: "trending personalised number plates UK most valuable registrations",
        category: "valuations",
    },
    {
        search: "latest UK car news new model launches registrations",
        category: "cars",
    },
];
/**
 * Call Gemini 2.5 Flash with Google Search grounding to write a news article
 * on one of the rotating fallback topics.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {number} topicIndex - Index into GROUNDED_TOPICS (cycles 0→1→2→0).
 * @param {string[]} existingTitles - Titles already published.
 * @return {Promise<GeminiArticlePayload>} Parsed article payload.
 */
async function callGeminiGroundedOnce(geminiApiKey, topicIndex, existingTitles) {
    var _a, _b, _c, _d, _e, _f;
    const idx = topicIndex % GROUNDED_TOPICS.length;
    const { category } = GROUNDED_TOPICS[idx];
    const search = `${GROUNDED_TOPICS[idx].search} ${new Date().getFullYear()}`;
    /* eslint-disable max-len */
    const prompt = `Search the web for the most recent and interesting news about: "${search}".

Write a news blog article about what you find for mrvaluations.co.uk — a UK site offering free number plate valuations and a marketplace to list plates for sale.

${articleRules(existingTitles)}
- The category for this article is: "${category}"

Respond ONLY with valid JSON in this exact shape (no markdown fences):
{
  "slug": "url-friendly-slug-based-on-topic",
  "title": "Clear, specific news title",
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
    const gParts = (_d = (_c = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _c === void 0 ? void 0 : _c.parts) !== null && _d !== void 0 ? _d : [];
    const gTextPart = gParts.find((p) => typeof p.text === "string" && p.text.trim() !== "");
    let rawText = gTextPart === null || gTextPart === void 0 ? void 0 : gTextPart.text;
    if (typeof rawText !== "string" || rawText.trim() === "") {
        throw new MalformedGeminiResponse("article-generator: Gemini grounded call returned no usable text. " +
            `finishReason=${(_e = candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) !== null && _e !== void 0 ? _e : "unknown"}`);
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
        throw malformed("article-generator: Gemini grounded response", rawText, String((_f = candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) !== null && _f !== void 0 ? _f : "unknown"));
    }
    // Force the category to match the topic we searched for
    parsed.category = category;
    return Object.assign(Object.assign({}, parsed), { grounding: groundingOf(candidate) });
}
// ── Celebrity Gemini call ─────────────────────────────────────────────────
/**
 * Call Gemini 2.5 Flash with Google Search grounding to find a trending
 * celebrity and write a fun personalised-plate article about them.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {string[]} existingTitles - Titles already published.
 * @return {Promise<GeminiCelebrityPayload>} Parsed celebrity article payload.
 */
async function callGeminiCelebrityOnce(geminiApiKey, existingTitles) {
    var _a, _b, _c, _d, _e, _f;
    /* eslint-disable max-len */
    const prompt = `Search the web for ONE specific UK or international celebrity or famous person who is trending in the news today or this week. Pick the most interesting one — footballers, musicians, actors, royals, TV personalities all work well. Only pick someone the search results show a specific news story about from the last 7 days, and open the article with that story. If you can't find one for a celebrity, pick someone else — never invent or assume news.

Write a fun, witty, light-hearted blog article for mrvaluations.co.uk about what personalised UK number plate that celebrity should have. The site offers free number plate valuations and a marketplace to list plates for sale.

Tone: like a celebrity gossip column meets car culture — playful and engaging, but every fact about the celebrity must come from the search results.

${articleRules(existingTitles)}
- Mention what cars the celebrity is known for driving (only if the search results say so), then pivot to plates
- Suggest exactly 4 personalised plate ideas for the celebrity — one in each UK format:
  - Current (2001–present): two letters + two digits + three letters — e.g. DB07 ECK (use initials + year + name-related letters)
  - Prefix (1983–2001): one letter + 1–3 digits + three letters — e.g. D1 VID or B3CKS
  - Suffix (1963–1983): three letters + 1–3 digits + one letter — e.g. DAV 1D or BEK 5S
  - Dateless: 1–4 digits + 1–3 letters OR 1–3 letters + 1–4 digits — e.g. DB 1 or 1 DB
- For each plate explain the connection to their name, nickname, or something they are famous for
- DO NOT include plate prices or valuations in the content — a section with real valuations will be added automatically

Respond ONLY with valid JSON (no markdown fences):
{
  "slug": "url-friendly-slug-celebrity-name-number-plate",
  "title": "Fun article title with the celebrity's name",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "Compelling meta description under 155 chars",
  "celebrity": "Full Celebrity Name",
  "suggestedPlates": ["AB12 CDE", "A123 BCD", "ABC 123D", "AB 1"],
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
        }, { headers: { "x-goog-api-key": geminiApiKey }, timeout: 240000 });
    }
    catch (axiosErr) {
        if (axios_1.default.isAxiosError(axiosErr) && axiosErr.response) {
            throw new Error(`Gemini celebrity API ${axiosErr.response.status}: ` +
                JSON.stringify(axiosErr.response.data));
        }
        throw axiosErr;
    }
    const candidate = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.candidates) === null || _b === void 0 ? void 0 : _b[0];
    const parts = (_d = (_c = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _c === void 0 ? void 0 : _c.parts) !== null && _d !== void 0 ? _d : [];
    console.log("celebrity candidate parts count:", parts.length, "finishReason:", candidate === null || candidate === void 0 ? void 0 : candidate.finishReason, "parts preview:", JSON.stringify(parts.map((p) => {
        var _a, _b;
        return ({
            hasText: typeof p.text === "string",
            len: (_b = (_a = p.text) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
        });
    })));
    // With grounding enabled, text may appear in any part — find the first one
    const textPart = parts.find((p) => typeof p.text === "string" && p.text.trim() !== "");
    let rawText = textPart === null || textPart === void 0 ? void 0 : textPart.text;
    if (typeof rawText !== "string" || rawText.trim() === "") {
        throw new MalformedGeminiResponse("article-generator: Gemini celebrity call returned no text. " +
            `finishReason=${(_e = candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) !== null && _e !== void 0 ? _e : "unknown"}, ` +
            `parts=${JSON.stringify(parts).slice(0, 300)}`);
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
        throw malformed("article-generator: celebrity response", rawText, String((_f = candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) !== null && _f !== void 0 ? _f : "unknown"));
    }
    const requiredKeys = ["slug", "title", "metaTitle", "metaDescription",
        "celebrity", "suggestedPlates", "content"];
    for (const key of requiredKeys) {
        if (!parsed[key]) {
            throw new MalformedGeminiResponse(`article-generator: celebrity payload missing field "${key}"`);
        }
    }
    // The article hangs on this week's news about them, so without search
    // results it would be made up. Retry rather than publish it.
    const grounding = groundingOf(candidate);
    if (!grounding.sources.length) {
        throw new MalformedGeminiResponse("article-generator: celebrity article had no Google Search sources " +
            `(celebrity "${parsed.celebrity}")`);
    }
    return Object.assign(Object.assign({}, parsed), { grounding });
}
/**
 * Build a styled HTML valuation section for the suggested celebrity plates.
 * @param {string[]} plates - Array of plate strings to valuate.
 * @return {string} HTML string for the valuation section.
 */
function buildValuationSection(plates) {
    const cards = plates.map((plate) => {
        const result = (0, valuation_js_1.valuatePlate)(plate);
        if (!result)
            return "";
        const fmt = (n) => `£${Math.round(n).toLocaleString("en-GB")}`;
        // eslint-disable-next-line max-len
        const divStyle = "border:1px solid #e5e7eb;border-radius:10px;padding:16px;background:#fff";
        return `
      <div style="${divStyle}">
        <p style="font-family:monospace;font-size:1.1rem;font-weight:700;
          letter-spacing:2px;margin:0 0 8px;color:#1f2937">${plate}</p>
        <p style="font-size:13px;color:#6b7280;margin:0 0 4px;
          text-transform:uppercase;letter-spacing:0.5px">${result.type}</p>
        <p style="margin:0;font-size:15px">
          <strong style="color:#1f2937">${fmt(result.midPrice)}</strong>
          <span style="color:#6b7280;font-size:13px">
            &nbsp;(${fmt(result.minPrice)} – ${fmt(result.maxPrice)})
          </span>
        </p>
      </div>`;
    }).filter(Boolean).join("");
    return `
    <div style="margin:32px 0">
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 16px;
        color:#1f2937">💰 Real-Time Plate Valuations</h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
        Curious what these plates are actually worth?
        Our valuation engine has the answer — instantly and for free.
      </p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);
        gap:12px">${cards}</div>
      <p style="font-size:13px;color:#6b7280;margin:16px 0 0">
        👉 Want to check a plate you own?
        <a href="/" style="color:#5c6bc0">Get your free valuation here</a>.
      </p>
    </div>`;
}
/**
 * Find a trending celebrity via Gemini Search grounding, generate a fun
 * personalised-plate article, inject real-time valuations, and store in
 * Firestore.
 * @param {string} geminiApiKey - Gemini API key.
 * @return {Promise<void>}
 */
async function runGenerateCelebrityArticle(geminiApiKey) {
    var _a, _b, _c, _d;
    const db = admin.firestore();
    console.log("article-generator (celebrity): calling Gemini...");
    const payload = await callGeminiCelebrity(geminiApiKey, await publishedTitles());
    console.log(`article-generator (celebrity): celebrity = "${payload.celebrity}", ` +
        `plates = ${JSON.stringify(payload.suggestedPlates)}`);
    // Inject valuation section before the closing </article> tag
    const valuationHtml = buildValuationSection(payload.suggestedPlates);
    const content = withByline(payload.content.replace(/<\/article>\s*$/i, `${valuationHtml}</article>`));
    const readTimeMinutes = calcReadTime(content);
    const articleData = {
        slug: payload.slug,
        title: payload.title,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        category: "celebrities",
        targetKeyword: `celebrity:${payload.celebrity}`,
        content,
        readTimeMinutes,
        publishedAt: admin.firestore.Timestamp.now(),
        sources: (_b = (_a = payload.grounding) === null || _a === void 0 ? void 0 : _a.sources) !== null && _b !== void 0 ? _b : [],
        searchQueries: (_d = (_c = payload.grounding) === null || _c === void 0 ? void 0 : _c.searchQueries) !== null && _d !== void 0 ? _d : [],
    };
    const docRef = await db.collection("articles").add(articleData);
    console.log(`article-generator (celebrity): article written — doc ID: ${docRef.id}`);
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
// ── Retrying wrappers ────────────────────────────────────────────────────────
/**
 * callGemini with retry on an unusable response.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {string} keyword - Target keyword.
 * @param {string[]} existingTitles - Titles already published.
 * @return {Promise<GeminiArticlePayload>} Parsed article payload.
 */
function callGemini(geminiApiKey, keyword, existingTitles) {
    return withGeminiRetry("callGemini", () => callGeminiOnce(geminiApiKey, keyword, existingTitles));
}
/**
 * callGeminiGrounded with retry on an unusable response.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {number} topicIndex - Index into GROUNDED_TOPICS.
 * @param {string[]} existingTitles - Titles already published.
 * @return {Promise<GeminiArticlePayload>} Parsed article payload.
 */
function callGeminiGrounded(geminiApiKey, topicIndex, existingTitles) {
    return withGeminiRetry("callGeminiGrounded", () => callGeminiGroundedOnce(geminiApiKey, topicIndex, existingTitles));
}
/**
 * callGeminiCelebrity with retry on an unusable response.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {string[]} existingTitles - Titles already published.
 * @return {Promise<GeminiCelebrityPayload>} Parsed celebrity payload.
 */
function callGeminiCelebrity(geminiApiKey, existingTitles) {
    return withGeminiRetry("callGeminiCelebrity", () => callGeminiCelebrityOnce(geminiApiKey, existingTitles));
}
// ── Main export ──────────────────────────────────────────────────────────────
/**
 * Pull keyword opportunities from Google Search Console, pick the best unused
 * one, call Gemini to write an SEO article, and store it in Firestore.
 * @param {string} geminiApiKey - Gemini API key.
 * @return {Promise<void>}
 */
async function runGenerateDailyArticle(geminiApiKey) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const db = admin.firestore();
    // 1. Fetch GSC data
    console.log("article-generator: fetching GSC data...");
    const gscRows = await fetchGscRows();
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
    const existingTitles = await publishedTitles();
    let targetKeyword = null;
    let payload;
    if (filtered.length > 0) {
        targetKeyword = filtered[0];
        console.log(`article-generator: selected keyword "${targetKeyword}"`);
        // 6a. GSC keyword path — call Gemini normally
        console.log("article-generator: calling Gemini (keyword)...");
        payload = await callGemini(geminiApiKey, targetKeyword, existingTitles);
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
        payload = await callGeminiGrounded(geminiApiKey, topicIndex, existingTitles);
        // Advance the topic index so next fallback uses a different topic
        await db.collection("meta").doc("groundedTopicIndex").set({ index: (topicIndex + 1) % GROUNDED_TOPICS.length });
    }
    console.log(`article-generator: Gemini response received — title: "${payload.title}"`);
    // 7. Add the byline and calculate read time
    const content = withByline(payload.content);
    const readTimeMinutes = calcReadTime(content);
    // 8. Write article to Firestore
    const articleData = {
        slug: payload.slug,
        title: payload.title,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        category: payload.category,
        targetKeyword: targetKeyword !== null && targetKeyword !== void 0 ? targetKeyword : `grounded:${payload.category}`,
        content,
        readTimeMinutes,
        publishedAt: admin.firestore.Timestamp.now(),
        sources: (_f = (_e = payload.grounding) === null || _e === void 0 ? void 0 : _e.sources) !== null && _f !== void 0 ? _f : [],
        searchQueries: (_h = (_g = payload.grounding) === null || _g === void 0 ? void 0 : _g.searchQueries) !== null && _h !== void 0 ? _h : [],
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