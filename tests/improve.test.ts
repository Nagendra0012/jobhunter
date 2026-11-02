import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addSkill, applyImprovements, gapsFromResults, hasImprovements, noImprovements, weakBullets } from "../src/lib/improve";
import { matchResume, type MatchResult } from "../src/lib/matcher";
import { docFromParsed, docToText, emptyDoc, type ResumeDoc } from "../src/lib/resume-doc";
import { parseResume } from "../src/lib/resume-parser";

const result = (over: Partial<MatchResult>): MatchResult => ({
  score: 50,
  verdict: "Stretch",
  components: [],
  matchedSkills: [],
  transferable: [],
  missingRequired: [],
  missingPreferred: [],
  certs: { listed: [], matched: [] },
  keywords: { matched: [], missing: [] },
  yearsRequired: null,
  yearsResume: 1,
  flags: [],
  suggestions: [],
  ...over,
});

const base = (): ResumeDoc => {
  const d = emptyDoc();
  d.contact = { ...d.contact, name: "Jordan Lee", email: "jordan@example.com", phone: "555-010-2000", location: "Newark, DE", linkedin: "", github: "" };
  d.summary = "Cloud security engineer focused on AWS detection and automation with Python and Terraform tooling.";
  d.skills = [
    { id: "g1", label: "Languages", items: "Python, SQL" },
    { id: "g2", label: "Security Tools", items: "Wireshark, Nuclei" },
  ];
  d.experience = [
    {
      id: "e1",
      title: "Security Intern",
      company: "Example Labs",
      location: "Remote",
      start: "Jun 2025",
      end: "Aug 2025",
      bullets: ["Responsible for looking at alerts", "Automated triage of 40 GuardDuty findings with Python, cutting response time by 30%."],
    },
  ];
  d.projects = [];
  d.certifications = [{ id: "c1", name: "CompTIA Security+", issuer: "", date: "" }];
  return d;
};

describe("gapsFromResults", () => {
  it("ranks what most jobs ask for and counts each skill once per job", () => {
    const g = gapsFromResults([
      result({ missingRequired: ["Kubernetes", "Splunk"], missingPreferred: ["Kubernetes"], certs: { listed: ["CISSP", "Security+"], matched: ["Security+"] } }),
      result({ missingRequired: ["Kubernetes"], transferable: [{ name: "Splunk", via: "SIEM", required: false }], keywords: { matched: [], missing: ["threat modeling"] } }),
      result({ missingPreferred: ["Terraform"], certs: { listed: ["CISSP"], matched: [] } }),
    ]);
    assert.deepEqual(g.skills, [
      { name: "Kubernetes", count: 2, required: 2 },
      { name: "Splunk", count: 2, required: 1 },
      { name: "Terraform", count: 1, required: 0 },
    ]);
    assert.deepEqual(g.certs, [{ name: "CISSP", count: 2, required: 0 }]);
    assert.deepEqual(g.keywords.map((k) => k.name), ["threat modeling"]);
    assert.equal(g.jobs, 3);
  });
});

describe("applyImprovements", () => {
  it("adds skills to the matching group, else to Additional Skills, without duplicates", () => {
    const d = base();
    addSkill(d, "Splunk"); // a security tool → same category as Wireshark? If not, Additional Skills.
    addSkill(d, "python"); // already there (case-insensitive)
    addSkill(d, "Go"); // a language → Languages
    addSkill(d, "threat modeling");
    const all = d.skills.map((g) => `${g.label}: ${g.items}`).join(" / ");
    assert.match(all, /Languages: Python, SQL, Go/);
    assert.equal((all.match(/Python/gi) ?? []).length, 1);
    assert.match(all, /Splunk/);
    assert.match(all, /Additional Skills: .*threat modeling/);
  });

  it("applies certs, bullet rewrites, and only fills empty contact fields", () => {
    const d = base();
    const imp = {
      ...noImprovements(),
      certs: ["CISSP", "Security+"],
      bullets: { "experience:e1:0": "Triaged 150+ SIEM alerts weekly and escalated 12 confirmed incidents." },
      contact: { linkedin: "linkedin.com/in/jordan-lee", email: "other@example.com" },
    };
    assert.ok(hasImprovements(imp));
    const out = applyImprovements(d, imp);
    assert.deepEqual(out.certifications.map((c) => c.name), ["CompTIA Security+", "CISSP"]);
    assert.match(out.experience[0].bullets[0], /^Triaged 150\+/);
    assert.equal(out.contact.linkedin, "linkedin.com/in/jordan-lee");
    assert.equal(out.contact.email, "jordan@example.com", "existing email is kept");
    assert.equal(d.experience[0].bullets[0], "Responsible for looking at alerts", "input doc is not mutated");
    assert.equal(hasImprovements(noImprovements()), false);
  });

  it("flags weak bullets, weakest first", () => {
    const w = weakBullets(base());
    assert.equal(w.length, 1);
    assert.equal(w[0].key, "experience:e1:0");
    assert.ok(w[0].hints.includes("weak-start") && w[0].hints.includes("no-number"));
  });

  it("raises the match when the user confirms skills a job asks for", () => {
    const jd = `Cloud Security Engineer
Requirements: AWS, Kubernetes security, Splunk SIEM, Terraform, Python automation, incident response.
Preferred: threat modeling and CISSP. You will build detections and guardrails across our AWS accounts.`;
    const score = (d: ResumeDoc) => {
      const text = docToText(d);
      return matchResume(parseResume(text), text, "Cloud Security Engineer", jd).score;
    };
    const d = base();
    const better = applyImprovements(d, { ...noImprovements(), skills: ["Kubernetes", "Splunk", "Terraform"] });
    assert.ok(score(better) > score(d), `${score(d)} -> ${score(better)}`);
  });
});

describe("prefill keeps the resume's own skill groups", () => {
  it("uses 'Label: items' lines as written, joining wrapped lines", () => {
    const text = `Jordan Lee
jordan@example.com | 555-010-2000 | Newark, DE
SUMMARY
Security engineer.
SKILLS
Languages: Python, SQL
AWS: Bedrock, OpenSearch Serverless,
IAM
Security Tools: Semgrep, Nuclei`;
    const doc = docFromParsed(parseResume(text));
    assert.deepEqual(
      doc.skills.map((g) => [g.label, g.items]),
      [
        ["Languages", "Python, SQL"],
        ["AWS", "Bedrock, OpenSearch Serverless, IAM"],
        ["Security Tools", "Semgrep, Nuclei"],
      ],
    );
  });
});
