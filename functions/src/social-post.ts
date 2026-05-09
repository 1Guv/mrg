import {google} from "googleapis";
import {valuatePlate} from "./valuation.js";

/**
 * Format a price as £X,XXX.
 * @param {number} n - Price in pounds.
 * @return {string} Formatted price string.
 */
function fmt(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

/**
 * Format valuation range string for sheet / caption.
 * @param {number} min - Minimum price.
 * @param {number} max - Maximum price.
 * @return {string} Range string e.g. "£4,500 – £6,000".
 */
function fmtRange(min: number, max: number): string {
  return `${fmt(min)} – ${fmt(max)}`;
}

/**
 * Build an authenticated Google Sheets client.
 * @param {string} clientEmail - Service account email.
 * @param {string} privateKey - Service account private key.
 * @return {Promise} Authenticated Sheets client.
 */
async function getSheetsClient(
  clientEmail: string,
  privateKey: string
) {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({version: "v4", auth});
}

/**
 * Call the Buffer GraphQL API.
 * @param {string} token - Buffer API key (Bearer token).
 * @param {string} query - GraphQL query or mutation string.
 * @param {Record<string, unknown>} variables - Optional GraphQL variables.
 * @return {Promise<unknown>} Parsed JSON response.
 */
async function bufferGraphQL(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({query, variables}),
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
export async function processQueue(
  sheetsClientEmail: string,
  sheetsPrivateKey: string,
  sheetsSheetId: string,
  proxySecret: string,
  creatomateTemplateId: string,
  bufferApiKey: string
): Promise<{processed: number}> {
  const sheets = await getSheetsClient(sheetsClientEmail, sheetsPrivateKey);
  const sheetId = sheetsSheetId;

  // ── Read video URLs from Videos sheet ──────────────────────────
  console.log("DEBUG: Reading Videos sheet...");
  const videosRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Videos!B2:B", // Column B = URLs, skip header
  });
  const videoUrls = (videosRes.data.values ?? [])
    .map((row) => row[0] as string)
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
  const musicUrls = (musicRes.data.values ?? [])
    .map((row) => row[0] as string)
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
  function pickRandom(arr: string[], n: number): string[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  // ── Read pending rows from Sheet1 ──────────────────────────────
  console.log("DEBUG: Reading Sheet1...");
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:G",
  });

  const rows = readRes.data.values ?? [];
  console.log(`DEBUG: Total rows (inc header): ${rows.length}`);
  const dataRows = rows.slice(1);

  const pending = dataRows
    .map((row, i) => ({
      rowIndex: i + 2,
      plate: (row[0] ?? "") as string,
      status: (row[1] ?? "") as string,
      // Column G: optional scheduled datetime (ISO 8601)
      publishAt: (row[6] ?? "") as string,
    }))
    .filter((r) => r.status.toLowerCase() === "pending");

  console.log(`DEBUG: Pending rows found: ${pending.length}`);

  if (pending.length === 0) {
    console.log("No pending plates found.");
    return {processed: 0};
  }

  let processed = 0;

  for (const row of pending) {
    try {
      console.log(`Processing plate: ${row.plate}`);

      // 1. Valuate the plate
      const valuationResult = valuatePlate(row.plate);
      if (!valuationResult) throw new Error(`Unrecognised plate: ${row.plate}`);
      const {minPrice, maxPrice, midPrice} = valuationResult;
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
      const renderFetchRes = await fetch(
        `${proxyBase}/renders`,
        {
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
        }
      );
      if (!renderFetchRes.ok) {
        const errBody = await renderFetchRes.text();
        console.error("❌ Proxy /renders response:", errBody);
        throw new Error(
          `Creatomate render failed: ${renderFetchRes.status}`
        );
      }
      const renderData = await renderFetchRes.json() as Array<{id: string}>;
      const renderId = renderData[0].id;
      console.log("DEBUG: render submitted, id:", renderId);

      // 4. Poll until render completes (max ~2 min, 5s intervals)
      let videoUrl: string | null = null;
      for (let i = 0; i < 24; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusFetchRes = await fetch(
          `${proxyBase}/renders/${renderId}`,
          {headers: proxyHeaders}
        );
        const statusData = await statusFetchRes.json() as {
          status: string; url: string; error_message?: string;
        };
        console.log(
          `DEBUG: poll ${i + 1} status: ${statusData.status}` +
          (statusData.error_message ?
            ` — ${statusData.error_message}` : "")
        );
        if (statusData.status === "succeeded") {
          videoUrl = statusData.url;
          break;
        }
        if (statusData.status === "failed") break;
      }
      if (!videoUrl) throw new Error("Creatomate render failed");
      console.log("DEBUG: render done, videoUrl:", videoUrl);

      // 5. Post to social media via Buffer GraphQL API
      const caption =
        `This plate — ${row.plate} — is valued at ` +
        `${fmt(midPrice)}! 🔥\n` +
        "Get your free valuation at mrvaluations.co.uk\n" +
        "#numberplate #privateplate #ukplates #platevaluation";

      // Get organization ID
      const orgData = await bufferGraphQL(
        bufferApiKey,
        "query { account { organizations { id name } } }"
      ) as {
        data: {account: {organizations: Array<{id: string; name: string}>}};
      };
      const orgId = orgData.data.account.organizations[0]?.id;
      if (!orgId) throw new Error("No Buffer organization found");

      // Get all connected channels
      type BufChannel = {id: string; name: string; service: string};
      const channelsData = await bufferGraphQL(
        bufferApiKey,
        `query {
          channels(input: { organizationId: "${orgId}" }) { id name service }
        }`
      ) as {data: {channels: BufChannel[]}};

      const channels = channelsData.data.channels;
      console.log(
        `DEBUG: Buffer channels: ${channels.map((c) => c.service).join(", ")}`
      );
      if (channels.length === 0) throw new Error("No Buffer channels found");

      // Create a post on each channel
      const useScheduled = row.publishAt.trim().length > 0;
      for (const channel of channels) {
        type PostInput = {
          text: string;
          channelId: string;
          schedulingType: string;
          mode: string;
          dueAt?: string;
          assets: {videos: Array<{url: string}>};
          metadata?: {
            instagram?: {type: string; shouldShareToFeed: boolean};
            facebook?: {type: string};
          };
        };
        const postInput: PostInput = {
          text: caption,
          channelId: channel.id,
          schedulingType: "automatic",
          mode: useScheduled ? "customScheduled" : "addToQueue",
          assets: {videos: [{url: videoUrl}]},
        };
        if (useScheduled) postInput.dueAt = row.publishAt.trim();
        if (channel.service === "instagram") {
          postInput.metadata = {
            instagram: {type: "reel", shouldShareToFeed: true},
          };
        }
        if (channel.service === "facebook") {
          postInput.metadata = {facebook: {type: "reel"}};
        }

        const postData = await bufferGraphQL(
          bufferApiKey,
          `mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess { post { id } }
              ... on MutationError { message }
            }
          }`,
          {input: postInput}
        ) as {data: {createPost: {post?: {id: string}; message?: string}}};

        const postResult = postData.data.createPost;
        if (postResult.message) {
          console.error(
            `❌ Buffer error for ${channel.service}: ${postResult.message}`
          );
        } else {
          console.log(
            `✅ Posted to ${channel.service}: ${postResult.post?.id}`
          );
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const axiosErr = err as {response?: {data?: unknown}};
      if (axiosErr?.response?.data) {
        console.error(
          "❌ Creatomate response:",
          JSON.stringify(axiosErr.response.data)
        );
      }
      console.error(`❌ Failed for plate ${row.plate}:`, msg);

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Sheet1!B${row.rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {values: [["error"]]},
      });
    }
  }

  return {processed};
}

