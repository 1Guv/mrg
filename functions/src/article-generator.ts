import {google} from "googleapis";
import axios from "axios";
import * as admin from "firebase-admin";

// ── Constants ────────────────────────────────────────────────────────────────

const GSC_SITE_URL = "https://mrvaluations.co.uk/";

// ── Types ────────────────────────────────────────────────────────────────────

type ArticleCategory = "valuations" | "plates" | "cars";

interface ArticleData {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: ArticleCategory;
  targetKeyword: string;
  content: string;
  readTimeMinutes: number;
  publishedAt: admin.firestore.Timestamp;
}

interface GeminiArticlePayload {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: ArticleCategory;
  content: string;
}

interface GscRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Format a Date as "YYYY-MM-DD".
 * @param {Date} d - The date to format.
 * @return {string} The formatted date string.
 */
function toYMD(d: Date): string {
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
async function fetchGscRows(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<GscRow[]> {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:3456"
  );
  oauth2Client.setCredentials({refresh_token: refreshToken});

  const sc = google.searchconsole({version: "v1", auth: oauth2Client});

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

  const rows = res.data.rows ?? [];
  return rows
    .filter((r) => r.keys && r.keys.length > 0)
    .map((r) => ({
      query: (r.keys as string[])[0],
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: r.position ?? 0,
    }));
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
function categoriseKeywords(rows: GscRow[]): string[] {
  const quickWins = rows.filter(
    (r) => r.position >= 5 && r.position <= 40 && r.impressions >= 2
  );
  const untapped = rows.filter(
    (r) => r.impressions >= 2 && r.clicks === 0
  );

  const combined = [...quickWins, ...untapped];

  // Dedup by query, keeping first occurrence
  const seen = new Set<string>();
  const deduped: GscRow[] = [];
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
async function callGemini(
  geminiApiKey: string,
  keyword: string
): Promise<GeminiArticlePayload> {
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

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-2.5-flash:generateContent";

  let response;
  try {
    response = await axios.post(
      url,
      {
        contents: [{parts: [{text: prompt}]}],
        generationConfig: {responseMimeType: "application/json"},
      },
      {headers: {"x-goog-api-key": geminiApiKey}, timeout: 240000}
    );
  } catch (axiosErr) {
    // Re-throw with the full response body so the caller can log it
    if (
      axios.isAxiosError(axiosErr) &&
      axiosErr.response
    ) {
      throw new Error(
        `Gemini API ${axiosErr.response.status}: ` +
        JSON.stringify(axiosErr.response.data)
      );
    }
    throw axiosErr;
  }

  const candidate = response.data?.candidates?.[0];
  let rawText = candidate?.content?.parts?.[0]?.text;
  if (typeof rawText !== "string" || rawText.trim() === "") {
    throw new Error(
      "article-generator: Gemini returned no usable text. " +
      `finishReason=${candidate?.finishReason ?? "unknown"}`
    );
  }

  // Strip markdown code fences if present
  if (rawText.trimStart().startsWith("```")) {
    rawText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
  }

  let parsed: GeminiArticlePayload;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      "article-generator: Gemini response was not valid JSON. " +
      `Preview: ${rawText.slice(0, 200)}`
    );
  }

  const requiredKeys: (keyof GeminiArticlePayload)[] =
    ["slug", "title", "metaTitle", "metaDescription", "category", "content"];
  for (const key of requiredKeys) {
    if (!parsed[key]) {
      throw new Error(
        `article-generator: Gemini payload missing field "${key}"`
      );
    }
  }

  const validCategories: ArticleCategory[] = ["valuations", "plates", "cars"];
  if (!validCategories.includes(parsed.category)) {
    throw new Error(
      `article-generator: unexpected category "${parsed.category}"`
    );
  }

  return parsed;
}

// ── Grounded Gemini call (news fallback) ─────────────────────────────────────

const GROUNDED_TOPICS = [
  {
    search: "latest UK private number plate auction results record prices 2025",
    category: "plates" as ArticleCategory,
  },
  {
    // eslint-disable-next-line max-len
    search: "trending personalised number plates UK most valuable registrations",
    category: "valuations" as ArticleCategory,
  },
  {
    search: "latest UK car news new model launches registrations 2025",
    category: "cars" as ArticleCategory,
  },
];

/**
 * Call Gemini 2.5 Flash with Google Search grounding to write a news article
 * on one of the rotating fallback topics.
 * @param {string} geminiApiKey - Gemini API key.
 * @param {number} topicIndex - Index into GROUNDED_TOPICS (cycles 0→1→2→0).
 * @return {Promise<GeminiArticlePayload>} Parsed article payload.
 */
async function callGeminiGrounded(
  geminiApiKey: string,
  topicIndex: number
): Promise<GeminiArticlePayload> {
  const idx = topicIndex % GROUNDED_TOPICS.length;
  const {search, category} = GROUNDED_TOPICS[idx];

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

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-2.5-flash:generateContent";

  let response;
  try {
    response = await axios.post(
      url,
      {
        contents: [{parts: [{text: prompt}]}],
        tools: [{google_search: {}}],
        generationConfig: {responseMimeType: "application/json"},
      },
      {headers: {"x-goog-api-key": geminiApiKey}, timeout: 240000}
    );
  } catch (axiosErr) {
    if (axios.isAxiosError(axiosErr) && axiosErr.response) {
      throw new Error(
        `Gemini grounded API ${axiosErr.response.status}: ` +
        JSON.stringify(axiosErr.response.data)
      );
    }
    throw axiosErr;
  }

  const candidate = response.data?.candidates?.[0];
  let rawText = candidate?.content?.parts?.[0]?.text;
  if (typeof rawText !== "string" || rawText.trim() === "") {
    throw new Error(
      "article-generator: Gemini grounded call returned no usable text. " +
      `finishReason=${candidate?.finishReason ?? "unknown"}`
    );
  }

  if (rawText.trimStart().startsWith("```")) {
    rawText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
  }

  let parsed: GeminiArticlePayload;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      "article-generator: Gemini grounded response was not valid JSON. " +
      `Preview: ${rawText.slice(0, 200)}`
    );
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
function calcReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const wordCount =
    text.trim().split(/\s+/).filter((w) => w.length > 0).length;
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
export async function runGenerateDailyArticle(
  geminiApiKey: string,
  gscRefreshToken: string,
  gscClientId: string,
  gscClientSecret: string
): Promise<void> {
  const db = admin.firestore();

  // 1. Fetch GSC data
  console.log("article-generator: fetching GSC data...");
  const gscRows = await fetchGscRows(
    gscClientId, gscClientSecret, gscRefreshToken
  );
  console.log(`article-generator: received ${gscRows.length} GSC rows`);

  // 2. Categorise into candidates
  const candidates = categoriseKeywords(gscRows);
  console.log(`article-generator: ${candidates.length} keyword candidates`);

  // 3. Check used keywords
  const usedDoc = await db.collection("meta").doc("usedKeywords").get();
  const usedKeywords: string[] = usedDoc.exists ?
    ((usedDoc.data()?.["keywords"] as string[]) ?? []) :
    [];

  // 4. Filter out already-used keywords
  const usedSet = new Set(usedKeywords);
  const filtered = candidates.filter((kw) => !usedSet.has(kw));

  // 5. Pick keyword or fall back to grounded news search
  let targetKeyword: string | null = null;
  let payload: GeminiArticlePayload;

  if (filtered.length > 0) {
    targetKeyword = filtered[0];
    console.log(`article-generator: selected keyword "${targetKeyword}"`);

    // 6a. GSC keyword path — call Gemini normally
    console.log("article-generator: calling Gemini (keyword)...");
    payload = await callGemini(geminiApiKey, targetKeyword);
  } else {
    // 6b. No unused keywords — use Gemini with Google Search grounding
    console.log(
      "article-generator: all GSC keywords used — " +
        "falling back to grounded news search"
    );
    const topicDoc = await db
      .collection("meta").doc("groundedTopicIndex").get();
    const topicIndex: number = topicDoc.exists ?
      ((topicDoc.data()?.["index"] as number) ?? 0) :
      0;

    console.log(
      `article-generator: grounded topic index ${topicIndex}`
    );
    payload = await callGeminiGrounded(geminiApiKey, topicIndex);

    // Advance the topic index so next fallback uses a different topic
    await db.collection("meta").doc("groundedTopicIndex").set(
      {index: (topicIndex + 1) % GROUNDED_TOPICS.length}
    );
  }

  console.log(
    `article-generator: Gemini response received — title: "${payload.title}"`
  );

  // 7. Calculate read time
  const readTimeMinutes = calcReadTime(payload.content);

  // 8. Write article to Firestore
  const articleData: ArticleData = {
    slug: payload.slug,
    title: payload.title,
    metaTitle: payload.metaTitle,
    metaDescription: payload.metaDescription,
    category: payload.category,
    targetKeyword: targetKeyword ?? `grounded:${payload.category}`,
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
      .set(
        {keywords: admin.firestore.FieldValue.arrayUnion(targetKeyword)},
        {merge: true}
      );
    console.log(
      `article-generator: done — keyword "${targetKeyword}" marked as used`
    );
  } else {
    console.log(
      "article-generator: done — grounded news article, no keyword to mark"
    );
  }
}
