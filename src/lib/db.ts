import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { UNREADABLE_WORDS, type AtsReport } from "./ats";
import type { MatchResult } from "./matcher";
import { emptyPortfolio, sanitizePortfolio, type PortfolioData } from "./portfolio";
import { sanitizeDoc, type ResumeDoc } from "./resume-doc";
import type { ParsedResume } from "./resume-parser";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "jobhunter.db");

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { jobhunterDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

// Idempotent schema setup. Runs once per module load (not per connection),
// so tables added in code also appear after a dev hot reload.
function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      text TEXT NOT NULL,
      parsed_json TEXT NOT NULL,
      ats_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      job_title TEXT NOT NULL,
      company TEXT,
      jd_text TEXT NOT NULL,
      score INTEGER NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      remote INTEGER NOT NULL DEFAULT 0,
      url TEXT NOT NULL,
      links_json TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      salary TEXT,
      posted_at TEXT,
      sponsor INTEGER,
      no_sponsor INTEGER NOT NULL DEFAULT 0,
      needs_clearance INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      score INTEGER,
      result_json TEXT,
      scored_resume_id INTEGER,
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT NOT NULL DEFAULT '',
      status_at TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS jobs_score ON jobs(score DESC);
    CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
    CREATE TABLE IF NOT EXISTS fetch_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      summary_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      company TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      profile_url TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'other',
      status TEXT NOT NULL DEFAULT 'to_contact',
      notes TEXT NOT NULL DEFAULT '',
      status_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS contacts_company ON contacts(company);
    CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS resume_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Columns added after a table first shipped. CREATE TABLE IF NOT EXISTS never
// alters an existing table, so existing databases get them via ALTER TABLE.
const ADDED_COLUMNS: Record<string, Record<string, string>> = {
  jobs: {
    no_sponsor: "INTEGER NOT NULL DEFAULT 0",
    needs_clearance: "INTEGER NOT NULL DEFAULT 0",
    level: "TEXT",
  },
};

function addMissingColumns(db: DatabaseSync) {
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const existing = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name),
    );
    for (const [name, def] of Object.entries(columns)) {
      if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
    }
  }
}

let migrated = false;

export function db(): DatabaseSync {
  globalForDb.jobhunterDb ??= open();
  if (!migrated) {
    migrate(globalForDb.jobhunterDb);
    addMissingColumns(globalForDb.jobhunterDb);
    migrated = true;
  }
  return globalForDb.jobhunterDb;
}

export type ResumeRecord = {
  id: number;
  filename: string;
  text: string;
  parsed: ParsedResume;
  ats: AtsReport;
  isActive: boolean;
  createdAt: string;
};

export type MatchRecord = {
  id: number;
  resumeId: number;
  jobTitle: string;
  company: string | null;
  jdText: string;
  score: number;
  result: MatchResult;
  createdAt: string;
};

type Row = Record<string, unknown>;

function toResume(r: Row): ResumeRecord {
  return {
    id: Number(r.id),
    filename: String(r.filename),
    text: String(r.text),
    parsed: JSON.parse(String(r.parsed_json)),
    ats: JSON.parse(String(r.ats_json)),
    isActive: Number(r.is_active) === 1,
    createdAt: String(r.created_at),
  };
}

function toMatch(r: Row): MatchRecord {
  return {
    id: Number(r.id),
    resumeId: Number(r.resume_id),
    jobTitle: String(r.job_title),
    company: r.company == null ? null : String(r.company),
    jdText: String(r.jd_text),
    score: Number(r.score),
    result: JSON.parse(String(r.result_json)),
    createdAt: String(r.created_at),
  };
}

/** Saves a resume and makes it the active one used for matching. */
export function insertResume(
  filename: string,
  text: string,
  parsed: ParsedResume,
  ats: AtsReport,
): number {
  const d = db();
  d.exec("UPDATE resumes SET is_active = 0");
  const res = d
    .prepare(
      "INSERT INTO resumes (filename, text, parsed_json, ats_json, is_active) VALUES (?, ?, ?, ?, 1)",
    )
    .run(filename, text, JSON.stringify(parsed), JSON.stringify(ats));
  return Number(res.lastInsertRowid);
}

export function getActiveResume(): ResumeRecord | null {
  const row = db()
    .prepare("SELECT * FROM resumes WHERE is_active = 1 ORDER BY id DESC LIMIT 1")
    .get() as Row | undefined;
  return row ? toResume(row) : null;
}