/**
 * Process all rows with status "pending" using the Full Videos sheet tab.
 * For each: valuate the plate, render a full-screen video, post to social
 * media, then mark the row as "done" (or "error" on failure).
 * @param {string} sheetsClientEmail - Service account email.
 * @param {string} sheetsPrivateKey - Service account private key.
 * @param {string} sheetsSheetId - Google Sheet ID.
 * @param {string} proxySecret - Cloudflare proxy shared secret.
 * @param {string} fullVideoTemplateId - Creatomate full-video template ID.
 * @param {string} bufferApiKey - Buffer access token.
 * @return {Promise<{processed: number}>} Count of processed rows.
 */
export async function processQueueFullVideos(
  sheetsClientEmail: string,
  sheetsPrivateKey: string,
  sheetsSheetId: string,
  proxySecret: string,
  fullVideoTemplateId: string,
  bufferApiKey: string
): Promise<{processed: number}> {
  const sheets = await getSheetsClient(sheetsClientEmail, sheetsPrivateKey);
  const sheetId = sheetsSheetId;

  /**
   * Convert a Google Drive sharing URL to a direct download URL.
   * Non-Drive URLs are returned unchanged.
   * @param {string} url - Input URL.
   * @return {string} Direct download URL.
   */
  function toDriveDirectUrl(url: string): string {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return url;
  }

  // ── Read video URLs from Full Videos sheet ─────────────────────
  console.log("DEBUG: Reading Full Videos sheet...");
  const videosRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Full Videos!B2:B", // Column B = URLs, skip header
  });
  const videoUrls = (videosRes.data.values ?? [])
    .map((row) => toDriveDirectUrl((row[0] ?? "") as string))
    .filter(Boolean);

  console.log(`DEBUG: Found ${videoUrls.length} full video URLs`);
  videoUrls.forEach((u, i) =>
    console.log(`DEBUG: video[${i}]: ${u}`)
  );

  if (videoUrls.length < 1) {
    throw new Error(
      "Need at least 1 video URL in the Full Videos sheet"
    );
  }

  // Shuffle video URLs once so each plate gets a unique video
  const shuffledVideos =
    [...videoUrls].sort(() => Math.random() - 0.5);
  console.log("DEBUG: shuffled order:",
    shuffledVideos.map((u) => u.split("/").pop()?.split("?")[0]).join(", ")
  );
  let videoIndex = 0;

  // ── Read pending rows from Sheet1 ──────────────────────────────
  console.log("DEBUG: Reading Sheet1...");
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:G",
  });

  const rows = readRes.data.values ?? [];
  console.log(`DEBUG: Total rows (inc header): ${rows.length}`);
  const dataRows = rows.slice(1);

  const uniqueStatuses = [
    ...new Set(dataRows.map((r) => JSON.stringify(r[1] ?? ""))),
  ];
  console.log(`DEBUG: Unique status values: ${uniqueStatuses.join(", ")}`);

  const pending = dataRows
    .map((row, i) => ({
      rowIndex: i + 2,
      plate: (row[0] ?? "") as string,
      status: (row[1] ?? "") as string,
      // Column G: optional scheduled datetime (ISO 8601)
      publishAt: (row[6] ?? "") as string,
    }))
    .filter((r) => r.status.toLowerCase().trim() === "pending");

  console.log(`DEBUG: Pending rows found: ${pending.length}`);

  if (pending.length === 0) {
    console.log("No pending plates found.");
    return {processed: 0};
  }

  let processed = 0;

  for (const row of pending) {
    try {
      console.log(`Processing plate: ${row.plate}`);

      // 1. Valuate the plate
      const valuationResult = valuatePlate(row.plate);
      if (!valuationResult) {
        throw new Error(`Unrecognised plate: ${row.plate}`);
      }
      const {minPrice, maxPrice, midPrice} = valuationResult;
      const valuation = fmtRange(minPrice, maxPrice);

      // 2. Pick next unique full video from pre-shuffled list
      const fullVideo =
        shuffledVideos[videoIndex % shuffledVideos.length];
      videoIndex++;
      console.log("DEBUG: full video selected:", fullVideo);

      // 3. Render video with Creatomate
      const proxyBase =
        "https://creatomate-proxy.guv-mr-valuations.workers.dev";
      const proxyHeaders = {
        "X-Proxy-Secret": proxySecret,
        "Content-Type": "application/json",
      };
      const renderFetchRes = await fetch(
        `${proxyBase}/renders`,
        {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify({
            template_id: fullVideoTemplateId,
            modifications: {
              plate_text: row.plate,
              valuation: fmt(midPrice),
              video_full: fullVideo,
              audio_track: "",
            },
          }),
        }
      );
      if (!renderFetchRes.ok) {
        const errBody = await renderFetchRes.text();
        console.error("❌ Proxy /renders response:", errBody);
        throw new Error(
          `Creatomate render failed: ${renderFetchRes.status}`
        );
      }
      const renderData =
        await renderFetchRes.json() as Array<{id: string}>;
      const renderId = renderData[0].id;
      console.log("DEBUG: render submitted, id:", renderId);

      // 4. Poll until render completes (max ~2 min, 5s intervals)
      let videoUrl: string | null = null;
      for (let i = 0; i < 24; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusFetchRes = await fetch(
          `${proxyBase}/renders/${renderId}`,
          {headers: proxyHeaders}
        );
        const statusData = await statusFetchRes.json() as {
          status: string; url: string; error_message?: string;
        };
        console.log(
          `DEBUG: poll ${i + 1} status: ${statusData.status}` +
          (statusData.error_message ?
            ` — ${statusData.error_message}` : "")
        );
        if (statusData.status === "succeeded") {
          videoUrl = statusData.url;
          break;
        }
        if (statusData.status === "failed") break;
      }
      if (!videoUrl) throw new Error("Creatomate render failed");
      console.log("DEBUG: render done, videoUrl:", videoUrl);

      // 5. Post to social media via Buffer GraphQL API
      const caption =
        "🔥 " + row.plate + " — valued at " + fmt(midPrice) + ". " +
        "Find out what YOUR plate is worth for FREE 👇\n" +
        "mrvaluations.co.uk\n" +
        "#privateplate #numberplate #ukplates #registration";

      // Get organization ID
      const orgData = await bufferGraphQL(
        bufferApiKey,
        "query { account { organizations { id name } } }"
      ) as {
        data: {
          account: {organizations: Array<{id: string; name: string}>};
        };
      };
      const orgId = orgData.data.account.organizations[0]?.id;
      if (!orgId) throw new Error("No Buffer organization found");

      // Get all connected channels
      type BufChannel = {id: string; name: string; service: string};
      const channelsData = await bufferGraphQL(
        bufferApiKey,
        `query {
          channels(input: { organizationId: "${orgId}" }) {
            id name service
          }
        }`
      ) as {data: {channels: BufChannel[]}};

      const channels = channelsData.data.channels;
      console.log(
        `DEBUG: Buffer channels: ${channels.map((c) => c.service).join(", ")}`
      );
      if (channels.length === 0) {
        throw new Error("No Buffer channels found");
      }

      // Create a post on each channel
      const useScheduled = row.publishAt.trim().length > 0;
      for (const channel of channels) {
        type PostInput = {
          text: string;
          channelId: string;
          schedulingType: string;
          mode: string;
          dueAt?: string;
          assets: {videos: Array<{url: string}>};
          metadata?: {
            instagram?: {type: string; shouldShareToFeed: boolean};
            facebook?: {type: string};
          };
        };
        const postInput: PostInput = {
          text: caption,
          channelId: channel.id,
          schedulingType: "automatic",
          mode: useScheduled ? "customScheduled" : "addToQueue",
          assets: {videos: [{url: videoUrl}]},
        };
        if (useScheduled) postInput.dueAt = row.publishAt.trim();
        if (channel.service === "instagram") {
          postInput.metadata = {
            instagram: {type: "reel", shouldShareToFeed: true},
          };
        }
        if (channel.service === "facebook") {
          postInput.metadata = {facebook: {type: "reel"}};
        }

        const postData = await bufferGraphQL(
          bufferApiKey,
          `mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess { post { id } }
              ... on MutationError { message }
            }
          }`,
          {input: postInput}
        ) as {
          data: {createPost: {post?: {id: string}; message?: string}};
        };

        const postResult = postData.data.createPost;
        if (postResult.message) {
          console.error(
            `❌ Buffer error for ${channel.service}: ${postResult.message}`
          );
        } else {
          console.log(
            `✅ Posted to ${channel.service}: ${postResult.post?.id}`
          );
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
            "",
            fullVideo,
            "",
          ]],
        },
      });

      processed++;
      console.log(`✅ Done: ${row.plate} → ${valuation}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const axiosErr = err as {response?: {data?: unknown}};
      if (axiosErr?.response?.data) {
        console.error(
          "❌ Creatomate response:",
          JSON.stringify(axiosErr.response.data)
        );
      }
      console.error(`❌ Failed for plate ${row.plate}:`, msg);

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Sheet1!B${row.rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {values: [["error"]]},
      });
    }
  }

  return {processed};
}
