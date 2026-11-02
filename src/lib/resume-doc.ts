// Structured resume used by the builder. Everything here is pure so it runs in
// both the browser (live preview and ATS score) and the server (save, export).

import { estimateYears, type ParsedResume } from "./resume-parser";
import { SKILLS } from "./skills";

export type ExperienceEntry = {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
};

export type EducationEntry = {
  id: string;
  degree: string;
  school: string;
  location: string;
  start: string;
  end: string;
  details: string;
};

export type CertEntry = { id: string; name: string; issuer: string; date: string };

export type ProjectEntry = { id: string; name: string; link: string; bullets: string[] };

export type SkillGroup = { id: string; label: string; items: string };

export type ResumeDoc = {
  contact: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    website: string;
  };
  summary: string;
  skills: SkillGroup[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertEntry[];
  projects: ProjectEntry[];
};

export const HEADINGS = {
  summary: "Professional Summary",
  skills: "Technical Skills",
  experience: "Professional Experience",
  education: "Education",
  certifications: "Certifications",
  projects: "Projects",
} as const;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyDoc(): ResumeDoc {
  return {
    contact: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "", github: "", website: "" },
    summary: "",
    skills: [
      { id: newId(), label: "Cloud & Security", items: "" },
      { id: newId(), label: "Tools", items: "" },
      { id: newId(), label: "Scripting & IaC", items: "" },
    ],
    experience: [{ id: newId(), title: "", company: "", location: "", start: "", end: "Present", bullets: [""] }],
    education: [{ id: newId(), degree: "", school: "", location: "", start: "", end: "", details: "" }],
    certifications: [],
    projects: [],
  };
}

// ---------------------------------------------------------------------------
// Validation: clamp everything coming from the client so saved data stays sane.

const LIMITS = { short: 200, long: 2000, entries: 30, bullets: 25 };

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max) : "";
}

function arr<T>(v: unknown, map: (x: Record<string, unknown>) => T, max = LIMITS.entries): T[] {
  return Array.isArray(v)
    ? v.filter((x) => x && typeof x === "object").slice(0, max).map((x) => map(x as Record<string, unknown>))
    : [];
}

const id = (v: unknown) => str(v, 20) || newId();
const bullets = (v: unknown) =>
  Array.isArray(v) ? v.slice(0, LIMITS.bullets).map((b) => str(b, 600)) : [];

export function sanitizeDoc(input: unknown): ResumeDoc {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const c = (o.contact && typeof o.contact === "object" ? o.contact : {}) as Record<string, unknown>;
  const s = LIMITS.short;
  return {
    contact: {
      name: str(c.name, s),
      headline: str(c.headline, s),
      email: str(c.email, s),
      phone: str(c.phone, s),
      location: str(c.location, s),
      linkedin: str(c.linkedin, s),
      github: str(c.github, s),
      website: str(c.website, s),
    },
    summary: str(o.summary, LIMITS.long),
    skills: arr(o.skills, (x) => ({ id: id(x.id), label: str(x.label, s), items: str(x.items, 1000) })),
    experience: arr(o.experience, (x) => ({
      id: id(x.id),
      title: str(x.title, s),
      company: str(x.company, s),
      location: str(x.location, s),
      start: str(x.start, 40),
      end: str(x.end, 40),
      bullets: bullets(x.bullets),
    })),
    education: arr(o.education, (x) => ({
      id: id(x.id),
      degree: str(x.degree, s),
      school: str(x.school, s),
      location: str(x.location, s),
      start: str(x.start, 40),
      end: str(x.end, 40),
      details: str(x.details, 600),
    })),
    certifications: arr(o.certifications, (x) => ({
      id: id(x.id),
      name: str(x.name, s),
      issuer: str(x.issuer, s),
      date: str(x.date, 60),
    })),
    projects: arr(o.projects, (x) => ({
      id: id(x.id),
      name: str(x.name, s),
      link: str(x.link, s),
      bullets: bullets(x.bullets),
    })),
  };
}

// ---------------------------------------------------------------------------
// Plain-text rendering, shared by the ATS checker, matcher and exports.

export const filled = (bs: string[]) => bs.map((b) => b.trim()).filter(Boolean);

export function dateRange(start: string, end: string): string {
  return [start.trim(), end.trim()].filter(Boolean).join(" – ");
}

export function contactLine(c: ResumeDoc["contact"]): string[] {
  return [c.location, c.email, c.phone, c.linkedin, c.github, c.website].map((x) => x.trim()).filter(Boolean);
}

