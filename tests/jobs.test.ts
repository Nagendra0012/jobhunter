import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { htmlToText } from "../src/lib/html";
import { jobFingerprint } from "../src/lib/jobs-util";
import { isSecurityRole, isUsLocation } from "../src/lib/sources/filters";
import { normalizeInboxJob } from "../src/lib/sources/inbox";

describe("isSecurityRole", () => {
  it("keeps security engineering titles", () => {
    for (const t of [
      "Cloud Security Engineer",
      "Senior Security Engineer, Detection & Response",
      "Cyber Security Engineer (Application Security)",
      "IAM Analyst I",
      "Network Security Engineer",
      "Software Engineer, Security",
      "SOC Analyst II",
      "DevSecOps Engineer",
      // Seen in real board data:
      "Senior Platform Security Engineer",
      "Security Software Engineer II, Detection and Response",
      "Staff Application Security Engineer",
      "Detection Analyst",
      "Insider Risk Security Engineer",
      "Vulnerability Management Engineer",
    ]) {
      assert.ok(isSecurityRole(t), t);
    }
  });
  it("drops sales, leadership, gig and unrelated titles", () => {
    for (const t of [
      "Cloud Security Engineer - AI Trainer",
      "Security Sales Engineer",
      "Account Executive, Security",
      "Director of Security Engineering",
      "Head of Security",
      "Software Engineer, Payments",
      "Security Officer (Guard)",
      "Recruiter, Security",
      // Seen in real board data:
      "Senior Product Manager, Secret Detection and Vulnerability Research",
      "Staff Technical Program Manager- Security",
      "Senior Security Auditor",
      "PhD Intern, Security Engineer (2027)",
      "Industrial Security Specialist",
      "Sr. Staff Site Reliability Engineer-Federal, Security Clearance",
      "Sr. Forward Deployed Engineer - National Security",
      "Manager, Product Security",
      "SoC Engineer", // System-on-Chip hardware role at OpenAI
      "Senior Manager, Detection Engineering & Threat Hunting",
    ]) {
      assert.ok(!isSecurityRole(t), t);
    }
  });
});

describe("isUsLocation", () => {
  it("accepts US cities, states and remote", () => {
    for (const l of ["Austin, TX", "San Antonio, Texas, USA", "Remote - US", "United States of America", "New York", "Remote", "Reston, VA; Remote"]) {
      assert.ok(isUsLocation(l), l);
    }
    assert.ok(isUsLocation("", "US"));
    assert.ok(isUsLocation("Anywhere", "United States"));
  });
  it("rejects non-US locations", () => {
    for (const l of ["London, UK", "Toronto, Canada", "Bengaluru, India", "Remote - EMEA", "Dublin", "Tel Aviv"]) {
      assert.ok(!isUsLocation(l), l);
    }
    assert.ok(!isUsLocation("Remote", "Canada"));
  });
  it("does not treat words like 'IN' or 'OR' inside names as states", () => {
    assert.ok(!isUsLocation("Berlin, Germany"));
  });
});

describe("jobFingerprint", () => {
  it("merges the same posting across sources", () => {
    const a = jobFingerprint("Patch My PC", "Cloud Security Engineer", "Remote");
    const b = jobFingerprint("Patch My PC, Inc.", "Cloud Security Engineer - Remote", "Remote, US");
    assert.equal(a, b);
    assert.equal(
      jobFingerprint("Guidehouse", "Sr. Cloud Security Engineer", "San Antonio, Texas, USA"),
      jobFingerprint("Guidehouse", "Senior Cloud Security Engineer", "San Antonio, TX"),
    );
  });
  it("keeps different roles and cities apart", () => {
    assert.notEqual(
      jobFingerprint("Acme", "Security Engineer", "Austin, TX"),
      jobFingerprint("Acme", "Senior Security Engineer", "Austin, TX"),
    );
    assert.notEqual(jobFingerprint("Acme", "Security Engineer", "Austin, TX"), jobFingerprint("Acme", "Security Engineer", "Denver, CO"));
  });
});

describe("htmlToText", () => {
  it("handles double-encoded Greenhouse HTML", () => {
    const html = "&lt;p&gt;We &amp;amp; you&lt;/p&gt;&lt;ul&gt;&lt;li&gt;AWS&lt;/li&gt;&lt;li&gt;IAM&lt;/li&gt;&lt;/ul&gt;";
    assert.equal(htmlToText(html), "We & you\n\n• AWS\n• IAM");
  });
  it("drops scripts and styles", () => {
    assert.equal(htmlToText("<p>Hi</p><script>alert(1)</script><style>p{}</style>"), "Hi");
  });
  it("decodes numeric entities safely", () => {
    assert.equal(htmlToText("Security&#43; &#x2014; ok &#99999999;"), "Security+ — ok");
  });
});

describe("normalizeInboxJob", () => {
  const base = {
    title: "Cloud Security Engineer",
    company: "Patch My PC",
    location: "Remote",
    url: "https://to.indeed.com/aa8xmqtgpjzs",
    description: "<p>Engineer Microsoft Defender for Cloud and Entra ID controls.</p>",
  };
  it("accepts a valid job and converts HTML descriptions", () => {
    const j = normalizeInboxJob({ ...base, sponsor: false, postedAt: "2026-09-28" }, "indeed");
    assert.ok(j);
    assert.equal(j.source, "indeed");
    assert.equal(j.description, "Engineer Microsoft Defender for Cloud and Entra ID controls.");
    assert.equal(j.sponsor, false);
    assert.equal(j.postedAt, "2026-09-28T00:00:00.000Z");
  });
  it("rejects unsafe or incomplete jobs", () => {
    assert.equal(normalizeInboxJob({ ...base, url: "javascript:alert(1)" }, "dice"), null);
    assert.equal(normalizeInboxJob({ ...base, url: "http://insecure.example.com" }, "dice"), null);
    assert.equal(normalizeInboxJob({ ...base, title: "" }, "dice"), null);
    assert.equal(normalizeInboxJob("nope", "dice"), null);
    assert.equal(normalizeInboxJob(null, "dice"), null);
  });
  it("falls back to 'other' for unknown sources and clamps sizes", () => {
    const j = normalizeInboxJob({ ...base, title: "x".repeat(1000), postedAt: "not a date" }, "evil-source");
    assert.ok(j);
    assert.equal(j.source, "other");
    assert.equal(j.title.length, 200);
    assert.equal(j.postedAt, null);
  });
});
