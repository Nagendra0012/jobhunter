// Portfolio data: "attack path" case studies plus settings. Pure module so it
// runs in the browser (live preview) and on the server (save, export).

import { newId } from "./resume-doc";

export const TACTICS = [
  { id: "TA0043", name: "Reconnaissance" },
  { id: "TA0042", name: "Resource Development" },
  { id: "TA0001", name: "Initial Access" },
  { id: "TA0002", name: "Execution" },
  { id: "TA0003", name: "Persistence" },
  { id: "TA0004", name: "Privilege Escalation" },
  { id: "TA0005", name: "Defense Evasion" },
  { id: "TA0006", name: "Credential Access" },
  { id: "TA0007", name: "Discovery" },
  { id: "TA0008", name: "Lateral Movement" },
  { id: "TA0009", name: "Collection" },
  { id: "TA0011", name: "Command and Control" },
  { id: "TA0010", name: "Exfiltration" },
  { id: "TA0040", name: "Impact" },
] as const;

export type TacticId = (typeof TACTICS)[number]["id"];
export const isTacticId = (v: unknown): v is TacticId => TACTICS.some((t) => t.id === v);
export const tacticName = (id: TacticId) => TACTICS.find((t) => t.id === id)?.name ?? id;

/** ATT&CK technique ids look like T1078 or T1078.004. */
export const isTechniqueId = (v: string) => /^T\d{4}(\.\d{3})?$/.test(v.trim().toUpperCase());

export type ChainStep = { id: string; tactic: TacticId; technique: string; note: string };

export type CaseStudy = {
  id: string;
  title: string;
  summary: string;
  scenario: string;
  chain: ChainStep[];
  blockedAt: number; // index into chain where the attack was stopped; -1 = not set
  detection: string;
  fix: string;
  impact: string[]; // one metric per line, e.g. "-70% critical misconfigurations"
  tools: string; // comma separated
  link: string;
  example?: boolean; // seeded sample content the user should replace
};

export type PortfolioData = {
  docId: number | null; // resume builder document supplying contact, experience, skills…
  tagline: string;
  about: string;
  caseStudies: CaseStudy[];
  show: { experience: boolean; skills: boolean; certifications: boolean; education: boolean };
  siteUrl: string; // e.g. https://you.github.io (for security.txt); optional
  securityContact: string; // email for security.txt; defaults to resume email
};

export function newStep(tactic: TacticId = "TA0001"): ChainStep {
  return { id: newId(), tactic, technique: "", note: "" };
}

export function newCaseStudy(): CaseStudy {
  return {
    id: newId(),
    title: "",
    summary: "",
    scenario: "",
    chain: [newStep("TA0001"), newStep("TA0004"), newStep("TA0010")],
    blockedAt: 1,
    detection: "",
    fix: "",
    impact: [""],
    tools: "",
    link: "",
  };
}

/** Sample shown on first open so the layout is visible. Clearly flagged for replacement. */
export function exampleCaseStudy(): CaseStudy {
  return {
    id: newId(),
    title: "Stopping cloud privilege escalation through over-permissive IAM roles",
    summary: "Closed an AWS escalation path before it could reach production data.",
    scenario:
      "A developer role could create Lambda functions and pass any IAM role, so a phished developer credential could escalate to admin and read customer data from S3.",
    chain: [
      { id: newId(), tactic: "TA0001", technique: "T1078.004", note: "Phished developer credential (valid cloud account)" },
      { id: newId(), tactic: "TA0004", technique: "T1098", note: "iam:PassRole + lambda:CreateFunction → admin" },
      { id: newId(), tactic: "TA0009", technique: "T1530", note: "Read customer data from S3" },
      { id: newId(), tactic: "TA0010", technique: "T1537", note: "Copy data to attacker-owned account" },
    ],
    blockedAt: 1,
    detection: "IAM Access Analyzer + a custom AWS Config rule flagging roles that combine PassRole with compute-create permissions.",
    fix: "Scoped PassRole with resource conditions, added a permissions boundary to developer roles, and an SCP denying privilege-escalation actions outside the platform team.",
    impact: ["-38 escalation paths", "45 AWS accounts covered", "0 production incidents since"],
    tools: "AWS IAM, Access Analyzer, AWS Config, SCPs, Terraform",
    link: "",
    example: true,
  };
}

export function emptyPortfolio(): PortfolioData {
  return {
    docId: null,
    tagline: "I break attack paths before attackers walk them.",
    about: "",
    caseStudies: [exampleCaseStudy()],
    show: { experience: true, skills: true, certifications: true, education: true },
    siteUrl: "",
    securityContact: "",
  };
}

// ---------------------------------------------------------------------------

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max) : "";
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function sanitizePortfolio(input: unknown): PortfolioData {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const show = (o.show && typeof o.show === "object" ? o.show : {}) as Record<string, unknown>;
  const docId = typeof o.docId === "number" && Number.isSafeInteger(o.docId) && o.docId > 0 ? o.docId : null;
  const studies = Array.isArray(o.caseStudies) ? o.caseStudies.slice(0, 12) : [];
  return {
    docId,
    tagline: str(o.tagline, 200),
    about: str(o.about, 2000),
    caseStudies: studies
      .filter((c) => c && typeof c === "object")
      .map((raw) => {
        const c = raw as Record<string, unknown>;
        const chain = (Array.isArray(c.chain) ? c.chain.slice(0, 8) : [])
          .filter((s) => s && typeof s === "object")
          .map((rs) => {
            const s = rs as Record<string, unknown>;
            return {
              id: str(s.id, 20) || newId(),
              tactic: isTacticId(s.tactic) ? s.tactic : "TA0001",
              technique: str(s.technique, 12).toUpperCase(),
              note: str(s.note, 200),
            };
          });
        const blocked = typeof c.blockedAt === "number" && Number.isInteger(c.blockedAt) ? c.blockedAt : -1;
        return {
          id: str(c.id, 20) || newId(),
          title: str(c.title, 160),
          summary: str(c.summary, 300),
          scenario: str(c.scenario, 1500),
          chain,
          blockedAt: blocked >= 0 && blocked < chain.length ? blocked : -1,
          detection: str(c.detection, 1500),
          fix: str(c.fix, 1500),
          impact: (Array.isArray(c.impact) ? c.impact.slice(0, 6) : []).map((m) => str(m, 120)),
          tools: str(c.tools, 400),
          link: str(c.link, 300),
          ...(c.example === true ? { example: true } : {}),
        };
      }),
    show: {
      experience: bool(show.experience, true),
      skills: bool(show.skills, true),
      certifications: bool(show.certifications, true),
      education: bool(show.education, true),
    },
    siteUrl: str(o.siteUrl, 200),
    securityContact: str(o.securityContact, 200),
  };
}
