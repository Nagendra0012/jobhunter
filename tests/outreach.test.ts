import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONNECTION_NOTE_LIMIT,
  CONTACT_ROLES,
  companySearchName,
  draftMessages,
  impactClause,
  normalizeProfileUrl,
  pickImpact,
  searchLinks,
  type ContactRole,
  type DraftInput,
} from "../src/lib/outreach";

const base: DraftInput = {
  contactName: "Jordan Lee",
  role: "recruiter",
  jobTitle: "Cloud Security Engineer",
  company: "Huntress",
  myName: "Alex Rivera",
  myHeadline: "Cloud Security Engineer",
  years: 5.5,
  skills: ["AWS", "IAM", "Terraform", "Splunk"],
  impact: "Engineered CSPM guardrails with AWS Config and Security Hub across 45 AWS accounts, cutting critical misconfigurations by 70%.",
  school: "University of Texas at Dallas",
  pastEmployer: "Acme Health",
};

describe("draftMessages", () => {
  it("personalizes the connection note and stays under LinkedIn's limit", () => {
    const { connectionNote, followUp } = draftMessages(base);
    assert.ok(connectionNote.length <= CONNECTION_NOTE_LIMIT, `${connectionNote.length} chars`);
    assert.match(connectionNote, /^Hi Jordan,/);
    assert.match(connectionNote, /Cloud Security Engineer role at Huntress/);
    assert.match(connectionNote, /Thanks, Alex$/);
    assert.match(connectionNote, /5\+ yrs/, "5.5 years must not be rounded up to 6");
    assert.match(followUp, /engineered CSPM guardrails/);
    assert.match(followUp, /Best,\nAlex$/);
  });

  it("never exceeds the limit, even with very long inputs, for every role", () => {
    for (const role of Object.keys(CONTACT_ROLES) as ContactRole[]) {
      const note = draftMessages({
        ...base,
        role,
        jobTitle: "Senior Staff Principal Cloud Security Engineer, Detection & Response, Infrastructure Platform ".repeat(3),
        company: "An Extremely Long Company Name Holdings International Incorporated",
        myHeadline: "Cloud Security Engineer and Detection Engineering Specialist ".repeat(3),
        school: "The University of Somewhere With a Very Long Official Name",
      }).connectionNote;
      assert.ok(note.length <= CONNECTION_NOTE_LIMIT, `${role}: ${note.length} chars`);
    }
  });

  it("drops the impact clause before truncating", () => {
    const note = draftMessages({ ...base, jobTitle: "Senior Cloud Security Engineer, Identity & Access Platform" }).connectionNote;
    assert.ok(note.length <= CONNECTION_NOTE_LIMIT);
    assert.ok(!note.endsWith("…"), note);
  });

  it("uses role-specific asks", () => {
    assert.match(draftMessages({ ...base, role: "alumni" }).connectionNote, /Fellow University of Texas at Dallas/);
    assert.match(draftMessages({ ...base, role: "ex_colleague" }).connectionNote, /Acme Health/);
    assert.match(draftMessages({ ...base, role: "peer" }).followUp, /referring me/);
  });

  it("works without a resume or contact name", () => {
    const d = draftMessages({ ...base, contactName: "", myName: "", myHeadline: "", years: 0, skills: [], impact: null });
    assert.match(d.connectionNote, /^Hi, I just applied/);
    assert.match(d.connectionNote, /security engineer/);
    assert.ok(d.connectionNote.length <= CONNECTION_NOTE_LIMIT);
  });
});

describe("pickImpact / impactClause", () => {
  it("prefers quantified bullets that mention the job's skills", () => {
    const bullets = [
      "Responsible for incident response on cloud alerts",
      "Triaged 150+ Splunk SIEM alerts weekly and wrote 30 detection rules",
      "Automated IAM least privilege reviews with Python and Lambda, removing 1,200 unused permissions",
    ];
    assert.match(pickImpact(bullets, ["IAM", "Python"]) ?? "", /^Automated IAM/);
    assert.match(pickImpact(bullets, ["Splunk"]) ?? "", /^Triaged/);
    assert.equal(pickImpact([], ["AWS"]), null);
  });
  it("lowercases and trims at a natural break", () => {
    const c = impactClause(base.impact!, 80);
    assert.ok(c.length <= 80, c);
    assert.match(c, /^engineered CSPM guardrails/);
    assert.doesNotMatch(c, /[,.]$/);
  });
});

describe("links", () => {
  it("builds encoded LinkedIn people searches", () => {
    const links = searchLinks("Patch My PC, Inc.", { schools: ["UT Dallas"], pastEmployers: ["Acme & Co"] });
    assert.equal(links.length, 5);
    for (const l of links) assert.match(l.url, /^https:\/\/www\.linkedin\.com\/search\/results\/people\/\?keywords=/);
    assert.ok(links[0].url.includes(encodeURIComponent("Patch My PC technical recruiter")));
    assert.ok(links.at(-1)!.url.includes("Acme%20%26%20Co"));
  });
  it("cleans company names for search", () => {
    assert.equal(companySearchName("HealthEquity Inc."), "HealthEquity");
    assert.equal(companySearchName("Textron, Inc."), "Textron");
  });
  it("accepts only LinkedIn profile URLs", () => {
    assert.equal(normalizeProfileUrl("linkedin.com/in/jordan-lee?trk=x#a"), "https://linkedin.com/in/jordan-lee");
    assert.equal(normalizeProfileUrl("https://www.linkedin.com/in/jordan"), "https://www.linkedin.com/in/jordan");
    assert.equal(normalizeProfileUrl(""), "");
    for (const bad of ["javascript:alert(1)", "https://evil.com/linkedin.com", "https://linkedin.com.evil.com/in/x", "ftp://linkedin.com/in/x"]) {
      assert.equal(normalizeProfileUrl(bad), null, bad);
    }
  });
});
