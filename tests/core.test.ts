import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { checkAts } from "../src/lib/ats";
import { matchResume } from "../src/lib/matcher";
import { extractText } from "../src/lib/extract";
import { estimateYears, parseResume } from "../src/lib/resume-parser";
import { findCerts, findSkills } from "../src/lib/skills";

const fixture = (name: string) => ({
  name,
  bytes: new Uint8Array(fs.readFileSync(path.join(import.meta.dirname, "fixtures", name))),
});

const CLOUD_JD = `Senior Cloud Security Engineer
About the role
We're hiring a cloud security engineer to secure our AWS environment.
Requirements
- 5+ years of experience in security engineering
- Deep experience with AWS security services: GuardDuty, Security Hub, IAM, KMS
- Infrastructure as code with Terraform
- Scripting in Python or Go
- Experience with SIEM tools such as Splunk
- Kubernetes and container security
Preferred Qualifications
- CISSP, CCSP or AWS Certified Security - Specialty
- Experience with Wiz or other CSPM tools
- Familiarity with SOC 2 and FedRAMP
We do not offer visa sponsorship for this role. Our cloud platform team partners with engineering on threat modeling.`;

describe("skills", () => {
  it("finds aliases and avoids prose false positives", () => {
    const names = findSkills("Built detections in Azure Sentinel and Splunk. Let's go to the ad hoc meeting.").map(
      (s) => s.skill.name,
    );
    assert.ok(names.includes("Microsoft Sentinel"));
    assert.ok(names.includes("Splunk"));
    assert.ok(!names.includes("Go"), "lowercase 'go' must not match the Go language");
    assert.ok(!names.includes("Active Directory"), "'ad' must not match Active Directory");
  });

  it("doesn't read the SOC 2 report as a SOC", () => {
    assert.ok(!findSkills("Experience with SOC 2 and SOC II audits").some((s) => s.skill.name === "SOC"));
    assert.ok(findSkills("Worked in a 24x7 SOC.").some((s) => s.skill.name === "SOC"));
  });

  it("matches symbol-heavy names", () => {
    assert.deepEqual(
      findCerts("CompTIA Security+ and CySA+ holder").map((c) => c.name),
      ["Security+", "CySA+"],
    );
    assert.ok(findSkills("MITRE ATT&CK mapping, CI/CD, C++").map((s) => s.skill.name).includes("MITRE ATT&CK"));
  });
});

describe("years of experience", () => {
  const now = new Date(2026, 10, 1);
  it("merges overlapping ranges", () => {
    // Jan 2020–Dec 2021 overlaps Jun 2021–Dec 2022: three years total.
    assert.equal(estimateYears("Jan 2020 – Dec 2021\nJun 2021 - Dec 2022", now), 3);
  });
  it("counts Present up to today", () => {
    assert.equal(estimateYears("Nov 2024 – Present", now), 2.1);
  });
  it("handles numeric months and ignores future dates", () => {
    assert.equal(estimateYears("01/2022 to 12/2022\n2030 - 2031", now), 1);
  });
});

