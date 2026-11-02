import { UNREADABLE_WORDS } from "./ats";
import { TARGET_ROLES } from "./profile";
import type { ParsedResume } from "./resume-parser";
import { findCerts, findSkills } from "./skills";

export type MatchComponent = {
  key: "skills" | "experience" | "title" | "certs" | "keywords";
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
};

export type MatchResult = {
  score: number;
  verdict: "Strong match" | "Good match" | "Stretch" | "Weak match";
  components: MatchComponent[];
  matchedSkills: { name: string; required: boolean }[];
  transferable: { name: string; via: string; required: boolean }[];
  missingRequired: string[];
  missingPreferred: string[];
  certs: { listed: string[]; matched: string[] };
  keywords: { matched: string[]; missing: string[] };
  yearsRequired: number | null;
  yearsResume: number;
  flags: string[];
  suggestions: string[];
};

// Skills that partly substitute for each other: knowing Sentinel is not
// knowing Splunk, but an ATS-reviewing human will see it as transferable.
const FAMILIES: string[][] = [
  ["SIEM", "Splunk", "Microsoft Sentinel", "Elastic Security", "QRadar", "Chronicle"],
  ["EDR", "CrowdStrike", "Microsoft Defender for Endpoint", "SentinelOne"],
  ["AWS", "Azure", "GCP", "Oracle Cloud"],
  ["CSPM", "CNAPP", "Wiz", "Prisma Cloud", "Orca Security", "Lacework", "Microsoft Defender for Cloud", "AWS Security Hub", "GCP Security Command Center"],
  ["Terraform", "CloudFormation", "Infrastructure as Code"],
  ["Vulnerability Management", "Nessus"],
  ["Okta", "Entra ID", "Active Directory"],
  ["SAST", "DAST", "SCA", "Application Security"],
  ["NIST", "ISO 27001", "SOC 2", "PCI DSS", "HIPAA", "FedRAMP", "CIS Benchmarks", "CMMC"],
  ["Python", "Go", "PowerShell", "Bash"],
  ["Kubernetes", "Docker"],
];

// Broad skills almost any resume "has"; they count less than specific tools,
// so vague wording can't produce a high match on a sparse job posting.
const GENERIC_SKILLS = new Set([
  "Audit", "Automation", "Leadership", "Communication", "Documentation",
  "Cross-functional Collaboration", "Linux", "Git", "SQL", "Jira",
]);

// Umbrella skills fully satisfied by any specific member: a JD asking for
// "infrastructure as code" is answered by Terraform on the resume.
const UMBRELLAS: Record<string, string[]> = {
  "Infrastructure as Code": ["Terraform", "CloudFormation", "Policy as Code"],
  SIEM: ["Splunk", "Microsoft Sentinel", "Elastic Security", "QRadar", "Chronicle"],
  EDR: ["CrowdStrike", "Microsoft Defender for Endpoint", "SentinelOne"],
  CSPM: ["Wiz", "Prisma Cloud", "Orca Security", "Lacework", "Microsoft Defender for Cloud", "AWS Security Hub", "GCP Security Command Center", "AWS Config"],
  CNAPP: ["Wiz", "Prisma Cloud", "Orca Security", "Lacework"],
  Automation: ["Python", "PowerShell", "Bash", "Go", "SOAR"],
  "Vulnerability Management": ["Nessus"],
  "Container Security": ["Kubernetes Security", "Trivy"],
  "Secrets Management": ["AWS KMS", "Azure Key Vault"],
};

const STOPWORDS = new Set(
  `about above across after again against also among and any are around based because been before being
  below between both but can could did does doing down during each either else ensure etc every few from
  further have having help here how including into its itself just like make more most must need needs our
  ours out over own role same should some such team teams than that the their them then there these they
  this those through under until using very want well were what when where which while who will with within
  work working would your yours you we us is be as an a of to in on for or by at it not all new other years
  year experience strong ability knowledge understanding skills plus preferred required requirements job
  company candidate candidates position opportunity benefits salary equal employer status apply including
  responsibilities qualifications minimum basic preferred related field degree bachelor bachelors master
  masters level across environment environments support provide develop develops developing best practices
  great join looking based remote hybrid onsite office time full part day days week weeks per hour annual
  range pay compensation insurance health dental vision paid leave 401k equity bonus engineering engineer
  engineers tool tools security cloud platform platforms services service systems system hiring familiarity
  deep partners partner such`
    .split(/\s+/)
    .filter(Boolean),
);

type Importance = "required" | "preferred";

/** Tags each JD line as required or preferred based on the nearest heading. */
function splitJd(jd: string): { line: string; importance: Importance }[] {
  let mode: Importance = "required";
  return jd
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const short = line.length < 70;
      if (short && /(preferred|nice[- ]to[- ]have|bonus|desired|a plus|pluses|extra credit)/i.test(line)) {
        mode = "preferred";
      } else if (
        short &&
        /(required|requirements|minimum|basic qualifications|must[- ]have|what you('ll)? (bring|need)|qualifications|responsibilities|what you('ll)? do|about you)/i.test(line)
      ) {
        mode = "required";
      }
      const inline = /(preferred|is a plus|nice to have|bonus|desired)/i.test(line) ? "preferred" : mode;
      return { line, importance: inline };
    });
}

