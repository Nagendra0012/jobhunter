import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { checkAts } from "../src/lib/ats";
import { extractText } from "../src/lib/extract";
import {
  bulletHints,
  docFromParsed,
  docToText,
  emptyDoc,
  isAtsDate,
  sanitizeDoc,
  type ResumeDoc,
} from "../src/lib/resume-doc";
import { docxBuffer, docxFilename } from "../src/lib/resume-docx";
import { parseResume } from "../src/lib/resume-parser";

const sample = (): ResumeDoc => ({
  contact: {
    name: "Alex Rivera",
    headline: "Cloud Security Engineer",
    email: "alex.rivera@example.com",
    phone: "(512) 555-0142",
    location: "Austin, TX",
    linkedin: "linkedin.com/in/alexrivera-sec",
    github: "github.com/alexrivera",
    website: "",
  },
  summary: "Cloud Security Engineer with 4 years of experience securing AWS and Azure.",
  skills: [
    { id: "s1", label: "Cloud", items: "AWS, Azure, IAM, GuardDuty, Security Hub" },
    { id: "s2", label: "Tools", items: "Splunk, Terraform, Python, Kubernetes" },
  ],
  experience: [
    {
      id: "e1",
      title: "Cloud Security Engineer",
      company: "Acme Health",
      location: "Austin, TX",
      start: "Jan 2023",
      end: "Present",
      bullets: [
        "Engineered CSPM guardrails across 45 AWS accounts, cutting critical misconfigurations by 70%.",
        "Automated IAM least privilege reviews with Python, removing 1,200 unused permissions.",
      ],
    },
    {
      id: "e2",
      title: "Security Analyst",
      company: "Bluebonnet Bank",
      location: "Dallas, TX",
      start: "Jun 2021",
      end: "Dec 2022",
      bullets: ["Triaged 150+ Splunk SIEM alerts weekly and wrote 30 detection rules."],
    },
  ],
  education: [
    { id: "d1", degree: "B.S. Computer Science", school: "UT Dallas", location: "Dallas, TX", start: "2017", end: "2021", details: "" },
  ],
  certifications: [{ id: "c1", name: "CompTIA Security+", issuer: "CompTIA", date: "2022" }],
  projects: [{ id: "p1", name: "AWS Detection Lab", link: "github.com/alexrivera/lab", bullets: ["Built 12 GuardDuty-driven detections."] }],
});

describe("docToText", () => {
  it("uses headings and dates the ATS parser understands", () => {
    const text = docToText(sample());
    const parsed = parseResume(text);
    for (const s of ["summary", "skills", "experience", "projects", "education", "certifications"] as const) {
      assert.ok(parsed.sections[s], `missing section ${s}`);
    }
    assert.equal(parsed.name, "Alex Rivera");
    assert.equal(parsed.contact.location, "Austin, TX");
    assert.deepEqual(parsed.certs, ["Security+"]);
    assert.ok(parsed.yearsExperience >= 5, `years = ${parsed.yearsExperience}`); // Jun 2021 → today
    assert.equal(parsed.bullets.length, 4);
  });

  it("skips empty entries and sections", () => {
    const text = docToText(emptyDoc());
    assert.equal(text, "");
    const parsed = parseResume(text);
    assert.equal(parsed.wordCount, 0);
  });
});

