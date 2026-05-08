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
  const prompt = `You are an expert SEO content writer for the UK number plate market. Write a complete, well-structured SEO blog article targeting the keyword: "${keyword}".

The article is for mrvaluations.co.uk — free number plate valuations and a marketplace to list plates for sale.

Requirements:
- Tone: helpful, authoritative, aimed at UK car owners
- At least 600 words of body content
- Use proper HTML tags: <h2>, <p>, <ul>, <li>, <strong> etc.
- Include at least 2 internal CTAs woven naturally into the content:
  1. One linking to / (e.g. <a href="/">get a free valuation</a>)
  2. One linking to /list-plate (e.g. <a href="/list-plate">list your plate for sale</a>)
- The content field must be a complete self-contained HTML article wrapped in <article> tags

Respond ONLY with valid JSON in this exact shape (no markdown fences):
{
  "slug": "url-friendly-slug-matching-keyword",
  "title": "Engaging Article Title",
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
  let filtered = candidates.filter((kw) => !usedSet.has(kw));

  // 5. Pick target keyword; if all used, reset and pick from full list
  let targetKeyword: string;
  if (filtered.length > 0) {
    targetKeyword = filtered[0];
  } else {
    console.log(
      "article-generator: all candidates used — resetting used keywords list"
    );
    await db.collection("meta").doc("usedKeywords").set({keywords: []});

    filtered = candidates.length > 0 ?
      candidates :
      gscRows.map((r) => r.query);

    if (filtered.length === 0) {
      throw new Error("article-generator: no keywords available from GSC");
    }
    targetKeyword = filtered[0];
  }

  console.log(`article-generator: selected keyword "${targetKeyword}"`);

  // 6. Call Gemini
  console.log("article-generator: calling Gemini...");
  const payload = await callGemini(geminiApiKey, targetKeyword);
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
    targetKeyword,
    content: payload.content,
    readTimeMinutes,
    publishedAt: admin.firestore.Timestamp.now(),
  };

  const docRef = await db.collection("articles").add(articleData);
  console.log(`article-generator: article written — doc ID: ${docRef.id}`);

  // 9. Upsert used keywords
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
}
