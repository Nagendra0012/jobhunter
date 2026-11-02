import "server-only";
import { db } from "./db";
import { isContactRole, isContactStatus, type ContactRole, type ContactStatus } from "./outreach";

export type ContactRecord = {
  id: number;
  jobId: number | null;
  company: string;
  name: string;
  title: string;
  profileUrl: string;
  role: ContactRole;
  status: ContactStatus;
  notes: string;
  statusAt: string | null;
  createdAt: string;
  jobTitle: string | null;
};

type Row = Record<string, unknown>;

/** Company key so "Acme, Inc." contacts show on every Acme job. */
export function companyKey(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|plc|gmbh)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toContact(r: Row): ContactRecord {
  return {
    id: Number(r.id),
    jobId: r.job_id == null ? null : Number(r.job_id),
    company: String(r.company),
    name: String(r.name),
    title: String(r.title),
    profileUrl: String(r.profile_url),
    role: isContactRole(r.role) ? r.role : "other",
    status: isContactStatus(r.status) ? r.status : "to_contact",
    notes: String(r.notes),
    statusAt: r.status_at == null ? null : String(r.status_at),
    createdAt: String(r.created_at),
    jobTitle: r.job_title == null ? null : String(r.job_title),
  };
}

const SELECT = `SELECT c.*, j.title AS job_title FROM contacts c LEFT JOIN jobs j ON j.id = c.job_id`;

export function insertContact(c: {
  jobId: number | null;
  company: string;
  name: string;
  title: string;
  profileUrl: string;
  role: ContactRole;
}): number {
  const res = db()
    .prepare("INSERT INTO contacts (job_id, company, name, title, profile_url, role) VALUES (?, ?, ?, ?, ?, ?)")
    .run(c.jobId, c.company, c.name, c.title, c.profileUrl, c.role);
  return Number(res.lastInsertRowid);
}

export function contactsForCompany(company: string): ContactRecord[] {
  const key = companyKey(company);
  return (db().prepare(`${SELECT} ORDER BY c.id DESC`).all() as Row[])
    .map(toContact)
    .filter((c) => companyKey(c.company) === key);
}

export function listContacts(): ContactRecord[] {
  return (db().prepare(`${SELECT} ORDER BY c.status_at IS NULL, c.status_at DESC, c.id DESC`).all() as Row[]).map(toContact);
}

export function getContact(id: number): ContactRecord | null {
  const row = db().prepare(`${SELECT} WHERE c.id = ?`).get(id) as Row | undefined;
  return row ? toContact(row) : null;
}

export function setContactStatus(id: number, status: ContactStatus) {
  db().prepare("UPDATE contacts SET status = ?, status_at = datetime('now') WHERE id = ?").run(status, id);
}

export function setContactNotes(id: number, notes: string) {
  db().prepare("UPDATE contacts SET notes = ? WHERE id = ?").run(notes, id);
}

export function deleteContact(id: number) {
  db().prepare("DELETE FROM contacts WHERE id = ?").run(id);
}

export function contactStats() {
  const rows = db().prepare("SELECT status, COUNT(*) n FROM contacts GROUP BY status").all() as Row[];
  return Object.fromEntries(rows.map((r) => [String(r.status), Number(r.n)])) as Partial<Record<ContactStatus, number>>;
}
