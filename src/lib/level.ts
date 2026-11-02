// Experience level of a job posting, from its title and text.
// "grad": new-grad / early-career programs or 0–1 years; "entry": junior or up
// to 2 years; "mid": 3–4 years or an "Engineer II"; "senior": 5+ years or a
// senior title; "unknown": the posting gives no signal.

export type JobLevel = "grad" | "entry" | "mid" | "senior" | "unknown";

export const LEVEL_LABELS: Record<JobLevel, string> = {
  grad: "New grad",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  unknown: "Level unclear",
};

const SENIOR_TITLE = /\b(senior|sr\.?|staff|lead|principal|architect|manager|director|head of|distinguished|fellow)\b/i;
const SENIOR_NUMBER = /\b(III|IV|V|3|4|5)\s*(?:[-–,(|]|$)/; // "Security Engineer III"
const MID_NUMBER = /\b(II|2)\s*(?:[-–,(|]|$)/;
const GRAD_TITLE =
  /\b(new[\s-]?grad(uate)?|recent[\s-]grad(uate)?|university[\s-]grad(uate)?|graduate|early[\s-]career|campus|apprentice(ship)?|rotational|residency|class of 20\d\d)\b/i;
const ENTRY_TITLE = /\b(junior|jr\.?|entry[\s-]level|associate)\b/i;
const ENTRY_NUMBER = /\b(I|1)\s*(?:[-–,(|]|$)/; // "Security Engineer I"

const GRAD_TEXT =
  /\b(new[\s-]grad(uate)?s?|recent[\s-](college[\s-]|university[\s-])?grad(uate)?s?|graduating (in|by|between)|class of 20\d\d|early[\s-]career (program|role|talent|engineer)|university (graduate|hire)s?|no (prior |professional )?experience (is )?required)\b/i;
const ENTRY_TEXT = /\b(entry[\s-]level|junior[\s-]level)\b/i;

// "3+ years of experience", "2-4 years in security operations", "5+ years Cloud", "0–1 yrs experience".
const YEARS_RE = /\b(\d{1,2})\s*(\+|(?:-|–|—|to)\s*\d{1,2}\s*\+?)?\s*(?:years?|yrs?)\b(?!\s+(?:old|ago|of age))(.{0,80})/gi;
const EXPERIENCE_SOON = /^(?:\s+[\w/&,()-]+){0,6}?\s+(?:experience|exp)\b/i;
const WORK_WORD =
  /^\s*(?:of|in|as|with|building|working|hands-on|professional|industry|relevant|related|direct|practical|configuring|developing|designing|managing|leading|operating|partnering|doing|supporting)\b/i;

/** The first experience requirement the posting states (usually the main one), or null. */
export function statedYears(text: string): number | null {
  const nums: number[] = [];
  for (const m of text.matchAll(YEARS_RE)) {
    const [, n, plusOrRange, rest] = m;
    // "5+ years" and "2-4 years" are requirements; a bare "10 years" needs
    // work context ("10 years to exercise your options" is not one).
    const isRequirement = plusOrRange || EXPERIENCE_SOON.test(rest) || (WORK_WORD.test(rest) && !/^\s*of age\b/i.test(rest));
    if (isRequirement && Number(n) <= 20) nums.push(Number(n));
  }
  return nums[0] ?? null;
}

export function jobLevel(title: string, description: string): JobLevel {
  const t = title.trim();
  const years = statedYears(description);
  if (SENIOR_TITLE.test(t) || SENIOR_NUMBER.test(t)) return "senior";
  if (GRAD_TITLE.test(t)) return "grad";
  if (MID_NUMBER.test(t)) return years != null && years >= 5 ? "senior" : "mid";
  if (years != null && years >= 5) return "senior";
  if (years != null && years >= 3) return "mid";
  if (GRAD_TEXT.test(description)) return "grad";
  if (ENTRY_TITLE.test(t) || ENTRY_NUMBER.test(t)) return years === 0 ? "grad" : "entry";
  if (years != null) return years === 0 ? "grad" : "entry";
  if (ENTRY_TEXT.test(description)) return "entry";
  return "unknown";
}
