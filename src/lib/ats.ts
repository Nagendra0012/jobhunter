import type { ParsedResume } from "./resume-parser";

export type Severity = "critical" | "warning" | "tip";

export type AtsCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: Severity;
  weight: number;
  detail: string;
  fix?: string;
};

export type AtsReport = {
  score: number;
  checks: AtsCheck[];
};

const ACTION_VERBS = new Set(
  `architected automated built configured deployed designed developed drove engineered established hardened
  identified implemented improved integrated investigated launched led managed migrated mitigated monitored
  optimized orchestrated owned partnered performed reduced remediated resolved secured spearheaded streamlined
  triaged authored created conducted delivered detected enforced evaluated executed audited analyzed assessed
  collaborated coordinated decreased eliminated enabled expanded increased instrumented mentored modernized
  patched prioritized responded rolled scaled scanned standardized tuned upgraded validated wrote`
    .split(/\s+/)
    .filter(Boolean),
);

const WEAK_PHRASES = [
  "responsible for",
  "duties included",
  "worked on",
  "helped with",
  "assisted with",
  "involved in",
  "tasked with",
  "various",
  "etc.",
];

/** Below this many readable words the file is effectively blank to an ATS. */
export const UNREADABLE_WORDS = 30;

const RISKY_SYMBOLS = /[★☆✓✔✗✘☎✉📞📧🔗➤➢►◆■□●○◎]/gu;

