import { findCerts, findSkills, type SkillCategory } from "./skills";

export type SectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "projects"
  | "achievements"
  | "other";

export type ParsedResume = {
  name: string | null;
  contact: {
    email: string | null;
    phone: string | null;
    linkedin: string | null;
    github: string | null;
    location: string | null;
  };
  sections: Partial<Record<SectionKey, string>>;
  skills: { name: string; category: SkillCategory; count: number }[];
  certs: string[];
  yearsExperience: number;
  titles: string[];
  wordCount: number;
  bullets: string[];
};

const SECTION_HEADINGS: [SectionKey, RegExp][] = [
  ["summary", /^(professional\s+)?(summary|profile|objective|about( me)?|career summary|professional profile)$/i],
  ["experience", /^(work\s+|professional\s+|relevant\s+)?(experience|employment( history)?|work history|career history)$/i],
  ["education", /^(education|academic background|education & training|academics)$/i],
  ["skills", /^(technical\s+|core\s+|key\s+)?(skills|competencies|skills & tools|technologies|tech stack|skills summary|areas of expertise)$/i],
  ["certifications", /^(certifications?|licenses?( & certifications)?|certifications? & (licenses|training)|credentials)$/i],
  ["projects", /^((personal|academic|key|selected)\s+)?projects$/i],
  ["achievements", /^(achievements|awards|honors|accomplishments|awards & achievements|publications|volunteer(ing)?( experience)?)$/i],
];

function headingFor(line: string): SectionKey | null {
  const clean = line.replace(/[:|•\-–—_*#]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 40) return null;
  for (const [key, re] of SECTION_HEADINGS) if (re.test(clean)) return key;
  return null;
}

function splitSections(lines: string[]): Partial<Record<SectionKey, string>> {
  const sections: Partial<Record<SectionKey, string>> = {};
  let current: SectionKey = "other";
  for (const line of lines) {
    const h = headingFor(line);
    if (h) {
      current = h;
      continue;
    }
    sections[current] = (sections[current] ? sections[current] + "\n" : "") + line;
  }
  return sections;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const DATE = String.raw`(?:(?:(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s*,?\s*)|(\d{1,2})\s*/\s*)?((?:19|20)\d{2})`;
const RANGE = new RegExp(
  `${DATE}\\s*(?:-|–|—|to|until)\\s*(?:${DATE}|(present|current|now|today|date))`,
  "gi",
);
const RANGE_ONCE = new RegExp(RANGE.source, "i");

function monthIndex(name?: string, num?: string): number {
  if (name) return MONTHS[name.toLowerCase().slice(0, 4)] ?? MONTHS[name.toLowerCase().slice(0, 3)] ?? 0;
  if (num) return Math.min(Math.max(Number(num) - 1, 0), 11);
  return 0;
}

/** Sums the work date ranges (merging overlaps) and returns years. */
export function estimateYears(text: string, now = new Date()): number {
  const intervals: [number, number][] = [];
  const nowMonths = now.getFullYear() * 12 + now.getMonth();
  for (const m of text.matchAll(RANGE)) {
    const start = Number(m[3]) * 12 + monthIndex(m[1], m[2]);
    const end = m[7]
      ? nowMonths
      : Number(m[6]) * 12 + (m[4] || m[5] ? monthIndex(m[4], m[5]) : 11);
    if (end >= start && end <= nowMonths + 1) intervals.push([start, end + 1]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const iv of intervals) {
    if (cur && iv[0] <= cur[1]) cur[1] = Math.max(cur[1], iv[1]);
    else {
      if (cur) total += cur[1] - cur[0];
      cur = [...iv];
    }
  }
  if (cur) total += cur[1] - cur[0];

  // Fall back to an explicit "5+ years of experience" claim when it is larger.
  const claimed = Math.max(
    0,
    ...[...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:\w+\s+){0,3}experience/gi)].map((m) =>
      Number(m[1]),
    ),
  );
  return Math.round(Math.max(total / 12, claimed) * 10) / 10;
}

const TITLE_RE =
  /\b((?:senior|sr\.?|junior|jr\.?|lead|principal|staff|associate)?\s*(?:cyber\s*security|cloud security|information security|security|soc|network|cloud|devops|devsecops|systems?|it|application security|appsec|iam|grc|software|site reliability)\s+(?:engineer|analyst|architect|specialist|administrator|consultant|intern|manager|developer|lead)(?:\s+(?:i{1,3}|iv|\d))?)\b/gi;

function findTitles(text: string): string[] {
  const titles = new Map<string, string>();
  for (const m of text.matchAll(TITLE_RE)) {
    const t = m[1].replace(/\s+/g, " ").trim();
    titles.set(t.toLowerCase(), t);
  }
  return [...titles.values()].slice(0, 10);
}

const BULLET_RE = /^\s*(?:[•●▪◦‣∙·*\-–]|\d+[.)])\s+/;

function findBullets(lines: string[], experience: string | undefined): string[] {
  const marked = lines.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, "").trim());
  if (marked.length >= 3) return marked;
  // PDF extraction often drops bullet glyphs; treat long experience lines as bullets.
  return (experience ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 40 && !RANGE_ONCE.test(l));
}

export function parseResume(rawText: string): ParsedResume {
  const text = rawText.replace(/\r/g, "").replace(/ /g, " ");
  const lines = text
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const sections = splitSections(lines);

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phone =
    text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ??
    text.match(/\+\d{1,3}[\s.-]?\d{3,5}[\s.-]?\d{3,5}[\s.-]?\d{0,5}/)?.[0] ??
    null;
  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ?? null;
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)?.[0] ?? null;
  const location =
    text.match(/\b[A-Z][a-zA-Z .]+,\s*(?:[A-Z]{2}|[A-Z][a-z]+)\b(?=\s*(?:\d{5})?\s*(?:[|•·\n]|$))/m)?.[0] ?? null;

  // The name is usually the first short line without contact details.
  const name =
    lines
      .slice(0, 5)
      .find(
        (l) =>
          l.length < 40 &&
          !/[@\d|]/.test(l) &&
          !headingFor(l) &&
          /^[A-Za-z][A-Za-z.'\- ]+$/.test(l) &&
          l.split(" ").length <= 5,
      ) ?? null;

  // Experience dates outside the education section count toward years.
  const experienceText =
    sections.experience ??
    lines.filter((l) => !(sections.education ?? "").includes(l)).join("\n");

  return {
    name,
    contact: { email, phone, linkedin, github, location },
    sections,
    skills: findSkills(text)
      .map(({ skill, count }) => ({ name: skill.name, category: skill.category, count }))
      .sort((a, b) => b.count - a.count),
    certs: findCerts(text).map((c) => c.name),
    yearsExperience: estimateYears(experienceText),
    titles: findTitles(sections.experience ?? text),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    bullets: findBullets(lines, sections.experience),
  };
}
