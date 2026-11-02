// "Improve my resume": find what target jobs ask for that the resume lacks,
// and apply the additions the user confirms. Pure functions (client-safe).
import type { MatchResult } from "./matcher";
import { bulletHints, newId, type BulletHint, type ResumeDoc } from "./resume-doc";
import { findSkills, SKILLS } from "./skills";

export type Gap = { name: string; count: number; required: number };
export type Gaps = {
  skills: Gap[];
  certs: Gap[];
  keywords: Gap[];
  jobs: number;
};

function tally(map: Map<string, Gap>, name: string, required: boolean) {
  const key = name.toLowerCase();
  const g = map.get(key) ?? { name, count: 0, required: 0 };
  g.count++;
  if (required) g.required++;
  map.set(key, g);
}

const ranked = (map: Map<string, Gap>, limit: number) =>
  [...map.values()]
    .sort((a, b) => b.count - a.count || b.required - a.required || a.name.localeCompare(b.name))
    .slice(0, limit);

/** What the given job matches say is missing, most-asked first. */
export function gapsFromResults(results: MatchResult[], limit = 24): Gaps {
  const skills = new Map<string, Gap>();
  const certs = new Map<string, Gap>();
  const keywords = new Map<string, Gap>();
  for (const r of results) {
    // Count each skill once per job, even if listed as required and preferred.
    const seen = new Set<string>();
    const add = (name: string, required: boolean) => {
      if (seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      tally(skills, name, required);
    };
    for (const s of r.missingRequired) add(s, true);
    for (const t of r.transferable) add(t.name, t.required);
    for (const s of r.missingPreferred) add(s, false);
    for (const c of r.certs.listed) if (!r.certs.matched.includes(c)) tally(certs, c, false);
    for (const k of r.keywords.missing) if (!seen.has(k.toLowerCase())) tally(keywords, k, false);
  }
  return {
    skills: ranked(skills, limit),
    certs: ranked(certs, 10),
    keywords: ranked(keywords, 12),
    jobs: results.length,
  };
}

export type ContactField = "email" | "phone" | "location" | "linkedin" | "github";

export type Improvements = {
  skills: string[];
  certs: string[];
  bullets: Record<string, string>;
  contact: Partial<Record<ContactField, string>>;
  summary: string;
};

export const noImprovements = (): Improvements => ({
  skills: [],
  certs: [],
  bullets: {},
  contact: {},
  summary: "",
});

export function hasImprovements(imp: Improvements): boolean {
  return (
    imp.skills.length > 0 ||
    imp.certs.length > 0 ||
    Object.keys(imp.bullets).length > 0 ||
    Object.values(imp.contact).some((v) => v?.trim()) ||
    imp.summary.trim() !== ""
  );
}

export type WeakBullet = {
  key: string;
  where: string;
  text: string;
  hints: BulletHint[];
};

/** Non-empty experience and project bullets that the hints flag. */
export function weakBullets(doc: ResumeDoc, limit = 8): WeakBullet[] {
  const out: WeakBullet[] = [];
  const scan = (section: "experience" | "projects", id: string, where: string, bullets: string[]) =>
    bullets.forEach((text, i) => {
      const hints = bulletHints(text);
      if (text.trim() && hints.length) out.push({ key: `${section}:${id}:${i}`, where, text, hints });
    });
  for (const e of doc.experience) scan("experience", e.id, [e.title, e.company].filter(Boolean).join(" · "), e.bullets);
  for (const p of doc.projects) scan("projects", p.id, p.name.split(" | ")[0], p.bullets);
  // Weak verbs and missing numbers hurt most; show those first.
  const weight = (b: WeakBullet) => (b.hints.includes("weak-start") ? 2 : 0) + (b.hints.includes("no-number") ? 1 : 0);
  return out.sort((a, b) => weight(b) - weight(a)).slice(0, limit);
}

const hasSkill = (doc: ResumeDoc, name: string) =>
  doc.skills.some((g) => g.items.split(/\s*,\s*/).some((i) => i.toLowerCase() === name.toLowerCase()));

/** Adds a skill to the group that already holds skills of its category, else "Additional Skills". */
export function addSkill(doc: ResumeDoc, name: string) {
  const clean = name.trim();
  if (!clean || hasSkill(doc, clean)) return;
  const category = SKILLS.find((s) => s.name.toLowerCase() === clean.toLowerCase())?.category;
  const group =
    (category && doc.skills.find((g) => findSkills(g.items).some((f) => f.skill.category === category))) ||
    doc.skills.find((g) => g.label === "Additional Skills");
  if (group) group.items = group.items.trim() ? `${group.items}, ${clean}` : clean;
  else doc.skills.push({ id: newId(), label: "Additional Skills", items: clean });
}

export function applyImprovements(doc: ResumeDoc, imp: Improvements): ResumeDoc {
  const next = structuredClone(doc);
  // Drop the builder's empty placeholder group before adding real skills.
  next.skills = next.skills.filter((g) => g.items.trim());
  for (const s of imp.skills) addSkill(next, s);
  for (const c of imp.certs) {
    if (!next.certifications.some((x) => x.name.toLowerCase().includes(c.toLowerCase()))) {
      next.certifications.push({ id: newId(), name: c, issuer: "", date: "" });
    }
  }
  next.certifications = next.certifications.filter((c) => c.name.trim());
  for (const [key, text] of Object.entries(imp.bullets)) {
    const [section, id, i] = key.split(":");
    const list = section === "experience" ? next.experience : section === "projects" ? next.projects : [];
    const entry = list.find((e) => e.id === id);
    if (entry && Number(i) < entry.bullets.length) entry.bullets[Number(i)] = text;
  }
  for (const [field, value] of Object.entries(imp.contact) as [ContactField, string][]) {
    if (value?.trim() && !next.contact[field].trim()) next.contact[field] = value.trim();
  }
  if (imp.summary.trim() && !next.summary.trim()) next.summary = imp.summary.trim();
  return next;
}
