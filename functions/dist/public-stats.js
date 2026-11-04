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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRefreshPublicStats = runRefreshPublicStats;
const admin = __importStar(require("firebase-admin"));
/**
 * The real numbers shown in the trust strip on the site: plates for sale,
 * plates valued and members. Counted once a day into public_stats/summary,
 * which anyone can read, so pages never count collections themselves.
 */
const LISTING_COLLECTIONS = ["plate-listings-new", "plate-listings"];
/**
 * @param {admin.firestore.Query} query - The query to count.
 * @return {Promise<number>} How many documents match.
 */
async function count(query) {
    return (await query.count().get()).data().count;
}
/**
 * Counts the numbers and writes them to public_stats/summary.
 * @return {Promise<PublicStats>} What was written.
 */
async function runRefreshPublicStats() {
    const db = admin.firestore();
    // Unsold = all minus sold, so listings with no isSold field still count.
    const forSale = await Promise.all(LISTING_COLLECTIONS.map(async (c) => await count(db.collection(c)) -
        await count(db.collection(c).where("isSold", "==", true))));
    const stats = {
        platesForSale: forSale.reduce((a, b) => a + b, 0),
        platesValued: await count(db.collection("auto_valuations")),
        members: await count(db.collection("users")),
    };
    await db.collection("public_stats").doc("summary").set(Object.assign(Object.assign({}, stats), { updatedAt: admin.firestore.Timestamp.now() }));
    console.log(`public-stats: ${JSON.stringify(stats)}`);
    return stats;
}
//# sourceMappingURL=public-stats.js.map