describe("prefill from uploaded resume", () => {
  it("round-trips a builder resume through text", () => {
    const doc = docFromParsed(parseResume(docToText(sample())));
    assert.equal(doc.contact.name, "Alex Rivera");
    assert.equal(doc.contact.email, "alex.rivera@example.com");
    assert.equal(doc.experience.length, 2);
    assert.equal(doc.experience[0].title, "Cloud Security Engineer");
    assert.equal(doc.experience[0].company, "Acme Health");
    assert.equal(doc.experience[0].start, "Jan 2023");
    assert.equal(doc.experience[0].end, "Present");
    assert.equal(doc.experience[0].bullets.length, 2);
    assert.equal(doc.education[0].degree, "B.S. Computer Science");
    assert.deepEqual(
      { ...doc.certifications[0], id: "" },
      { id: "", name: "CompTIA Security+", issuer: "CompTIA", date: "2022" },
    );
  });

  it("pre-fills from a real PDF", async () => {
    const { text } = await extractText({
      name: "r.pdf",
      bytes: new Uint8Array(fs.readFileSync(path.join(import.meta.dirname, "fixtures", "resume.pdf"))),
    });
    const doc = docFromParsed(parseResume(text));
    assert.equal(doc.contact.name, "Alex Rivera");
    const brief = doc.experience.map(({ title, company, location, start, end }) => ({ title, company, location, start, end }));
    assert.deepEqual(brief, [
      { title: "Cloud Security Engineer", company: "Acme Health", location: "Austin, TX", start: "Jan 2023", end: "Present" },
      { title: "Security Analyst", company: "Bluebonnet Bank", location: "Dallas, TX", start: "Jun 2021", end: "Dec 2022" },
    ]);
    // Bullets wrapped across PDF lines must be rejoined, not split into new entries.
    assert.equal(doc.experience[0].bullets.length, 4, JSON.stringify(doc.experience[0].bullets));
    assert.equal(doc.experience[1].bullets.length, 3, JSON.stringify(doc.experience[1].bullets));
    assert.match(doc.experience[0].bullets[0], /^Engineered .* by 70%\.$/);
    assert.equal(doc.education[0].school, "University of Texas at Dallas");
    assert.ok(doc.skills.length >= 3);
  });
});

describe("Word export", () => {
  it("produces a DOCX an ATS can read back", async () => {
    const doc = sample();
    const buf = await docxBuffer(doc);
    assert.equal(buf.subarray(0, 2).toString(), "PK");
    const { text, hasTables, hasImages } = await extractText({ name: "out.docx", bytes: new Uint8Array(buf) });
    assert.equal(hasTables, false);
    assert.equal(hasImages, false);
    const parsed = parseResume(text);
    assert.equal(parsed.contact.email, "alex.rivera@example.com");
    for (const s of ["experience", "education", "skills", "certifications"] as const) {
      assert.ok(parsed.sections[s], `missing section ${s} in exported DOCX`);
    }
    assert.ok(parsed.skills.some((s) => s.name === "GuardDuty"));
    const ats = checkAts(parsed, text, { hasTables, hasImages, fileType: "docx" });
    assert.ok(ats.checks.find((c) => c.id === "sections")?.passed);
  });

  it("builds a safe filename", () => {
    const doc = sample();
    doc.contact.name = '../Evil "Name"\r\n';
    assert.equal(docxFilename(doc), "Evil_Name_Resume.docx");
    doc.contact.name = "";
    assert.equal(docxFilename(doc), "Resume_Resume.docx");
  });
});

describe("sanitizeDoc", () => {
  it("drops junk and clamps sizes", () => {
    const doc = sanitizeDoc({
      contact: { name: "x".repeat(5000), email: 42 },
      summary: "ok\u0000",
      skills: "not an array",
      experience: Array.from({ length: 100 }, () => ({ title: "t", bullets: Array(100).fill("b") })),
      education: [null, 1, { degree: "BS" }],
    });
    assert.equal(doc.contact.name.length, 200);
    assert.equal(doc.contact.email, "");
    assert.equal(doc.summary, "ok");
    assert.deepEqual(doc.skills, []);
    assert.equal(doc.experience.length, 30);
    assert.equal(doc.experience[0].bullets.length, 25);
    assert.ok(doc.experience[0].id);
    assert.equal(doc.education.length, 1);
    assert.deepEqual(sanitizeDoc(null).projects, []);
  });
});

describe("hints", () => {
  it("flags weak bullets and passes strong ones", () => {
    assert.deepEqual(bulletHints("Engineered CSPM guardrails across 45 AWS accounts, cutting misconfigurations 70%"), []);
    assert.deepEqual(bulletHints("Responsible for monitoring alerts in the SIEM tool"), ["no-number", "weak-start"]);
    assert.ok(bulletHints("I fixed it").includes("first-person"));
    assert.deepEqual(bulletHints("   "), []);
  });
  it("accepts ATS-friendly dates only", () => {
    for (const d of ["Jan 2023", "January 2023", "2023", "Present", "03/2021", ""]) assert.ok(isAtsDate(d), d);
    for (const d of ["Spring 2023", "'21", "2023-01"]) assert.ok(!isAtsDate(d), d);
  });
});
