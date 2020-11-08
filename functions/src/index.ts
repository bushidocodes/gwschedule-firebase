import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { scrapeSections } from "./courseScraper";

admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const scrapeEndpoints = functions
  .region("us-east4")
  .https.onRequest(async (req, res) => {
    const db = admin.firestore();

    //   const departments = ["bme", "ce", "csci", "ece", "emse", "mae"];
    const departments = ["csci"];

    // 1 = Main Campus
    // 2 = Virginia Science & Technology (No SEAS)
    // 3 = Off Campus
    // 4 = Mount Vernon Campus (No SEAS)
    // 5 = Not Used
    // 6 = CCAS Dean's Seminars (No SEAS)
    // 7 = Online Courses
    // 8 = Corcoran School of the Arts and Design (No SEAS)
    //   const campuses = ["1", "3", "7"];
    const campuses = ["1"];
    let total = 0;

    // Year + 1 digit term ID (1 = spring, 2 = summer, 3 = fall)
    const terms: string[] = ["202101"];

    for (let term of terms) {
      await db.collection("terms").doc(term).set({ term });

      for (let campus of campuses) {
        for (let department of departments) {
          let sections = await scrapeSections(campus, term, department);
          for (let section of sections) {
            const docRef = db
              .collection("terms")
              .doc(term)
              .collection("sections")
              .doc(
                `${section.department}-${section.courseID}-${section.section}`
              );

            await docRef.set(section);
            total += sections.length;
          }
        }
      }
    }

    res.json({
      result: `Scraped Semester: ${total} sections added.`,
    });
  });
