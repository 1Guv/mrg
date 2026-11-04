import * as admin from "firebase-admin";

/**
 * The real numbers shown in the trust strip on the site: plates for sale,
 * plates valued and members. Counted once a day into public_stats/summary,
 * which anyone can read, so pages never count collections themselves.
 */

const LISTING_COLLECTIONS = ["plate-listings-new", "plate-listings"];

export interface PublicStats {
  platesForSale: number;
  platesValued: number;
  members: number;
}

/**
 * @param {admin.firestore.Query} query - The query to count.
 * @return {Promise<number>} How many documents match.
 */
async function count(query: admin.firestore.Query): Promise<number> {
  return (await query.count().get()).data().count;
}

/**
 * Counts the numbers and writes them to public_stats/summary.
 * @return {Promise<PublicStats>} What was written.
 */
export async function runRefreshPublicStats(): Promise<PublicStats> {
  const db = admin.firestore();
  // Unsold = all minus sold, so listings with no isSold field still count.
  const forSale = await Promise.all(LISTING_COLLECTIONS.map(async (c) =>
    await count(db.collection(c)) -
    await count(db.collection(c).where("isSold", "==", true))));
  const stats: PublicStats = {
    platesForSale: forSale.reduce((a, b) => a + b, 0),
    platesValued: await count(db.collection("auto_valuations")),
    members: await count(db.collection("users")),
  };
  await db.collection("public_stats").doc("summary").set({
    ...stats,
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log(`public-stats: ${JSON.stringify(stats)}`);
  return stats;
}
