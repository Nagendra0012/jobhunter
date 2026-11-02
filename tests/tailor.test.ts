import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { docToText, emptyDoc, type ResumeDoc } from "../src/lib/resume-doc";
import { roleFromTitle, tailorDoc, tailoredFilename } from "../src/lib/tailor";

const base = (): ResumeDoc => {
  const d = emptyDoc();
  d.contact = { ...d.contact, name: "Jordan Lee", headline: "SOC Analyst", email: "jordan@example.com" };
  d.skills = [
    { id: "a", label: "Languages", items: "C#, JavaScript, Python" },
    { id: "b", label: "Cloud", items: "Azure, AWS, Terraform" },
    { id: "c", label: "Soft", items: "Mentoring" },
  ];
  d.experience = [
    { id: "e1", title: "Intern", company: "A", location: "", start: "Jun 2025", end: "Aug 2025", bullets: ["Wrote onboarding docs for 3 teams.", "Automated AWS GuardDuty triage with Python, cutting response time 30%."] },
    { id: "e2", title: "Intern", company: "B", location: "", start: "Jun 2024", end: "Aug 2024", bullets: ["Triaged 150 SIEM alerts weekly."] },
  ];
  d.projects = [
    { id: "p1", name: "QR Scanner", link: "", bullets: ["Built a Node.js QR decoder."] },
    { id: "p2", name: "Cloud Misconfig Scanner", link: "", bullets: ["Scanned 40 AWS controls with Python and Terraform."] },
  ];
  return d;
};

const JD = `Cloud Security Engineer
Requirements: AWS, Python, Terraform, GuardDuty, incident response. Nice to have: Splunk.`;

describe("roleFromTitle", () => {
  it("keeps the role and drops levels, programs and locations", () => {
    assert.equal(roleFromTitle("Security Engineer, 2027 Graduate U.S."), "Security Engineer");
    assert.equal(roleFromTitle("Cyber Identity - SailPoint ISC Analyst - Security Engineer I"), "Security Engineer");
    assert.equal(roleFromTitle("AI Security Engineer I"), "AI Security Engineer");
    assert.equal(roleFromTitle("Cleared - Cyber Security Engineer (Multiple Levels)"), "Cyber Security Engineer");
  });
});

describe("tailorDoc", () => {
  it("reorders toward the job without adding or losing anything", () => {
    const before = base();
    const t = tailorDoc(before, { title: "Cloud Security Engineer (Remote)", description: JD });
    assert.equal(t.contact.headline, "Cloud Security Engineer");
    assert.equal(t.skills[0].label, "Cloud", "most relevant group first");
    assert.equal(t.skills[0].items, "AWS, Terraform, Azure");
    assert.equal(t.skills[1].items, "Python, C#, JavaScript");
    assert.match(t.experience[0].bullets[0], /^Automated AWS GuardDuty/);
    assert.deepEqual(t.experience.map((e) => e.company), ["A", "B"], "experience keeps date order");
    assert.equal(t.projects[0].name, "Cloud Misconfig Scanner");

    // Same words, just reordered: no skill, bullet or project invented or dropped.
    const words = (d: ResumeDoc) => docToText({ ...d, contact: { ...d.contact, headline: "" } }).split(/[\s,]+/).sort().join(" ");
    assert.equal(words(t), words(before));
    assert.equal(before.contact.headline, "SOC Analyst", "input is not mutated");
  });

  it("keeps the old headline when the title names no role", () => {
    assert.equal(tailorDoc(base(), { title: "Red Team - Cyber", description: JD }).contact.headline, "SOC Analyst");
  });
});

describe("tailoredFilename", () => {
  it("names the file after the person and company", () => {
    assert.equal(tailoredFilename(base(), "Atlassian Inc."), "Jordan_Lee_Resume_Atlassian.docx");
    assert.equal(tailoredFilename(base(), "Office of Technology & Innovation", "pdf"), "Jordan_Lee_Resume_Office_of_Technology_Innovatio.pdf");
  });
});
