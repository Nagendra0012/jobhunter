import "server-only";
import { getActiveResume } from "./db";
import { deactivateMissing, recordRun, scoreJob, upsertJob, type RunSummary } from "./jobs-db";
import { fetchBoards } from "./sources/boards";
import { markProcessed, readInbox } from "./sources/inbox";
import type { SourceResult } from "./sources/types";

let running: Promise<RunSummary> | null = null;

/** Imports connector jobs from the inbox and (optionally) fetches company boards. */
export function refreshJobs(opts: { boards: boolean }): Promise<RunSummary> {
  // A second click while a refresh is running joins the same run.
  running ??= run(opts).finally(() => {
    running = null;
  });
  return running;
}

async function run({ boards }: { boards: boolean }): Promise<RunSummary> {
  const inbox = readInbox();
  const boardResults: SourceResult[] = boards ? await fetchBoards() : [];
  const resume = getActiveResume();

  let added = 0;
  let updated = 0;
  let scored = 0;
  for (const result of [...inbox, ...boardResults]) {
    for (const job of result.jobs) {
      const { id, isNew, descChanged } = upsertJob(job);
      if (isNew) added++;
      else updated++;
      if (resume && descChanged) {
        scoreJob(id, resume);
        scored++;
      }
    }
    // Only trust "missing means closed" when the board fetch succeeded.
    if (!result.error && result.source !== "other" && result.label.startsWith(`${result.source}:`)) {
      const token = result.label.slice(result.source.length + 1);
      deactivateMissing(result.source, `${token}:`, result.jobs.map((j) => j.externalId));
    }
  }
  for (const r of inbox) if (!r.error) markProcessed(r.file);

  const summary: RunSummary = {
    finishedAt: new Date().toISOString(),
    sources: [...inbox, ...boardResults]
      .filter((r) => r.jobs.length || r.error)
      .map((r) => ({ label: r.label, found: r.jobs.length, ...(r.error ? { error: r.error } : {}) })),
    added,
    updated,
    scored,
  };
  recordRun(summary);
  return summary;
}