function yearsRequired(jd: string, title: string): number | null {
  const nums = [
    ...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?(?:years|yrs)/gi),
  ]
    .map((m) => Number(m[1]))
    .filter((n) => n >= 1 && n <= 15);
  if (nums.length) return Math.min(...nums);
  if (/\b(senior|sr\.?|staff|principal|lead)\b/i.test(title)) return 5;
  if (/\b(junior|jr\.?|associate|entry|intern)\b/i.test(title)) return 0;
  return null;
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/cyber\s*security/g, "cybersecurity")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/^(senior|sr|junior|jr|staff|principal|lead|ii|iii|iv|i|remote|us|usa)$/.test(t));

function titleSimilarity(jobTitle: string, candidates: string[]): number {
  const jt = new Set(tokens(jobTitle));
  if (!jt.size) return 0.5;
  let best = 0;
  for (const c of candidates) {
    const ct = new Set(tokens(c));
    const inter = [...jt].filter((t) => ct.has(t)).length;
    const union = new Set([...jt, ...ct]).size;
    best = Math.max(best, union ? inter / union : 0);
  }
  // Any security title is relevant even if the wording differs.
  if (/(security|cybersecurity|soc|iam|appsec|grc|detection|threat|incident)/i.test(jobTitle)) {
    best = Math.max(best, 0.6);
  }
  return Math.min(1, best * 1.15);
}