describe("PDF resume", async () => {
  const { text, hasTables } = await extractText(fixture("resume.pdf"));
  const parsed = parseResume(text);

  it("extracts contact details", () => {
    assert.equal(parsed.name, "Alex Rivera");
    assert.equal(parsed.contact.email, "alex.rivera@example.com");
    assert.equal(parsed.contact.phone, "(512) 555-0142");
    assert.match(parsed.contact.linkedin ?? "", /linkedin\.com\/in\/alexrivera-sec/);
    assert.match(parsed.contact.github ?? "", /github\.com\/alexrivera/);
    assert.equal(parsed.contact.location, "Austin, TX");
    assert.equal(hasTables, false);
  });

  it("finds sections, skills, certs and years", () => {
    for (const s of ["summary", "experience", "education", "skills", "certifications"] as const) {
      assert.ok(parsed.sections[s], `missing section ${s}`);
    }
    const skills = parsed.skills.map((s) => s.name);
    for (const s of ["AWS", "Azure", "IAM", "Splunk", "Terraform", "Python", "Okta", "GuardDuty", "ISO 27001"]) {
      assert.ok(skills.includes(s), `missing skill ${s}`);
    }
    assert.deepEqual(parsed.certs.sort(), ["AWS Security Specialty", "Security+"]);
    // Jun 2021 to today; education dates (2017–2021) must not count.
    assert.ok(parsed.yearsExperience >= 5 && parsed.yearsExperience < 6, `years = ${parsed.yearsExperience}`);
    assert.ok(parsed.titles.some((t) => /cloud security engineer/i.test(t)));
    assert.ok(parsed.bullets.length >= 7, `bullets = ${parsed.bullets.length}`);
  });

  it("produces a sensible ATS report", () => {
    const ats = checkAts(parsed, text, { hasTables, hasImages: false, fileType: "pdf" });
    const byId = Object.fromEntries(ats.checks.map((c) => [c.id, c]));
    assert.ok(byId.parseable.passed);
    assert.ok(byId.contact.passed);
    assert.ok(byId.sections.passed);
    assert.ok(byId.certs.passed);
    assert.ok(!byId.weak.passed, "should flag 'Responsible for'");
    assert.ok(ats.score > 60 && ats.score <= 100, `score = ${ats.score}`);
  });

  it("scores a relevant job highly with correct gaps", () => {
    const r = matchResume(parsed, text, "Senior Cloud Security Engineer", CLOUD_JD);
    assert.ok(r.score >= 65 && r.score <= 100, `score = ${r.score}`);
    assert.equal(r.yearsRequired, 5);
    const matched = r.matchedSkills.map((s) => s.name);
    for (const s of ["AWS", "GuardDuty", "Terraform", "Splunk", "Python"]) assert.ok(matched.includes(s), s);
    assert.ok(r.missingRequired.includes("AWS KMS"));
    // Umbrella skills are satisfied by a specific tool (Terraform → IaC, Python → Automation).
    assert.ok(matched.includes("Infrastructure as Code"));
    assert.ok(!r.missingRequired.includes("Automation"));
    assert.ok(!r.missingPreferred.includes("SOC"), "SOC 2 must not count as SOC");
    assert.ok(!r.suggestions.some((s) => s.includes("SIEM:")));
    assert.ok(r.transferable.some((t) => t.name === "Wiz"), "Wiz should be transferable from CSPM/Security Hub");
    assert.deepEqual(r.certs.matched, ["AWS Security Specialty"]);
    assert.ok(r.flags.includes("Does not offer visa sponsorship."));
    assert.equal(r.components.reduce((s, c) => s + c.weight, 0), 100);
  });

  it("scores an unrelated job low", () => {
    const jd = `Registered Nurse\nRequirements\n- Active RN license in Texas\n- 3+ years of patient care experience\n- BLS and ACLS certification\nProvide compassionate patient care, administer medications, chart patient progress, coordinate with physicians and families. Patient care and patient safety are our priority. Medications must be documented.`;
    const r = matchResume(parsed, text, "Registered Nurse", jd);
    assert.ok(r.score < 45, `score = ${r.score}`);
  });
});

describe("DOCX resume", async () => {
  const { text, hasTables } = await extractText(fixture("resume.docx"));
  const parsed = parseResume(text);
  it("parses text and detects tables", () => {
    assert.equal(parsed.contact.email, "jordan.lee@example.com");
    assert.equal(parsed.contact.location, "Seattle, WA");
    assert.ok(parsed.skills.some((s) => s.name === "Microsoft Sentinel"));
    assert.equal(hasTables, true);
    const ats = checkAts(parsed, text, { hasTables, hasImages: false, fileType: "docx" });
    assert.equal(ats.checks.find((c) => c.id === "layout")?.passed, false);
  });
});

describe("file validation", () => {
  it("rejects files whose bytes don't match the extension", async () => {
    const fake = { name: "resume.pdf", bytes: new TextEncoder().encode("<script>alert(1)</script>") };
    await assert.rejects(extractText(fake), /isn't a valid PDF/);
    const fakeDocx = { name: "cv.docx", bytes: new TextEncoder().encode("%PDF-1.7") };
    await assert.rejects(extractText(fakeDocx), /isn't a valid DOCX/);
  });
  it("rejects unsupported types", async () => {
    await assert.rejects(extractText({ name: "x.exe", bytes: new Uint8Array([77, 90]) }), /Unsupported/);
  });
  it("handles empty text without crashing", () => {
    const parsed = parseResume("");
    const ats = checkAts(parsed, "", { hasTables: false, hasImages: false, fileType: "pdf" });
    assert.equal(ats.checks.find((c) => c.id === "parseable")?.passed, false);
    const r = matchResume(parsed, "", "Security Engineer", "x".repeat(300));
    assert.ok(Number.isFinite(r.score));
  });
});
