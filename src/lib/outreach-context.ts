import "server-only";
import { getActiveResume } from "./db";
import { draftMessages, pickImpact, type ContactRole, type Drafts } from "./outreach";
import { docFromParsed } from "./resume-doc";
import type { MatchResult } from "./matcher";

export type MyProfile = {
  name: string;
  headline: string;
  years: number;
  bullets: string[];
  schools: string[];
  pastEmployers: string[];
};

/** What the drafts say about you, taken from the active resume. */
export function myProfile(): MyProfile | null {
  const resume = getActiveResume();
  if (!resume) return null;
  const p = resume.parsed;
  const doc = docFromParsed(p);
  return {
    name: p.name ?? "",
    headline: doc.contact.headline || p.titles[0] || "",
    years: p.yearsExperience,
    bullets: p.bullets,
    schools: [...new Set(doc.education.map((e) => shortSchool(e.school)).filter(Boolean))],
    pastEmployers: [...new Set(doc.experience.map((e) => e.company.trim()).filter(Boolean))],
  };
}

/** "University of Texas at Dallas" → "UT Dallas"-style search terms work poorly; keep it simple. */
function shortSchool(s: string): string {
  return s.replace(/\s*[—–-].*$/, "").trim();
}

export function draftsFor(
  me: MyProfile | null,
  contact: { name: string; role: ContactRole },
  job: { title: string; company: string; result: MatchResult | null },
): Drafts {
  const skills = job.result
    ? [
        ...job.result.matchedSkills.filter((s) => s.required).map((s) => s.name),
        ...job.result.matchedSkills.filter((s) => !s.required).map((s) => s.name),
      ]
    : [];
  return draftMessages({
    contactName: contact.name,
    role: contact.role,
    jobTitle: job.title,
    company: job.company,
    myName: me?.name ?? "",
    myHeadline: me?.headline ?? "",
    years: me?.years ?? 0,
    skills,
    impact: me ? pickImpact(me.bullets, skills) : null,
    school: me?.schools[0] ?? null,
    pastEmployer: me?.pastEmployers[0] ?? null,
  });
}
