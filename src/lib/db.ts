import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { AtsReport } from "./ats";
import type { MatchResult } from "./matcher";
import type { ParsedResume } from "./resume-parser";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "jobhunter.db");

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { jobhunterDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
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
  `);
  return db;
}

export function db(): DatabaseSync {
  globalForDb.jobhunterDb ??= open();
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
