import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { scrapeSections } from "./courseScraper";

initializeApp();

// Firestore batch limit is 500 operations
const FIRESTORE_BATCH_LIMIT = 500;

// Campus IDs:
// 1 = Main Campus
// 2 = Virginia Science & Technology (No SEAS)
// 3 = Off Campus
// 4 = Mount Vernon Campus (No SEAS)
// 6 = CCAS Dean's Seminars (No SEAS)
// 7 = Online Courses
// 8 = Corcoran School of the Arts and Design (No SEAS)
const CAMPUSES = ["1"] as const;
const DEPARTMENTS = ["CSCI"] as const;
// Year + 1-digit term ID (1 = spring, 2 = summer, 3 = fall)
// GW approximate schedule: Spring = Jan–May, Summer = Jun–Jul, Fall = Aug–Dec
function currentTermId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const term = month <= 5 ? 1 : month <= 7 ? 2 : 3;
  return `${year}0${term}`;
}

const TERMS = [currentTermId()];

export const scrapeEndpoints = onSchedule(
  { schedule: "every 24 hours", region: "us-east4", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const db = getFirestore();
    let total = 0;

    for (const term of TERMS) {
      await db.collection("terms").doc(term).set({ term });

      for (const campus of CAMPUSES) {
        for (const department of DEPARTMENTS) {
          const sections = await scrapeSections(campus, term, department);
          const termRef = db.collection("terms").doc(term);

          for (let i = 0; i < sections.length; i += FIRESTORE_BATCH_LIMIT) {
            const batch = db.batch();
            for (const section of sections.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
              const ref = termRef
                .collection("sections")
                .doc(`${section.department}-${section.courseID}-${section.section}`);
              batch.set(ref, section);
            }
            await batch.commit();
          }

          total += sections.length;
        }
      }
    }

    console.log(`Scraped semester: ${total} sections added.`);
  },
);
