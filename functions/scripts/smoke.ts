/**
 * Smoke test: runs scrapeSections against the live GW schedule page
 * and prints a summary. No Firebase involvement.
 *
 *   npm run smoke
 *   npm run smoke -- 1 202101 CSCI
 */
import { scrapeSections } from "../src/courseScraper";

async function main() {
  const [campId = "1", termId = "202101", subjId = "CSCI"] = process.argv.slice(2);

  console.log(`Scraping campId=${campId} termId=${termId} subjId=${subjId}...`);
  const start = Date.now();
  const sections = await scrapeSections(campId, termId, subjId);
  const elapsed = Date.now() - start;

  console.log(`\nFetched ${sections.length} sections in ${elapsed}ms`);

  if (sections.length === 0) {
    console.warn("No sections returned — GW may have changed the page format,");
    console.warn("or the term/department combo has no listings.");
    process.exit(1);
  }

  const departments = new Set(sections.map((s) => s.department));
  const withSchedule = sections.filter((s) => s.schedule.length > 0).length;
  const credits = new Set(sections.map((s) => s.credit));

  console.log("\nSummary:");
  console.log(`  Departments: ${[...departments].join(", ")}`);
  console.log(`  Sections with at least one meeting: ${withSchedule}/${sections.length}`);
  console.log(`  Distinct credit values: ${[...credits].slice(0, 8).join(", ")}`);

  console.log("\nFirst 3 sections:");
  console.log(JSON.stringify(sections.slice(0, 3), null, 2));
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
