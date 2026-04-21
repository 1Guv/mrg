"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processQueue = processQueue;
const googleapis_1 = require("googleapis");
const valuation_js_1 = require("./valuation.js");
/**
 * Format a price as £X,XXX.
 * @param {number} n - Price in pounds.
 * @return {string} Formatted price string.
 */
function fmt(n) {
    return "£" + Math.round(n).toLocaleString("en-GB");
}
/**
 * Format valuation range string for sheet / caption.
 * @param {number} min - Minimum price.
 * @param {number} max - Maximum price.
 * @return {string} Range string e.g. "£4,500 – £6,000".
 */
function fmtRange(min, max) {
    return `${fmt(min)} – ${fmt(max)}`;
}
/**
 * Build an authenticated Google Sheets client.
 * @param {string} clientEmail - Service account email.
 * @param {string} privateKey - Service account private key.
 * @return {Promise} Authenticated Sheets client.
 */
async function getSheetsClient(clientEmail, privateKey) {
    const auth = new googleapis_1.google.auth.JWT({
        email: clientEmail,
        key: privateKey.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return googleapis_1.google.sheets({ version: "v4", auth });
}
/**
 * Call the Buffer GraphQL API.
 * @param {string} token - Buffer API key (Bearer token).
 * @param {string} query - GraphQL query or mutation string.
 * @param {Record<string, unknown>} variables - Optional GraphQL variables.
 * @return {Promise<unknown>} Parsed JSON response.
 */
async function bufferGraphQL(token, query, variables) {
    const res = await fetch("https://api.buffer.com", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Buffer API error ${res.status}: ${body}`);
    }
    return res.json();
}
/**
 * Process all rows with status "pending" in the Google Sheet.
 * For each: valuate the plate, render a video, post to social media,
 * then mark the row as "done" (or "error" on failure).
 * @param {string} sheetsClientEmail - Service account email.
 * @param {string} sheetsPrivateKey - Service account private key.
 * @param {string} sheetsSheetId - Google Sheet ID.
 * @param {string} proxySecret - Cloudflare proxy shared secret.
 * @param {string} creatomateTemplateId - Creatomate template ID.
 * @param {string} bufferApiKey - Buffer access token.
 * @return {Promise<{processed: number}>} Count of successfully processed rows.
 */
async function processQueue(sheetsClientEmail, sheetsPrivateKey, sheetsSheetId, proxySecret, creatomateTemplateId, bufferApiKey) {
    var _a, _b, _c, _d, _e, _f;
    const sheets = await getSheetsClient(sheetsClientEmail, sheetsPrivateKey);
    const sheetId = sheetsSheetId;
    // ── Read video URLs from Videos sheet ──────────────────────────
    console.log("DEBUG: Reading Videos sheet...");
    const videosRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Videos!B2:B", // Column B = URLs, skip header
    });
    const videoUrls = ((_a = videosRes.data.values) !== null && _a !== void 0 ? _a : [])
        .map((row) => row[0])
        .filter(Boolean);
    console.log(`DEBUG: Found ${videoUrls.length} video URLs`);
    if (videoUrls.length < 2) {
        throw new Error("Need at least 2 video URLs in the Videos sheet");
    }
    // ── Read music URLs from Music sheet ───────────────────────────
    const musicRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Music!B2:B", // Column B = URLs, skip header
    });
    const musicUrls = ((_b = musicRes.data.values) !== null && _b !== void 0 ? _b : [])
        .map((row) => row[0])
        .filter(Boolean);
    if (musicUrls.length === 0) {
        throw new Error("Need at least 1 music URL in the Music sheet");
    }
    /**
     * Pick n random unique items from an array.
     * @param {string[]} arr - Source array to pick from.
     * @param {number} n - Number of items to pick.
     * @return {string[]} Array of n randomly selected unique items.
     */
    function pickRandom(arr, n) {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    }
    // ── Read pending rows from Sheet1 ──────────────────────────────
    console.log("DEBUG: Reading Sheet1...");
    const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Sheet1!A:G",
    });
    const rows = (_c = readRes.data.values) !== null && _c !== void 0 ? _c : [];
    console.log(`DEBUG: Total rows (inc header): ${rows.length}`);
    const dataRows = rows.slice(1);
    const pending = dataRows
        .map((row, i) => {
        var _a, _b, _c;
        return ({
            rowIndex: i + 2,
            plate: ((_a = row[0]) !== null && _a !== void 0 ? _a : ""),
            status: ((_b = row[1]) !== null && _b !== void 0 ? _b : ""),
            // Column G: optional scheduled datetime (ISO 8601)
            publishAt: ((_c = row[6]) !== null && _c !== void 0 ? _c : ""),
        });
    })
        .filter((r) => r.status.toLowerCase() === "pending");
    console.log(`DEBUG: Pending rows found: ${pending.length}`);
    if (pending.length === 0) {
        console.log("No pending plates found.");
        return { processed: 0 };
    }
    let processed = 0;
    for (const row of pending) {
        try {
            console.log(`Processing plate: ${row.plate}`);
            // 1. Valuate the plate
            const valuationResult = (0, valuation_js_1.valuatePlate)(row.plate);
            if (!valuationResult)
                throw new Error(`Unrecognised plate: ${row.plate}`);
            const { minPrice, maxPrice, midPrice } = valuationResult;
            const valuation = fmtRange(minPrice, maxPrice);
            // 2. Pick 2 random unique videos and 1 random music track
            const [videoTop, videoBottom] = pickRandom(videoUrls, 2);
            const [audioTrack] = pickRandom(musicUrls, 1);
            console.log("DEBUG: audio track selected:", audioTrack);
            // 3. Render video with Creatomate
            const proxyBase = "https://creatomate-proxy.guv-mr-valuations.workers.dev";
            const proxyHeaders = {
                "X-Proxy-Secret": proxySecret,
                "Content-Type": "application/json",
            };
            const renderFetchRes = await fetch(`${proxyBase}/renders`, {
                method: "POST",
                headers: proxyHeaders,
                body: JSON.stringify({
                    template_id: creatomateTemplateId,
                    modifications: {
                        plate_text: row.plate,
                        valuation: fmt(midPrice),
                        video_top: videoTop,
                        video_bottom: videoBottom,
                        audio_track: audioTrack,
                    },
                }),
            });
            if (!renderFetchRes.ok) {
                const errBody = await renderFetchRes.text();
                console.error("❌ Proxy /renders response:", errBody);
                throw new Error(`Creatomate render failed: ${renderFetchRes.status}`);
            }
            const renderData = await renderFetchRes.json();
            const renderId = renderData[0].id;
            console.log("DEBUG: render submitted, id:", renderId);
            // 4. Poll until render completes (max ~2 min, 5s intervals)
            let videoUrl = null;
            for (let i = 0; i < 24; i++) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                const statusFetchRes = await fetch(`${proxyBase}/renders/${renderId}`, { headers: proxyHeaders });
                const statusData = await statusFetchRes.json();
                console.log(`DEBUG: poll ${i + 1} status:`, statusData.status);
                if (statusData.status === "succeeded") {
                    videoUrl = statusData.url;
                    break;
                }
            }
            if (!videoUrl)
                throw new Error("Creatomate render timed out");
            console.log("DEBUG: render done, videoUrl:", videoUrl);
            // 5. Post to social media via Buffer GraphQL API
            const caption = `This plate — ${row.plate} — is valued at ` +
                `${fmt(midPrice)}! 🔥\n` +
                "Get your free valuation at mrvaluations.co.uk\n" +
                "#numberplate #privateplate #ukplates #platevaluation";
            // Get organization ID
            const orgData = await bufferGraphQL(bufferApiKey, "query { account { organizations { id name } } }");
            const orgId = (_d = orgData.data.account.organizations[0]) === null || _d === void 0 ? void 0 : _d.id;
            if (!orgId)
                throw new Error("No Buffer organization found");
            const channelsData = await bufferGraphQL(bufferApiKey, `query {
          channels(input: { organizationId: "${orgId}" }) { id name service }
        }`);
            const channels = channelsData.data.channels;
            console.log(`DEBUG: Buffer channels: ${channels.map((c) => c.service).join(", ")}`);
            if (channels.length === 0)
                throw new Error("No Buffer channels found");
            // Create a post on each channel
            const useScheduled = row.publishAt.trim().length > 0;
            for (const channel of channels) {
                const postInput = {
                    text: caption,
                    channelId: channel.id,
                    schedulingType: "automatic",
                    mode: useScheduled ? "customScheduled" : "addToQueue",
                    assets: { videos: [{ url: videoUrl }] },
                };
                if (useScheduled)
                    postInput.dueAt = row.publishAt.trim();
                if (channel.service === "instagram") {
                    postInput.metadata = {
                        instagram: { type: "reel", shouldShareToFeed: true },
                    };
                }
                if (channel.service === "facebook") {
                    postInput.metadata = { facebook: { type: "reel" } };
                }
                const postData = await bufferGraphQL(bufferApiKey, `mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess { post { id } }
              ... on MutationError { message }
            }
          }`, { input: postInput });
                const postResult = postData.data.createPost;
                if (postResult.message) {
                    console.error(`❌ Buffer error for ${channel.service}: ${postResult.message}`);
                }
                else {
                    console.log(`✅ Posted to ${channel.service}: ${(_e = postResult.post) === null || _e === void 0 ? void 0 : _e.id}`);
                }
            }
            // 6. Update sheet row → done
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `Sheet1!B${row.rowIndex}:J${row.rowIndex}`,
                valueInputOption: "RAW",
                requestBody: {
                    values: [[
                            "done",
                            fmt(midPrice),
                            caption,
                            videoUrl,
                            valuation,
                            row.publishAt,
                            audioTrack,
                            videoTop,
                            videoBottom,
                        ]],
                },
            });
            processed++;
            console.log(`✅ Done: ${row.plate} → ${valuation}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const axiosErr = err;
            if ((_f = axiosErr === null || axiosErr === void 0 ? void 0 : axiosErr.response) === null || _f === void 0 ? void 0 : _f.data) {
                console.error("❌ Creatomate response:", JSON.stringify(axiosErr.response.data));
            }
            console.error(`❌ Failed for plate ${row.plate}:`, msg);
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `Sheet1!B${row.rowIndex}`,
                valueInputOption: "RAW",
                requestBody: { values: [["error"]] },
            });
        }
    }
    return { processed };
}
//# sourceMappingURL=social-post.js.map