export function docToText(doc: ResumeDoc): string {
  const out: string[] = [];
  const c = doc.contact;
  if (c.name.trim()) out.push(c.name.trim());
  if (c.headline.trim()) out.push(c.headline.trim());
  const contact = contactLine(c);
  if (contact.length) out.push(contact.join(" | "));

  if (doc.summary.trim()) out.push("", HEADINGS.summary, doc.summary.trim());

  const skills = doc.skills.filter((g) => g.items.trim());
  if (skills.length) {
    out.push("", HEADINGS.skills);
    for (const g of skills) out.push(g.label.trim() ? `${g.label.trim()}: ${g.items.trim()}` : g.items.trim());
  }

  const exp = doc.experience.filter((e) => e.title.trim() || e.company.trim());
  if (exp.length) {
    out.push("", HEADINGS.experience);
    for (const e of exp) {
      out.push([e.title, e.company, e.location].map((x) => x.trim()).filter(Boolean).join(" | "));
      const dates = dateRange(e.start, e.end);
      if (dates) out.push(dates);
      for (const b of filled(e.bullets)) out.push(`• ${b}`);
    }
  }

  const projects = doc.projects.filter((p) => p.name.trim());
  if (projects.length) {
    out.push("", HEADINGS.projects);
    for (const p of projects) {
      out.push([p.name, p.link].map((v) => v.trim()).filter(Boolean).join(" | "));
      for (const b of filled(p.bullets)) out.push(`• ${b}`);
    }
  }

  const edu = doc.education.filter((e) => e.degree.trim() || e.school.trim());
  if (edu.length) {
    out.push("", HEADINGS.education);
    for (const e of edu) {
      out.push([e.degree, e.school, e.location].map((x) => x.trim()).filter(Boolean).join(" | "));
      const dates = dateRange(e.start, e.end);
      if (dates) out.push(dates);
      if (e.details.trim()) out.push(e.details.trim());
    }
  }

  const certs = doc.certifications.filter((x) => x.name.trim());
  if (certs.length) {
    out.push("", HEADINGS.certifications);
    for (const x of certs) out.push([x.name, x.issuer, x.date].map((v) => v.trim()).filter(Boolean).join(" | "));
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Pre-fill a builder doc from an uploaded resume. Best effort: the user edits.

const DATE_PART = String.raw`(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s*,?\s*|\d{1,2}\s*/\s*)?(?:19|20)\d{2}`;
const RANGE_RE = new RegExp(
  `(${DATE_PART})\\s*(?:-|–|—|to|until)\\s*(${DATE_PART}|present|current|now|today)`,
  "i",
);
const BULLET_RE = /^\s*(?:[•●▪◦‣∙·*\-–]|\d+[.)])\s+/;

/**
 * Splits "Title, Company, Austin, TX" or "Title | Company | Austin, TX" into
 * parts, keeping "City, ST" and "Acme, Inc." together.
 */
function splitHeader(line: string): string[] {
  return line
    .split(/\s*(?:\||•|·|—|–|\t|\s{2,})\s*/)
    .map((x) => x.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const merged: string[] = [];
      for (const bit of part.split(/\s*,\s*/).filter(Boolean)) {
        const glue = /^([A-Z]{2}(\s+\d{5})?|USA?|United States|Remote|(inc|llc|ltd|corp|co|l\.?p)\.?)$/i.test(bit);
        if (merged.length && glue) merged[merged.length - 1] += `, ${bit}`;
        else merged.push(bit);
      }
      return merged;
    });
}

function parseExperience(text: string): ExperienceEntry[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries: ExperienceEntry[] = [];
  let pending: string[] = []; // header lines seen before the dates

  const appendToLastBullet = (text: string) => {
    const last = entries.at(-1);
    if (last?.bullets.length) last.bullets[last.bullets.length - 1] += " " + text;
    else if (last) last.bullets.push(text);
  };

  for (const line of lines) {
    const range = line.match(RANGE_RE);
    if (range) {
      const rest = line.replace(range[0], "").replace(/[|,–—-]\s*$/, "").trim();
      // The header is the text beside the dates, or else the 1–2 lines right
      // above them. Anything earlier is a bullet that wrapped onto a new line.
      const header = rest ? [rest] : pending.slice(-2);
      for (const spill of rest ? pending : pending.slice(0, -2)) appendToLastBullet(spill);
      const parts = splitHeader(header.join(" | "));
      entries.push({
        id: newId(),
        title: parts[0] ?? "",
        company: parts[1] ?? "",
        location: parts.slice(2).join(", "),
        start: range[1].trim(),
        end: range[2].trim().replace(/^./, (ch) => ch.toUpperCase()),
        bullets: [],
      });
      pending = [];
    } else if (BULLET_RE.test(line)) {
      entries.at(-1)?.bullets.push(line.replace(BULLET_RE, "").trim());
    } else if (entries.at(-1)?.bullets.length && !pending.length && /^[a-z0-9(&$%]/.test(line)) {
      appendToLastBullet(line); // lowercase start: clearly a wrapped continuation
    } else if (entries.length && line.length > 60 && !pending.length) {
      entries.at(-1)!.bullets.push(line); // PDFs often drop bullet glyphs
    } else {
      pending.push(line);
    }
  }
  for (const line of pending) appendToLastBullet(line);
  for (const e of entries) if (!e.bullets.length) e.bullets = [""];
  return entries;
}

function parseEducation(text: string): EducationEntry[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries: EducationEntry[] = [];
  for (const line of lines) {
    const range = line.match(RANGE_RE);
    const year = range ? null : line.match(/\b(19|20)\d{2}\b/);
    const rest = line.replace(range?.[0] ?? "", "").replace(/[|,–—-]\s*$/, "").trim();
    const parts = splitHeader(rest);
    if (/(b\.?s\.?|b\.?a\.?|m\.?s\.?|bachelor|master|ph\.?d|associate|diploma|degree|university|college|institute)/i.test(line)) {
      entries.push({
        id: newId(),
        degree: parts[0] ?? "",
        school: parts[1] ?? "",
        location: parts.slice(2).join(", "),
        start: range?.[1].trim() ?? "",
        end: range?.[2].trim() ?? year?.[0] ?? "",
        details: "",
      });
    } else if (entries.length && line) {
      const last = entries.at(-1)!;
      last.details = [last.details, line].filter(Boolean).join("; ");
    }
  }
  return entries;
}

function parseCerts(text: string | undefined, found: string[]): CertEntry[] {
  const lines = (text ?? "")
    .split(/\n|,(?![^()]*\))/)
    .map((l) => l.replace(BULLET_RE, "").trim())
    .filter((l) => l.length > 1);
  const entries = lines.length ? lines : found;
  return entries.slice(0, 20).map((line) => {
    const [name, ...rest] = line.split(/\s*\|\s*/);
    const date = rest.find((r) => /\b(19|20)\d{2}\b|present|expected|in progress/i.test(r)) ?? "";
    const issuer = rest.find((r) => r !== date) ?? "";
    return { id: newId(), name, issuer, date };
  });
}

