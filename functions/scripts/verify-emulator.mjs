/**
 * Run via: firebase emulators:exec --project demo-gwschedule \
 *            "node functions/scripts/verify-emulator.mjs"
 *
 * The emulators:exec wrapper starts the firestore + functions emulators,
 * runs this script, and then tears everything down.
 */

const PROJECT = "demo-gwschedule";
const REGION = "us-east4";
const FUNCTION_URL = `http://127.0.0.1:5001/${PROJECT}/${REGION}/scrapeEndpoints`;
const FIRESTORE_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

async function main() {
  console.log(`Calling ${FUNCTION_URL}...`);
  const start = Date.now();
  const res = await fetch(FUNCTION_URL);
  const body = await res.json();
  console.log(`Function returned in ${Date.now() - start}ms:`, body);

  if (!res.ok) throw new Error(`Function returned HTTP ${res.status}`);

  // Read back from Firestore emulator
  const termDoc = await fetch(`${FIRESTORE_BASE}/terms/202101`).then((r) => r.json());
  console.log("\nterms/202101 fields:", termDoc.fields ?? "(missing)");

  const sectionsList = await fetch(
    `${FIRESTORE_BASE}/terms/202101/sections?pageSize=3`,
  ).then((r) => r.json());

  const docs = sectionsList.documents ?? [];
  console.log(`\nterms/202101/sections — sampled ${docs.length}:`);
  for (const d of docs) {
    const name = d.name.split("/").pop();
    const courseName = d.fields?.name?.stringValue ?? "(no name)";
    console.log(`  ${name}: ${courseName}`);
  }

  if (docs.length === 0) {
    throw new Error("No sections written to Firestore emulator");
  }
  console.log("\nEmulator verification passed.");
}

main().catch((err) => {
  console.error("Emulator verification failed:", err);
  process.exit(1);
});
