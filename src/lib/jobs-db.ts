import "server-only";
import { db, getActiveResume, type ResumeRecord } from "./db";
import { isJobStatus, jobFingerprint, type JobStatus } from "./jobs-util";
import { jobLevel, type JobLevel } from "./level";
import { matchResume, type MatchResult } from "./matcher";
import type { NormalizedJob, SourceId } from "./sources/types";

export type JobLink = { source: SourceId; url: string };

export type JobRecord = {
  id: number;
  source: SourceId;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  links: JobLink[];
  description: string;
  salary: string | null;
  postedAt: string | null;
  sponsor: boolean | null;
  noSponsor: boolean;
  needsClearance: boolean;
  active: boolean;
  score: number | null;
  level: JobLevel;
  result: MatchResult | null;
  status: JobStatus;
  notes: string;
  statusAt: string | null;
  firstSeen: string;
};

type Row = Record<string, unknown>;

function toJob(r: Row, withDetail = true): JobRecord {
  return {
    id: Number(r.id),
    source: String(r.source) as SourceId,
    company: String(r.company),
    title: String(r.title),
    location: String(r.location),
    remote: Number(r.remote) === 1,
    url: String(r.url),
    links: JSON.parse(String(r.links_json ?? "[]")),
    description: withDetail ? String(r.description ?? "") : "",
    salary: r.salary == null ? null : String(r.salary),
    postedAt: r.posted_at == null ? null : String(r.posted_at),
    sponsor: r.sponsor == null ? null : Number(r.sponsor) === 1,
    noSponsor: Number(r.no_sponsor) === 1,
    needsClearance: Number(r.needs_clearance) === 1,
    active: Number(r.active) === 1,
    score: r.score == null ? null : Number(r.score),
    level: (r.level as JobLevel | null) ?? "unknown",
    result: withDetail && r.result_json ? JSON.parse(String(r.result_json)) : null,
    status: isJobStatus(r.status) ? r.status : "new",
    notes: String(r.notes ?? ""),
    statusAt: r.status_at == null ? null : String(r.status_at),
    firstSeen: String(r.first_seen),
  };
}