/** Filename suffix for resumes made active from the builder (not real uploads). */
export const BUILDER_SUFFIX = " (builder)";

/** Resume to pre-fill the builder from: the active one if it is a readable upload, else the newest readable upload. */
export function getImportableResume(): ResumeRecord | null {
  const usable = (r: ResumeRecord) => !r.filename.endsWith(BUILDER_SUFFIX) && r.parsed.wordCount >= UNREADABLE_WORDS;
  const active = getActiveResume();
  if (active && usable(active)) return active;
  return listResumes().find(usable) ?? null;
}

export function listResumes(): ResumeRecord[] {
  return (db().prepare("SELECT * FROM resumes ORDER BY id DESC").all() as Row[]).map(toResume);
}

export function setActiveResume(id: number) {
  const d = db();
  d.exec("UPDATE resumes SET is_active = 0");
  d.prepare("UPDATE resumes SET is_active = 1 WHERE id = ?").run(id);
}

export function deleteResume(id: number) {
  const d = db();
  d.prepare("DELETE FROM matches WHERE resume_id = ?").run(id);
  d.prepare("DELETE FROM resumes WHERE id = ?").run(id);
  // Keep one resume active if any remain.
  if (!getActiveResume()) {
    d.exec("UPDATE resumes SET is_active = 1 WHERE id = (SELECT MAX(id) FROM resumes)");
  }
}

export function insertMatch(
  resumeId: number,
  jobTitle: string,
  company: string | null,
  jdText: string,
  result: MatchResult,
): number {
  const res = db()
    .prepare(
      "INSERT INTO matches (resume_id, job_title, company, jd_text, score, result_json) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(resumeId, jobTitle, company, jdText, result.score, JSON.stringify(result));
  return Number(res.lastInsertRowid);
}

export function getMatch(id: number): MatchRecord | null {
  const row = db().prepare("SELECT * FROM matches WHERE id = ?").get(id) as Row | undefined;
  return row ? toMatch(row) : null;
}

export function listMatches(limit = 50): MatchRecord[] {
  return (
    db().prepare("SELECT * FROM matches ORDER BY id DESC LIMIT ?").all(limit) as Row[]
  ).map(toMatch);
}

export function deleteMatch(id: number) {
  db().prepare("DELETE FROM matches WHERE id = ?").run(id);
}

export type DocRecord = {
  id: number;
  name: string;
  doc: ResumeDoc;
  createdAt: string;
  updatedAt: string;
};

function toDoc(r: Row): DocRecord {
  return {
    id: Number(r.id),
    name: String(r.name),
    doc: sanitizeDoc(JSON.parse(String(r.data_json))),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function insertDoc(name: string, doc: ResumeDoc): number {
  const res = db()
    .prepare("INSERT INTO resume_docs (name, data_json) VALUES (?, ?)")
    .run(name, JSON.stringify(doc));
  return Number(res.lastInsertRowid);
}

export function updateDoc(id: number, name: string, doc: ResumeDoc): boolean {
  const res = db()
    .prepare("UPDATE resume_docs SET name = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, JSON.stringify(doc), id);
  return Number(res.changes) > 0;
}

export function getDoc(id: number): DocRecord | null {
  const row = db().prepare("SELECT * FROM resume_docs WHERE id = ?").get(id) as Row | undefined;
  return row ? toDoc(row) : null;
}

export function listDocs(): DocRecord[] {
  return (db().prepare("SELECT * FROM resume_docs ORDER BY updated_at DESC, id DESC").all() as Row[]).map(toDoc);
}

/** The single portfolio, created with sample content on first use. */
export function getPortfolio(): PortfolioData {
  const row = db().prepare("SELECT data_json FROM portfolio WHERE id = 1").get() as Row | undefined;
  if (row) return sanitizePortfolio(JSON.parse(String(row.data_json)));
  const fresh = emptyPortfolio();
  fresh.docId = listDocs()[0]?.id ?? null;
  savePortfolioData(fresh);
  return fresh;
}

export function savePortfolioData(data: PortfolioData) {
  db()
    .prepare(
      `INSERT INTO portfolio (id, data_json) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')`,
    )
    .run(JSON.stringify(data));
}

export function deleteDocRecord(id: number) {
  db().prepare("DELETE FROM resume_docs WHERE id = ?").run(id);
}