function topKeywords(jd: string, exclude: Set<string>, n = 15): string[] {
  const counts = new Map<string, number>();
  for (const w of jd.toLowerCase().match(/[a-z][a-z0-9+#/-]{3,}/g) ?? []) {
    if (STOPWORDS.has(w) || exclude.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

function verdictFor(score: number): MatchResult["verdict"] {
  if (score >= 75) return "Strong match";
  if (score >= 60) return "Good match";
  if (score >= 45) return "Stretch";
  return "Weak match";
}

export function matchResume(
  resume: ParsedResume,
  resumeText: string,
  jobTitle: string,
  jd: string,
): MatchResult {
  const resumeSkills = new Set(resume.skills.map((s) => s.name));
  const resumeLower = resumeText.toLowerCase();

  // Skills, weighted by whether the JD treats them as required.
  const jdSkills = new Map<string, { importance: Importance; count: number }>();
  for (const { line, importance } of splitJd(jd)) {
    for (const { skill, count } of findSkills(line)) {
      const prev = jdSkills.get(skill.name);
      jdSkills.set(skill.name, {
        importance: prev?.importance === "required" || importance === "required" ? "required" : "preferred",
        count: (prev?.count ?? 0) + count,
      });
    }
  }
  // The title itself names core skills (e.g. "AWS Security Engineer").
  for (const { skill } of findSkills(jobTitle)) {
    jdSkills.set(skill.name, { importance: "required", count: (jdSkills.get(skill.name)?.count ?? 0) + 2 });
  }

  const matchedSkills: MatchResult["matchedSkills"] = [];
  const transferable: MatchResult["transferable"] = [];
  const missingRequired: string[] = [];
  const missingPreferred: string[] = [];
  let earned = 0;
  let possible = 0;
  for (const [name, { importance, count }] of jdSkills) {
    const required = importance === "required";
    const w = ((required ? 3 : 1) + (count >= 3 ? 1 : 0)) * (GENERIC_SKILLS.has(name) ? 0.4 : 1);
    possible += w;
    if (resumeSkills.has(name) || UMBRELLAS[name]?.some((s) => resumeSkills.has(s))) {
      earned += w;
      matchedSkills.push({ name, required });
      continue;
    }
    const family = FAMILIES.find((f) => f.includes(name));
    const via = family?.find((s) => s !== name && resumeSkills.has(s));
    if (via) {
      earned += w * 0.5;
      transferable.push({ name, via, required });
    } else if (required) {
      missingRequired.push(name);
    } else {
      missingPreferred.push(name);
    }
  }
  // A JD with no recognizable security/tech skills is almost certainly outside your field.
  const skillScore = possible ? earned / possible : 0.1;

  // Title alignment against target roles and past titles.
  const titleScore = titleSimilarity(jobTitle, [...TARGET_ROLES, ...resume.titles]);

  // Years of experience, only counted when the job is in your field.
  const reqYears = yearsRequired(jd, jobTitle);
  const have = resume.yearsExperience;
  const yearsFit =
    reqYears === 0
      ? 1 // entry level: no experience needed
      : have <= 0
        ? 0 // no dated experience on the resume: no credit
        : reqYears == null || have >= reqYears
          ? 1
          : have >= reqYears - 1
            ? 0.85
            : Math.max(0.15, have / reqYears);
  const relevance = Math.min(1, Math.max(skillScore, titleScore) / 0.6);
  const expScore = yearsFit * relevance;

  // Certifications (skipped from the total when the JD lists none).
  const listedCerts = findCerts(jd).map((c) => c.name);
  const matchedCerts = listedCerts.filter((c) => resume.certs.includes(c));
  // JDs usually list certs as alternatives ("CISSP, CCSP or AWS Security"), so one is nearly enough.
  const certScore = listedCerts.length
    ? matchedCerts.length
      ? 0.9 + (0.1 * matchedCerts.length) / listedCerts.length
      : 0
    : null;

  // Frequent JD words outside the skill taxonomy.
  const skillWords = new Set([...jdSkills.keys()].flatMap((s) => s.toLowerCase().split(/\s+/)));
  const kws = topKeywords(jd, skillWords);
  const kwMatched = kws.filter((k) => resumeLower.includes(k));
  const kwScore = kws.length ? kwMatched.length / kws.length : 0.5;

  const components: MatchComponent[] = [
    {
      key: "skills",
      label: "Skills",
      score: Math.round(skillScore * 100),
      weight: 50,
      detail: `${matchedSkills.length} of ${jdSkills.size} job skills on your resume${transferable.length ? `, ${transferable.length} transferable` : ""}.`,
    },
    {
      key: "experience",
      label: "Experience",
      score: Math.round(expScore * 100),
      weight: 20,
      detail:
        reqYears == null
          ? `No years stated. You have ~${have} yrs.`
          : `Asks for ${reqYears}+ yrs. You have ~${have} yrs.`,
    },
    {
      key: "title",
      label: "Role fit",
      score: Math.round(titleScore * 100),
      weight: 10,
      detail: `"${jobTitle}" vs your target roles and past titles.`,
    },
    ...(certScore == null
      ? []
      : [
          {
            key: "certs" as const,
            label: "Certifications",
            score: Math.round(certScore * 100),
            weight: 10,
            detail: matchedCerts.length
              ? `Job mentions ${listedCerts.join(", ")}. You have ${matchedCerts.join(", ")}.`
              : `Job mentions ${listedCerts.join(", ")}. None are on your resume.`,
          },
        ]),
    {
      key: "keywords",
      label: "Other keywords",
      score: Math.round(kwScore * 100),
      weight: 10,
      detail: `${kwMatched.length} of ${kws.length} frequent job terms appear in your resume.`,
    },
  ];
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  // An unreadable resume (image-only PDF) is blank to an ATS: no match, whatever the title says.
  const unreadable = resume.wordCount < UNREADABLE_WORDS;
  const score = unreadable ? 0 : Math.round(components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight);

  const flags: string[] = [];
  if (unreadable) flags.push("Your resume's text can't be read (image-based file), so an ATS would reject it.");
  if (/(security clearance|ts\/sci|top secret|secret clearance|clearance required|active clearance)/i.test(jd)) {
    flags.push("Requires a US security clearance.");
  }
  if (/(us citizen(ship)?|u\.s\. citizen(ship)?|citizenship is required)/i.test(jd)) {
    flags.push("Requires US citizenship.");
  }
  if (
    /(unable to sponsor|not (able to )?sponsor|no (visa )?sponsorship|without (the need for )?(visa )?sponsorship|sponsorship is not available|(do|does|will|can)( not|n't) (offer|provide|support)( (any|h-?1b|visa|employment))* sponsorship)/i.test(
      jd,
    )
  ) {
    flags.push("Does not offer visa sponsorship.");
  }
  if (/(bachelor'?s|master'?s|\bBS\b|\bMS\b|degree) (degree )?(in|required)/i.test(jd)) {
    flags.push("Mentions a degree requirement.");
  }

  const suggestions: string[] = [];
  if (missingRequired.length) {
    suggestions.push(
      `If you have real experience with ${missingRequired.slice(0, 5).join(", ")}, add them by exact name in Skills and in a bullet that shows how you used them.`,
    );
  }
  for (const t of transferable.slice(0, 3)) {
    suggestions.push(
      `Show your ${t.via} experience as transferable to ${t.name}, e.g. "${t.via} (hands-on); familiar with ${t.name}", only if you've actually used or studied ${t.name}.`,
    );
  }
  if (titleScore < 0.6) {
    suggestions.push(`Your summary doesn't echo this title. Open your summary with "${jobTitle}" wording if it's accurate.`);
  }
  if (certScore === 0) {
    suggestions.push(`This job values ${listedCerts.join(" / ")}. If you're studying for one, list it as "In progress, expected <month year>".`);
  }
  const kwMissing = kws.filter((k) => !kwMatched.includes(k));
  if (kwMissing.length >= 3) {
    suggestions.push(`Mirror the job's language where true: ${kwMissing.slice(0, 6).join(", ")}.`);
  }

  return {
    score,
    verdict: verdictFor(score),
    components,
    matchedSkills,
    transferable,
    missingRequired,
    missingPreferred,
    certs: { listed: listedCerts, matched: matchedCerts },
    keywords: { matched: kwMatched, missing: kwMissing },
    yearsRequired: reqYears,
    yearsResume: have,
    flags,
    suggestions,
  };
}