/** Inserts a job or merges it into the existing record for the same posting. */
export function upsertJob(j: NormalizedJob): { id: number; isNew: boolean; descChanged: boolean } {
  const d = db();
  const fp = jobFingerprint(j.company, j.title, j.remote && !j.location ? "remote" : j.location);
  const existing = d.prepare("SELECT id, links_json, description FROM jobs WHERE fingerprint = ?").get(fp) as Row | undefined;

  if (!existing) {
    const res = d
      .prepare(
        `INSERT INTO jobs (fingerprint, source, external_id, company, title, location, remote, url, links_json,
          description, salary, posted_at, sponsor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fp, j.source, j.externalId, j.company, j.title, j.location, j.remote ? 1 : 0, j.url,
        JSON.stringify([{ source: j.source, url: j.url }]), j.description, j.salary, j.postedAt,
        j.sponsor == null ? null : j.sponsor ? 1 : 0,
      );
    setLevel(Number(res.lastInsertRowid), j.title, j.description);
    return { id: Number(res.lastInsertRowid), isNew: true, descChanged: true };
  }

  const links: JobLink[] = JSON.parse(String(existing.links_json));
  if (!links.some((l) => l.source === j.source)) links.push({ source: j.source, url: j.url });
  // Keep the most complete description we've seen.
  const descChanged = j.description.length > String(existing.description).length + 50;
  d.prepare(
    `UPDATE jobs SET links_json = ?, active = 1, last_seen = datetime('now'),
       description = CASE WHEN ? THEN ? ELSE description END,
       salary = COALESCE(salary, ?), posted_at = COALESCE(posted_at, ?), sponsor = COALESCE(sponsor, ?)
     WHERE id = ?`,
  ).run(
    JSON.stringify(links), descChanged ? 1 : 0, j.description, j.salary, j.postedAt,
    j.sponsor == null ? null : j.sponsor ? 1 : 0, Number(existing.id),
  );
  if (descChanged) setLevel(Number(existing.id), j.title, j.description);
  return { id: Number(existing.id), isNew: false, descChanged };
}

function setLevel(id: number, title: string, description: string) {
  db().prepare("UPDATE jobs SET level = ? WHERE id = ?").run(jobLevel(title, description), id);
}

/** Fills in experience levels for jobs stored before levels existed (or all, after a rules change). */
export function backfillLevels(all = false) {
  const rows = db()
    .prepare(`SELECT id, title, description FROM jobs ${all ? "" : "WHERE level IS NULL"}`)
    .all() as Row[];
  for (const r of rows) setLevel(Number(r.id), String(r.title), String(r.description ?? ""));
  return rows.length;
}

let levelsReady = false;
function ensureLevels() {
  if (levelsReady) return;
  backfillLevels();
  levelsReady = true;
}

/** Marks a board's jobs inactive when they no longer appear in its listing. */
export function deactivateMissing(source: SourceId, idPrefix: string, seenExternalIds: string[]) {
  const seen = new Set(seenExternalIds);
  const rows = db()
    .prepare("SELECT id, external_id FROM jobs WHERE source = ? AND external_id LIKE ? AND active = 1")
    .all(source, `${idPrefix}%`) as Row[];
  const stmt = db().prepare("UPDATE jobs SET active = 0 WHERE id = ?");
  for (const r of rows) if (!seen.has(String(r.external_id))) stmt.run(Number(r.id));
}

function scoreRow(row: Row, resume: ResumeRecord) {
  const description = String(row.description ?? "");
  if (description.length < 150) return; // not enough text to score fairly
  const result = matchResume(resume.parsed, resume.text, String(row.title), description);
  const sponsor = row.sponsor == null ? null : Number(row.sponsor) === 1;
  const textSaysNo = result.flags.includes("Does not offer visa sponsorship.");
  // The employer's own wording beats a job board's checkbox when they disagree.
  if (sponsor === false && !textSaysNo) result.flags.push("Does not offer visa sponsorship.");
  if (sponsor === true && !textSaysNo) result.flags.unshift("Willing to sponsor a visa.");
  const noSponsor = result.flags.includes("Does not offer visa sponsorship.");
  const clearance = result.flags.some((f) => /clearance|citizenship/i.test(f));
  db()
    .prepare("UPDATE jobs SET score = ?, result_json = ?, scored_resume_id = ?, no_sponsor = ?, needs_clearance = ? WHERE id = ?")
    .run(result.score, JSON.stringify(result), resume.id, noSponsor ? 1 : 0, clearance ? 1 : 0, Number(row.id));
}

export function scoreJob(id: number, resume = getActiveResume()) {
  if (!resume) return;
  const row = db().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row | undefined;
  if (row) scoreRow(row, resume);
}

/** Re-scores every job against the active resume (after a resume change). */
export function rescoreAllJobs(): number {
  backfillLevels(true); // picks up any change to the level rules
  const resume = getActiveResume();
  if (!resume) return 0;
  const rows = db().prepare("SELECT id, title, description, sponsor FROM jobs").all() as Row[];
  db().exec("BEGIN");
  try {
    for (const r of rows) scoreRow(r, resume);
    db().exec("COMMIT");
  } catch (e) {
    db().exec("ROLLBACK");
    throw e;
  }
  return rows.length;
}

export type JobFilters = {
  q?: string;
  minScore?: number;
  source?: SourceId | "";
  statuses?: JobStatus[];
  remoteOnly?: boolean;
  hideNoSponsor?: boolean;
  hideClearance?: boolean;
  includeClosed?: boolean;
  levels?: JobLevel[];
  sort?: "score" | "date";
  limit?: number;
};

function whereClause(f: JobFilters): { sql: string; params: (string | number)[] } {
  ensureLevels();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!f.includeClosed) where.push("active = 1");
  if (f.q) {
    where.push("(title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')");
    const like = `%${f.q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    params.push(like, like);
  }
  if (f.minScore) {
    where.push("score >= ?");
    params.push(f.minScore);
  }
  if (f.source) {
    where.push("links_json LIKE ?");
    params.push(`%"source":"${f.source}"%`);
  }
  if (f.statuses?.length) {
    where.push(`status IN (${f.statuses.map(() => "?").join(",")})`);
    params.push(...f.statuses);
  }
  if (f.levels?.length) {
    where.push(`level IN (${f.levels.map(() => "?").join(",")})`);
    params.push(...f.levels);
  }
  if (f.remoteOnly) where.push("remote = 1");
  if (f.hideNoSponsor) where.push("no_sponsor = 0");
  if (f.hideClearance) where.push("needs_clearance = 0");
  return { sql: where.length ? "WHERE " + where.join(" AND ") : "", params };
}

export function listJobs(f: JobFilters & { offset?: number } = {}): JobRecord[] {
  const { sql: where, params } = whereClause(f);
  const order =
    f.sort === "date"
      ? "COALESCE(posted_at, first_seen) DESC"
      : "score IS NULL, score DESC, COALESCE(posted_at, first_seen) DESC";
  const sql = `SELECT id, source, company, title, location, remote, url, links_json, salary, posted_at, sponsor,
      no_sponsor, needs_clearance, active, score, level, status, notes, status_at, first_seen
    FROM jobs ${where} ORDER BY ${order}, id LIMIT ? OFFSET ?`;
  const limit = Math.min(Math.max(f.limit ?? 300, 1), 1000);
  const offset = Math.max(0, Math.floor(f.offset ?? 0));
  return (db().prepare(sql).all(...params, limit, offset) as Row[]).map((r) => toJob(r, false));
}

/** Best-scoring open jobs the user hasn't dismissed, with full text and results. */
export function topScoredJobs(limit = 20): JobRecord[] {
  const rows = db()
    .prepare(
      `SELECT * FROM jobs WHERE active = 1 AND score IS NOT NULL AND status NOT IN ('hidden', 'rejected')
       ORDER BY score DESC, id LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 100)) as Row[];
  return rows.map((r) => toJob(r));
}

export function countJobs(f: JobFilters = {}): number {
  const { sql: where, params } = whereClause(f);
  return Number((db().prepare(`SELECT COUNT(*) n FROM jobs ${where}`).get(...params) as Row).n);
}

export function getJob(id: number): JobRecord | null {
  const row = db().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row | undefined;
  return row ? toJob(row) : null;
}

export function setJobStatus(id: number, status: JobStatus) {
  db().prepare("UPDATE jobs SET status = ?, status_at = datetime('now') WHERE id = ?").run(status, id);
}

export function setJobNotes(id: number, notes: string) {
  db().prepare("UPDATE jobs SET notes = ? WHERE id = ?").run(notes, id);
}

export function jobStats() {
  const d = db();
  const byStatus = Object.fromEntries(
    (d.prepare("SELECT status, COUNT(*) n FROM jobs WHERE active = 1 OR status != 'new' GROUP BY status").all() as Row[]).map(
      (r) => [String(r.status), Number(r.n)],
    ),
  ) as Partial<Record<JobStatus, number>>;
  const strong = Number(
    (d.prepare("SELECT COUNT(*) n FROM jobs WHERE active = 1 AND status = 'new' AND score >= 70").get() as Row).n,
  );
  const total = Number((d.prepare("SELECT COUNT(*) n FROM jobs WHERE active = 1").get() as Row).n);
  return { byStatus, strong, total };
}

export type RunSummary = {
  finishedAt: string;
  sources: { label: string; found: number; error?: string }[];
  added: number;
  updated: number;
  scored: number;
};

export function recordRun(summary: RunSummary) {
  db().prepare("INSERT INTO fetch_runs (summary_json) VALUES (?)").run(JSON.stringify(summary));
  db().exec("DELETE FROM fetch_runs WHERE id NOT IN (SELECT id FROM fetch_runs ORDER BY id DESC LIMIT 50)");
}

export function lastRun(): RunSummary | null {
  const row = db().prepare("SELECT summary_json FROM fetch_runs ORDER BY id DESC LIMIT 1").get() as Row | undefined;
  return row ? JSON.parse(String(row.summary_json)) : null;
}
