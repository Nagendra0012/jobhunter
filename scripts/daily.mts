// Daily refresh from the command line (used by the scheduled task):
// imports data/inbox, fetches company boards, scores, and prints a summary.
//   npm run daily            full refresh
//   npm run daily -- --inbox-only
import { db } from "../src/lib/db";
import { refreshJobs } from "../src/lib/refresh";

const inboxOnly = process.argv.includes("--inbox-only");
const startedAt = new Date().toISOString().replace("T", " ").slice(0, 19);

const summary = await refreshJobs({ boards: !inboxOnly });
const failed = summary.sources.filter((s) => s.error);

const fresh = db()
  .prepare(
    `SELECT id, title, company, location, score FROM jobs
     WHERE active = 1 AND first_seen >= ? ORDER BY score IS NULL, score DESC LIMIT 15`,
  )
  .all(startedAt) as { id: number; title: string; company: string; location: string; score: number | null }[];

console.log(`Added ${summary.added}, updated ${summary.updated}, scored ${summary.scored}.`);
if (failed.length) console.log(`Sources that failed: ${failed.map((s) => `${s.label} (${s.error})`).join("; ")}`);
console.log(fresh.length ? "\nNew jobs (best first):" : "\nNo new jobs today.");
for (const j of fresh) {
  const score = j.score == null ? "  –" : `${String(j.score).padStart(3)}%`;
  console.log(`${score}  ${j.title} · ${j.company} · ${j.location || "Remote"}  http://127.0.0.1:3000/jobs/${j.id}`);
}
