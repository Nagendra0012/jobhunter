// Prints jobs already in the app ("company | title"), so the daily task can skip
// fetching full details for postings it already has.
//   npm run known-jobs
import { db } from "../src/lib/db";

const rows = db()
  .prepare("SELECT company, title FROM jobs WHERE active = 1 ORDER BY company, title")
  .all() as { company: string; title: string }[];
for (const r of rows) console.log(`${r.company} | ${r.title}`);
console.error(`(${rows.length} known jobs)`);
