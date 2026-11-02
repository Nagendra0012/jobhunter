// One-click tailoring of a resume to a job posting. It only reorders and
// re-labels what the resume already says: nothing is invented or added.
import type { ResumeDoc } from "./resume-doc";
import { findSkills } from "./skills";

const ROLE_WORD = /\b(engineer|analyst|architect|specialist|consultant|researcher|developer|administrator|investigator|scientist|tester)\b/i;

/** "Cyber Identity - SailPoint ISC Analyst - Security Engineer I" → "Security Engineer". */
export function roleFromTitle(title: string): string {
  const pieces = title
    .split(/\s+[-–—|/]\s+|,|\(|\)/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Prefer the last piece naming a role ("... - Security Engineer I"), else the first.
  const piece = [...pieces].reverse().find((p) => ROLE_WORD.test(p)) ?? pieces[0] ?? "";
  return piece
    .replace(/\b(I{1,3}|IV|[1-4])$/, "") // level numbers
    .replace(/\b(cleared|remote|hybrid|onsite|contract|full[\s-]?time)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** The words of a posting that make a line "relevant": its skills plus keywords. */
export function jobTerms(description: string, keywords: string[] = []): string[] {
  const skills = findSkills(description).flatMap((f) => f.skill.aliases);
  return [...new Set([...skills, ...keywords].map((t) => t.toLowerCase()).filter((t) => t.length > 1))];
}

function relevance(text: string, terms: string[]): number {
  const lower = ` ${text.toLowerCase()} `;
  let n = 0;
  for (const t of terms) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(lower)) n++;
  }
  return n;
}

/** Stable sort: higher relevance first, original order otherwise. */
function byRelevance<T>(items: T[], text: (x: T) => string, terms: string[]): T[] {
  return items
    .map((item, i) => ({ item, i, r: relevance(text(item), terms) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .map((x) => x.item);
}

export function tailorDoc(base: ResumeDoc, job: { title: string; description: string; keywords?: string[] }): ResumeDoc {
  const doc = structuredClone(base);
  const terms = jobTerms(`${job.title}\n${job.description}`, job.keywords);

  const role = roleFromTitle(job.title);
  if (role && ROLE_WORD.test(role)) doc.contact.headline = role;

  // Skills: relevant items first within each group, most relevant groups first.
  doc.skills = byRelevance(
    doc.skills
      .filter((g) => g.items.trim())
      .map((g) => ({
        ...g,
        items: byRelevance(g.items.split(/\s*,\s*/).filter(Boolean), (s) => s, terms).join(", "),
      })),
    (g) => g.items,
    terms,
  );

  // Experience stays in date order; bullets inside each role are reordered.
  for (const e of doc.experience) e.bullets = byRelevance(e.bullets, (b) => b, terms);
  // Projects are not dated in order of importance, so the most relevant lead.
  for (const p of doc.projects) p.bullets = byRelevance(p.bullets, (b) => b, terms);
  doc.projects = byRelevance(doc.projects, (p) => `${p.name} ${p.bullets.join(" ")}`, terms);
  return doc;
}

/** "Jordan_Lee_Resume_Atlassian.docx" */
export function tailoredFilename(doc: ResumeDoc, company: string, ext: "docx" | "pdf" = "docx"): string {
  const part = (s: string, max: number) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, max);
  const name = part(doc.contact.name || "", 40) || "Resume";
  const co = part(company.replace(/,?\s+(inc|llc|ltd|corp|corporation|co)\.?$/i, ""), 30);
  return `${name}_Resume${co ? `_${co}` : ""}.${ext}`;
}