export function checkAts(
  parsed: ParsedResume,
  text: string,
  meta: { hasTables: boolean; hasImages: boolean; fileType: string },
): AtsReport {
  const checks: AtsCheck[] = [];
  const add = (c: AtsCheck) => checks.push(c);
  const lower = text.toLowerCase();

  const unreadable = parsed.wordCount < UNREADABLE_WORDS;
  add({
    id: "parseable",
    label: "Text can be read by an ATS",
    passed: parsed.wordCount >= 150,
    severity: "critical",
    weight: 20,
    detail: unreadable
      ? `Only ${parsed.wordCount} words could be read. To an ATS this resume is essentially blank.`
      : `Extracted ${parsed.wordCount} words.`,
    fix: unreadable
      ? "This file is image-based (a scan, a Canva/Photoshop export, or text converted to outlines). Recreate it as a text-based PDF or DOCX from Word or Google Docs."
      : "Very little text came through. Either the resume is too short, or columns, text boxes or headers/footers are hiding content from the parser. Use a single-column layout and expand your bullets.",
  });
  // Every other check would "pass" trivially on empty text, so stop here.
  if (unreadable) return { score: 0, checks };

  const contactMissing = [
    !parsed.contact.email && "email",
    !parsed.contact.phone && "phone",
    !parsed.contact.linkedin && "LinkedIn URL",
  ].filter(Boolean) as string[];
  add({
    id: "contact",
    label: "Contact details",
    passed: contactMissing.length === 0,
    severity: contactMissing.includes("email") ? "critical" : "warning",
    weight: 8,
    detail: contactMissing.length ? `Missing: ${contactMissing.join(", ")}.` : "Email, phone and LinkedIn found.",
    fix: "Put email, phone, city/state and LinkedIn as plain text at the top. Never inside a header/footer or an image.",
  });

  const location = parsed.contact.location;
  add({
    id: "location",
    label: "US location listed",
    passed: Boolean(location),
    severity: "tip",
    weight: 3,
    detail: location ? `Found "${location}".` : "No City, ST location found.",
    fix: 'US recruiters filter by location. Add "City, ST" (or "Open to relocation") next to your contact details.',
  });

  const required: [keyof ParsedResume["sections"], string][] = [
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
  ];
  const missingSections = required.filter(([k]) => !parsed.sections[k]).map(([, l]) => l);
  add({
    id: "sections",
    label: "Standard section headings",
    passed: missingSections.length === 0,
    severity: "critical",
    weight: 15,
    detail: missingSections.length
      ? `Couldn't find: ${missingSections.join(", ")}.`
      : "Experience, Education and Skills found.",
    fix: 'Use plain headings an ATS recognizes: "Professional Experience", "Education", "Technical Skills", "Certifications". Avoid creative names like "My Journey".',
  });

  add({
    id: "summary",
    label: "Professional summary",
    passed: Boolean(parsed.sections.summary),
    severity: "tip",
    weight: 3,
    detail: parsed.sections.summary ? "Summary found." : "No summary section.",
    fix: "Add a 2–3 line summary naming your target title (e.g. Cloud Security Engineer), years of experience and top 4–5 skills.",
  });

  add({
    id: "certs",
    label: "Certifications section",
    passed: Boolean(parsed.sections.certifications) || parsed.certs.length > 0,
    severity: "warning",
    weight: 6,
    detail: parsed.certs.length ? `Found: ${parsed.certs.join(", ")}.` : "No recognized certifications.",
    fix: "Security roles filter heavily on certs. List them in their own section with full names and acronyms, e.g. \"CompTIA Security+ (SY0-701)\". Add in-progress certs with an expected date.",
  });

  const wc = parsed.wordCount;
  add({
    id: "length",
    label: "Length",
    passed: wc >= 350 && wc <= 1100,
    severity: "warning",
    weight: 6,
    detail: `${wc} words.`,
    fix: wc < 350
      ? "Too thin to rank well. Expand bullets with tools, scope and results. Aim for 450–900 words."
      : "Too long. Trim older or unrelated roles; keep to 1–2 pages (about 450–900 words).",
  });

  const bullets = parsed.bullets;
  const quantified = bullets.filter((b) => /\d|%|\$/.test(b)).length;
  const qRatio = bullets.length ? quantified / bullets.length : 0;
  add({
    id: "metrics",
    label: "Quantified achievements",
    passed: qRatio >= 0.35,
    severity: "warning",
    weight: 12,
    detail: bullets.length
      ? `${quantified} of ${bullets.length} bullets include a number (${Math.round(qRatio * 100)}%).`
      : "No bullet points detected under your experience.",
    fix: bullets.length
      ? 'Add numbers to at least a third of bullets: "Reduced critical cloud misconfigurations by 70% across 40 AWS accounts", "Triaged 150+ alerts/week".'
      : 'List 3–6 bullet points under each role, each with a result: "Reduced critical cloud misconfigurations by 70% across 40 AWS accounts".',
  });

  const firstWord = (b: string) => b.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const strong = bullets.filter((b) => ACTION_VERBS.has(firstWord(b))).length;
  const vRatio = bullets.length ? strong / bullets.length : 0;
  add({
    id: "verbs",
    label: "Bullets start with action verbs",
    passed: vRatio >= 0.5,
    severity: "warning",
    weight: 8,
    detail: bullets.length
      ? `${strong} of ${bullets.length} bullets start with a strong verb.`
      : "No bullet points detected under your experience.",
    fix: "Start bullets with verbs like Engineered, Automated, Hardened, Remediated, Deployed, Detected.",
  });

  const weakFound = WEAK_PHRASES.filter((p) => lower.includes(p));
  add({
    id: "weak",
    label: "No weak phrases",
    passed: weakFound.length === 0,
    severity: "tip",
    weight: 5,
    detail: weakFound.length ? `Found: "${weakFound.join('", "')}".` : "None found.",
    fix: '"Responsible for monitoring alerts" → "Monitored and triaged 200+ SIEM alerts weekly, cutting MTTR 35%".',
  });

  const pronouns = text.match(/\b(I|me|my|myself)\b/g)?.length ?? 0;
  add({
    id: "pronouns",
    label: "No first-person pronouns",
    passed: pronouns <= 1,
    severity: "tip",
    weight: 3,
    detail: pronouns ? `${pronouns} uses of I/me/my.` : "None found.",
    fix: 'Drop "I" and "my": write "Built…" instead of "I built…".',
  });

  add({
    id: "layout",
    label: "Simple single-column layout",
    passed: !meta.hasTables && !meta.hasImages,
    severity: "warning",
    weight: 6,
    detail: meta.hasTables || meta.hasImages
      ? `Found ${[meta.hasTables && "tables", meta.hasImages && "images"].filter(Boolean).join(" and ")}.`
      : meta.fileType === "pdf"
        ? "Can't fully check tables/columns in PDFs. Make sure it's single-column."
        : "No tables or images.",
    fix: "Tables, text boxes, columns and icons often scramble in ATS parsers. Use one column with plain text.",
  });

  const symbols = text.match(RISKY_SYMBOLS)?.length ?? 0;
  add({
    id: "symbols",
    label: "No decorative symbols",
    passed: symbols <= 2,
    severity: "tip",
    weight: 2,
    detail: symbols ? `${symbols} icons/symbols found.` : "None found.",
    fix: "Replace icons (☎ ✉ ★) with plain words. Standard bullets (•) are fine.",
  });

  const categories = new Set(parsed.skills.map((s) => s.category));
  const hasCloud = categories.has("Cloud Platforms");
  add({
    id: "security-breadth",
    label: "Security keyword coverage",
    passed: categories.size >= 5 && hasCloud,
    severity: "warning",
    weight: 3,
    detail: `${parsed.skills.length} recognized skills across ${categories.size} areas${hasCloud ? "" : ", no cloud platform"}.`,
    fix: "Security/cloud security roles expect cloud (AWS/Azure/GCP), IAM, SIEM/detection, IaC and scripting. Name the exact tools you've used.",
  });

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks };
}
