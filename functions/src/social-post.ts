import {SecretParam} from "firebase-functions/params";
import {google} from "googleapis";
import axios from "axios";

/** Shape of the valuePlate API response. */
interface ValuationResponse {
  plate: string;
  type: string;
  midPrice: number;
  minPrice: number;
  maxPrice: number;
}

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
 * Process all rows with status "pending" in the Google Sheet.
 * For each: valuate the plate, render a video, post to social media,
 * then mark the row as "done" (or "error" on failure).
 * @param {SecretParam} sheetsClientEmail - Secret: service account email.
 * @param {SecretParam} sheetsPrivateKey - Secret: service account private key.
 * @param {SecretParam} sheetsSheetId - Secret: Google Sheet ID.
 * @param {SecretParam} valuationKey - Secret: valuePlate API key.
 * @param {SecretParam} creatomateApiKey - Secret: Creatomate API key.
 * @param {SecretParam} creatomateTemplateId - Secret: Creatomate template ID.
 * @param {SecretParam} publerApiKey - Secret: Publer API key.
 * @param {SecretParam} publerProfileIds - Secret: comma-separated profile IDs.
 * @return {Promise<{processed: number}>} Count of successfully processed rows.
 */
export async function processQueue(
  sheetsClientEmail: SecretParam,
  sheetsPrivateKey: SecretParam,
  sheetsSheetId: SecretParam,
  valuationKey: SecretParam,
  creatomateApiKey: SecretParam,
  creatomateTemplateId: SecretParam,
  publerApiKey: SecretParam,
  publerProfileIds: SecretParam
): Promise<{processed: number}> {
  const sheets = await getSheetsClient(
    sheetsClientEmail.value(),
    sheetsPrivateKey.value()
  );
  const sheetId = sheetsSheetId.value();

  // Read all rows from the sheet
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:F",
  });

  const rows = readRes.data.values ?? [];
  const dataRows = rows.slice(1); // skip header row

  // Filter to pending rows only
  const pending = dataRows
    .map((row, i) => ({
      rowIndex: i + 2, // 1-based, +1 for header
      plate: (row[0] ?? "") as string,
      status: (row[1] ?? "") as string,
    }))
    .filter((r) => r.status.toLowerCase() === "pending");

  if (pending.length === 0) {
    console.log("No pending plates found.");
    return {processed: 0};
  }

  let processed = 0;

  for (const row of pending) {
    try {
      console.log(`Processing plate: ${row.plate}`);

      // 1. Valuate the plate
      const valuationRes = await axios.get<ValuationResponse>(
        "https://us-central1-code-g-b8b6f.cloudfunctions.net/valuePlate",
        {params: {plate: row.plate, key: valuationKey.value()}}
      );
      const {minPrice, maxPrice, midPrice} = valuationRes.data;
      const valuation = fmtRange(minPrice, maxPrice);

      // 2. Render video with Creatomate
      const renderRes = await axios.post<Array<{id: string}>>(
        "https://api.creatomate.com/v1/renders",
        {
          template_id: creatomateTemplateId.value(),
          modifications: {
            plate_text: row.plate,
            valuation: valuation,
            mid_price: fmt(midPrice),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${creatomateApiKey.value()}`,
          },
        }
      );
      const renderId = renderRes.data[0].id;

      // 3. Poll until render completes (max ~2 min, 5s intervals)
      let videoUrl: string | null = null;
      for (let i = 0; i < 24; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusRes = await axios.get<{
          status: string;
          url: string;
        }>(
          `https://api.creatomate.com/v1/renders/${renderId}`,
          {
            headers: {
              Authorization: `Bearer ${creatomateApiKey.value()}`,
            },
          }
        );
        if (statusRes.data.status === "succeeded") {
          videoUrl = statusRes.data.url;
          break;
        }
      }
      if (!videoUrl) throw new Error("Creatomate render timed out");

      // 4. Post to social media via Publer
      const caption =
        `This plate — ${row.plate} — is valued at ` +
        `${valuation}! 🔥\n` +
        "Get your free valuation at mrvaluations.co.uk\n" +
        "#numberplate #privateplate #ukplates #platevaluation";

      const profileIds = publerProfileIds.value().split(",");
      await axios.post(
        "https://api.publer.io/v1/posts",
        {
          profile_ids: profileIds,
          text: caption,
          media_urls: [videoUrl],
          schedule_date: "now",
        },
        {
          headers: {Authorization: `Bearer ${publerApiKey.value()}`},
        }
      );

      // 5. Update sheet row → done
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Sheet1!B${row.rowIndex}:E${row.rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["done", valuation, videoUrl, caption]],
        },
      });

      processed++;
      console.log(`✅ Done: ${row.plate} → ${valuation}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed for plate ${row.plate}:`, msg);

      // Mark as error so it doesn't retry forever
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
