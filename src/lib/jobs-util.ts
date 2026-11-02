// Pure helpers for job records (kept out of db.ts so tests can import them).

export const JOB_STATUSES = ["new", "saved", "applied", "interview", "offer", "rejected", "hidden"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const isJobStatus = (s: unknown): s is JobStatus => JOB_STATUSES.includes(s as JobStatus);

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  saved: "Saved",
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  hidden: "Hidden",
};

const COMPANY_SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|incorporated|plc|gmbh)\b\.?/g;

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Identity of a job across sources: the same posting on Indeed, Dice and the
 * company's own board collapses to one record. Seniority words are kept (a
 * Senior and a mid-level role are different jobs); only punctuation, company
 * suffixes and location formatting are ignored.
 */
export function jobFingerprint(company: string, title: string, location: string): string {
  const c = norm(company).replace(COMPANY_SUFFIX, "").replace(/\s+/g, " ").trim();
  const t = norm(title.replace(/\s*[-–—|(].*?(remote|hybrid|on-?site|united states|usa?)\)?\s*$/i, ""))
    .replace(/\bsr\b/g, "senior")
    .replace(/\bjr\b/g, "junior");
  const city = norm(location.split(/[,;|/(]/)[0] ?? "").replace(/^(remote|hybrid|united states|usa?|us)$/, "remote") || "any";
  return `${c}|${t}|${city}`;
}
