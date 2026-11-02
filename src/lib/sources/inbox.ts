// Jobs fetched by Claude through its connectors (Indeed, Dice, ZipRecruiter…)
// arrive as JSON files in data/inbox. Each file is validated, imported, then
// moved to data/inbox/processed so it is never imported twice.
//
// File format: { "source": "dice", "jobs": [ { title, company, location, url,
//   description, externalId?, remote?, salary?, postedAt?, sponsor? } ] }

import fs from "node:fs";
import path from "node:path";
import { htmlToText } from "../html";
import { isSecurityRole, isUsLocation } from "./filters";
import { isSourceId, type NormalizedJob, type SourceResult } from "./types";

export const INBOX_DIR = path.join(process.cwd(), "data", "inbox");
const PROCESSED_DIR = path.join(INBOX_DIR, "processed");
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_JOBS_PER_FILE = 2000;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function normalizeInboxJob(raw: unknown, fileSource: string): NormalizedJob | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = isSourceId(r.source) ? r.source : isSourceId(fileSource) ? fileSource : "other";
  const title = str(r.title, 200);
  const company = str(r.company, 200);
  const url = str(r.url, 2000);
  if (!title || !company || !/^https:\/\//i.test(url)) return null;
  const rawDesc = str(r.description, 60_000);
  const posted = typeof r.postedAt === "string" ? new Date(r.postedAt) : null;
  return {
    source,
    externalId: str(r.externalId, 200) || url,
    company,
    title,
    location: str(r.location, 300),
    remote: r.remote === true,
    url,
    description: /<[a-z][\s\S]*>/i.test(rawDesc) ? htmlToText(rawDesc) : rawDesc,
    salary: str(r.salary, 200) || null,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted.toISOString() : null,
    sponsor: typeof r.sponsor === "boolean" ? r.sponsor : null,
  };
}

/** Reads and validates all pending inbox files. Call markProcessed after saving. */
export function readInbox(): (SourceResult & { file: string })[] {
  if (!fs.existsSync(INBOX_DIR)) return [];
  const results: (SourceResult & { file: string })[] = [];
  for (const name of fs.readdirSync(INBOX_DIR)) {
    if (!/^[\w.-]+\.json$/.test(name)) continue;
    const file = path.join(INBOX_DIR, name);
    const label = `inbox:${name}`;
    try {
      if (!fs.statSync(file).isFile()) continue;
      if (fs.statSync(file).size > MAX_FILE_BYTES) throw new Error("file too large");
      const data = JSON.parse(fs.readFileSync(file, "utf8")) as { source?: unknown; jobs?: unknown };
      const fileSource = typeof data.source === "string" ? data.source : "other";
      const list = Array.isArray(data.jobs) ? data.jobs.slice(0, MAX_JOBS_PER_FILE) : [];
      const jobs = list
        .map((j) => normalizeInboxJob(j, fileSource))
        .filter((j): j is NormalizedJob => j !== null)
        .filter((j) => isSecurityRole(j.title) && (j.remote || isUsLocation(j.location)));
      results.push({ source: isSourceId(fileSource) ? fileSource : "other", label, jobs, file });
    } catch (e) {
      results.push({ source: "other", label, jobs: [], error: e instanceof Error ? e.message : String(e), file });
    }
  }
  return results;
}

export function markProcessed(file: string) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  const dest = path.join(PROCESSED_DIR, `${Date.now()}-${path.basename(file)}`);
  fs.renameSync(file, dest);
}