function skillGroups(parsed: ParsedResume): SkillGroup[] {
  const byCat = new Map<string, string[]>();
  for (const s of parsed.skills) {
    if (s.category === "Soft Skills") continue;
    const list = byCat.get(s.category) ?? [];
    list.push(s.name);
    byCat.set(s.category, list);
  }
  // Keep the taxonomy's category order.
  const order = [...new Set(SKILLS.map((s) => s.category))];
  return order
    .filter((cat) => byCat.has(cat))
    .map((cat) => ({ id: newId(), label: cat, items: byCat.get(cat)!.join(", ") }));
}

export function docFromParsed(parsed: ParsedResume): ResumeDoc {
  const doc = emptyDoc();
  const c = parsed.contact;
  doc.contact = {
    ...doc.contact,
    name: parsed.name ?? "",
    headline: parsed.titles[0] ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    location: c.location ?? "",
    linkedin: c.linkedin ?? "",
    github: c.github ?? "",
  };
  doc.summary = (parsed.sections.summary ?? "").replace(/\s*\n\s*/g, " ").trim();
  const skills = skillGroups(parsed);
  if (skills.length) doc.skills = skills;
  const exp = parsed.sections.experience ? parseExperience(parsed.sections.experience) : [];
  if (exp.length) doc.experience = exp;
  const edu = parsed.sections.education ? parseEducation(parsed.sections.education) : [];
  if (edu.length) doc.education = edu;
  doc.certifications = parseCerts(parsed.sections.certifications, parsed.certs);
  return doc;
}

// ---------------------------------------------------------------------------
// Bullet-level hints shown while editing.

const STRONG_VERBS =
  /^(architected|automated|built|configured|deployed|designed|developed|drove|engineered|established|hardened|identified|implemented|improved|integrated|investigated|launched|led|managed|migrated|mitigated|monitored|optimized|orchestrated|owned|partnered|performed|reduced|remediated|resolved|secured|spearheaded|streamlined|triaged|authored|created|conducted|delivered|detected|enforced|evaluated|executed|audited|analyzed|assessed|collaborated|coordinated|decreased|eliminated|enabled|expanded|increased|instrumented|mentored|modernized|patched|prioritized|responded|rolled|scaled|scanned|standardized|tuned|upgraded|validated|wrote)\b/i;

export type BulletHint = "no-number" | "weak-start" | "too-long" | "too-short" | "first-person";

export function bulletHints(b: string): BulletHint[] {
  const t = b.trim();
  if (!t) return [];
  const hints: BulletHint[] = [];
  if (!/\d|%|\$/.test(t)) hints.push("no-number");
  if (!STRONG_VERBS.test(t)) hints.push("weak-start");
  if (t.length > 220) hints.push("too-long");
  if (t.length < 35) hints.push("too-short");
  if (/\b(I|me|my)\b/.test(t)) hints.push("first-person");
  return hints;
}

export const HINT_TEXT: Record<BulletHint, string> = {
  "no-number": "add a number (%, count, $, time saved)",
  "weak-start": "start with a strong verb (Engineered, Automated, Hardened…)",
  "too-long": "trim to under ~2 lines",
  "too-short": "add tool + scope + result",
  "first-person": "drop I/me/my",
};

/** Dates should look like "Jan 2023" or "2023" so parsers can compute experience. */
export function isAtsDate(s: string): boolean {
  const t = s.trim();
  return !t || /^(present|current)$/i.test(t) || /^((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}$/i.test(t) || /^\d{1,2}\/(19|20)\d{2}$/.test(t);
}

export function docYears(doc: ResumeDoc): number {
  return estimateYears(doc.experience.map((e) => dateRange(e.start, e.end)).join("\n"));
}
