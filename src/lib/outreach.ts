// Referral outreach helpers: LinkedIn people-search links and message drafts.
// Nothing here sends anything; the user copies drafts and sends them personally.

export const CONTACT_ROLES = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager / security lead",
  peer: "Security engineer (potential referrer)",
  alumni: "Alumni",
  ex_colleague: "Former colleague's network",
  other: "Other",
} as const;
export type ContactRole = keyof typeof CONTACT_ROLES;
export const isContactRole = (v: unknown): v is ContactRole =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(CONTACT_ROLES, v);

export const CONTACT_STATUSES = {
  to_contact: "To contact",
  contacted: "Contacted",
  replied: "Replied",
  referred: "Referred me",
  not_relevant: "Not relevant",
} as const;
export type ContactStatus = keyof typeof CONTACT_STATUSES;
export const isContactStatus = (v: unknown): v is ContactStatus =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(CONTACT_STATUSES, v);

/** Accepts LinkedIn profile URLs (with or without scheme). Returns "" for empty, null if invalid. */
export function normalizeProfileUrl(raw: string): string | null {
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    u.protocol = "https:";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** LinkedIn's limit for a note on a connection request. */
export const CONNECTION_NOTE_LIMIT = 300;

export type SearchLink = { label: string; hint: string; url: string };

const linkedinPeople = (keywords: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;

/** Company names as people write them on profiles ("Acme Inc." → "Acme"). */
export function companySearchName(company: string): string {
  return company
    .replace(/\b(inc|llc|ltd|corp|corporation|co|plc|gmbh)\b\.?/gi, "")
    .replace(/[,.]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchLinks(company: string, opts: { schools?: string[]; pastEmployers?: string[] } = {}): SearchLink[] {
  const c = companySearchName(company);
  const links: SearchLink[] = [
    { label: "Recruiters", hint: "Technical / security recruiters", url: linkedinPeople(`${c} technical recruiter`) },
    { label: "Security leaders", hint: "Likely hiring managers", url: linkedinPeople(`${c} security manager`) },
    { label: "Security engineers", hint: "Peers who can refer you", url: linkedinPeople(`${c} security engineer`) },
  ];
  for (const school of (opts.schools ?? []).slice(0, 2)) {
    links.push({ label: `Alumni: ${school}`, hint: "Shared school, high reply rate", url: linkedinPeople(`${c} ${school}`) });
  }
  for (const past of (opts.pastEmployers ?? []).slice(0, 2)) {
    links.push({ label: `Ex-${past}`, hint: "Used to work where you did", url: linkedinPeople(`${c} ${past}`) });
  }
  return links;
}

/**
 * Picks the resume bullet that best sells this job: quantified, mentions a
 * skill the job wants, and short enough to quote in a note.
 */
export function pickImpact(bullets: string[], wantedSkills: string[]): string | null {
  const wanted = wantedSkills.map((s) => s.toLowerCase());
  const scored = bullets
    .map((b) => b.trim().replace(/\.$/, ""))
    .filter((b) => b.length >= 25)
    .map((b) => {
      const lower = b.toLowerCase();
      const skillHits = wanted.filter((s) => lower.includes(s)).length;
      const metric = /\d|%|\$/.test(b) ? 2 : 0;
      return { b, score: skillHits * 2 + metric - (b.length > 140 ? 1 : 0) };
    })
    .sort((x, y) => y.score - x.score);
  return scored[0]?.b ?? null;
}

/** "Engineered CSPM guardrails across 45 accounts, …" → "engineered CSPM guardrails across 45 accounts" */
export function impactClause(bullet: string, max = 110): string {
  let s = bullet.trim().replace(/\.$/, "");
  s = s.charAt(0).toLowerCase() + s.slice(1);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" and "), cut.lastIndexOf(" with "));
  return (stop > max * 0.5 ? cut.slice(0, stop) : cut.slice(0, cut.lastIndexOf(" "))).trim();
}

export type DraftInput = {
  contactName: string;
  role: ContactRole;
  jobTitle: string;
  company: string;
  myName: string;
  myHeadline: string;
  years: number;
  skills: string[]; // matched skills, most relevant first
  impact: string | null; // a resume bullet
  school?: string | null;
  pastEmployer?: string | null;
};

export type Drafts = { connectionNote: string; followUp: string };

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";

function joinSkills(skills: string[]): string {
  const s = skills.slice(0, 3);
  return s.length <= 1 ? (s[0] ?? "") : `${s.slice(0, -1).join(", ")} and ${s.at(-1)}`;
}

/** Builds a note under LinkedIn's limit, dropping optional parts until it fits. */
function fit(parts: (string | null)[][]): string {
  for (const variant of parts) {
    const text = variant.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (text.length <= CONNECTION_NOTE_LIMIT) return text;
  }
  const last = parts.at(-1)!.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return last.slice(0, CONNECTION_NOTE_LIMIT - 1).trimEnd() + "…";
}

export function draftMessages(d: DraftInput): Drafts {
  const hi = d.contactName.trim() ? `Hi ${firstName(d.contactName)},` : "Hi,";
  const me = firstName(d.myName) || "";
  const sign = me ? `Thanks, ${me}` : "Thanks!";
  const who = d.myHeadline.trim() || "security engineer";
  // Round down: "5+ yrs" for 5.5 years. Never overstate experience.
  const yrs = d.years >= 1 ? `${Math.floor(d.years)}+ yrs` : "";
  const skills = joinSkills(d.skills);
  const impact = d.impact ? impactClause(d.impact) : null;
  const role = `the ${d.jobTitle} role at ${d.company}`;
  const background = [who, yrs && `with ${yrs}`, skills && `in ${skills}`].filter(Boolean).join(" ");

  let opener: string;
  let ask: string;
  switch (d.role) {
    case "recruiter":
      opener = `I just applied for ${role}.`;
      ask = "Would you be open to a quick chat about the team?";
      break;
    case "hiring_manager":
      opener = `I'm very interested in ${role}.`;
      ask = "I'd value 10 minutes to learn what you're looking for.";
      break;
    case "alumni":
      opener = `Fellow ${d.school ?? "alum"} here. I'm applying for ${role}.`;
      ask = "Could I ask you a couple of questions about the team?";
      break;
    case "ex_colleague":
      opener = `I see we both have ${d.pastEmployer ?? "a shared employer"} in common. I'm applying for ${role}.`;
      ask = "Would you be open to a quick chat?";
      break;
    default:
      opener = `I'm applying for ${role} and would love your perspective on the security team.`;
      ask = "Open to a quick chat?";
  }

  const connectionNote = fit([
    [hi, opener, `I'm a ${background}${impact ? `; recently I ${impact}.` : "."}`, ask, sign],
    [hi, opener, `I'm a ${background}.`, ask, sign],
    [hi, opener, `I'm a ${who}.`, ask, sign],
    [hi, opener, ask, sign],
  ]);

  const followUp = [
    hi,
    "",
    `Thanks for connecting. I applied for ${role} and wanted to introduce myself properly.`,
    "",
    `I'm a ${background}.${impact ? ` Most recently I ${impact}.` : ""}`,
    "",
    d.role === "recruiter"
      ? "If my background fits, I'd appreciate it if you could flag my application to the hiring team. Happy to share anything that helps."
      : d.role === "hiring_manager"
        ? "I'd love to hear what the biggest priorities are for this role in the first six months, and whether my experience lines up."
        : "If you think I'd be a good fit after a quick look at my profile, would you be comfortable referring me? No pressure at all either way.",
    "",
    sign.replace("Thanks, ", "Best,\n"),
  ].join("\n");

  return { connectionNote, followUp };
}
