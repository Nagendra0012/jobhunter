import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobLevel, statedYears } from "../src/lib/level";

const req = (s: string) => `About the role\nWe protect our cloud.\nRequirements\n${s}\nBenefits: 401k, and you have 10 years to exercise your options.`;

describe("statedYears", () => {
  it("reads common requirement phrasings", () => {
    assert.equal(statedYears(req("• 3+ years of experience in cloud security")), 3);
    assert.equal(statedYears(req("• 2-4 years in security operations")), 2);
    assert.equal(statedYears(req("• 0–1 yrs experience with Python")), 0);
    assert.equal(statedYears(req("• 5+ years Cloud, 1-2+ years AI Security")), 5, "first stated requirement wins");
    assert.equal(statedYears(req("• Minimum 6 years of relevant experience")), 6);
  });

  it("ignores years that are not experience requirements", () => {
    assert.equal(statedYears(req("• Must be at least 18 years old")), null);
    assert.equal(statedYears(req("• Strong Python skills")), null, "benefits text '10 years to exercise' is not a requirement");
  });
});

describe("jobLevel", () => {
  const cases: [string, string, string][] = [
    ["Security Engineer, New Grad 2027", req("• BS in CS"), "grad"],
    ["Early Career Cybersecurity Analyst", req("• Curiosity"), "grad"],
    ["Security Engineer", req("We hire recent college graduates for this program."), "grad"],
    ["Associate Cyber Engineer (Agentic SOC)", req("• 2+ years in security operations"), "entry"],
    ["Junior Cloud Security Engineer", req("• Python"), "entry"],
    ["Security Engineer I", req("• 1+ years of experience"), "entry"],
    ["Security Engineer", req("• 2+ years of hands-on experience"), "entry"],
    ["Security Engineer II", req("• 3+ years of experience"), "mid"],
    ["Security Engineer", req("• 3-5 years of experience"), "mid"],
    ["Senior Security Engineer", req("• 1+ years of experience"), "senior"],
    ["Cloud Security Engineer", req("• 7+ years of hands-on experience"), "senior"],
    ["Staff Detection Engineer", req("• Python"), "senior"],
    ["Security Engineer III", req("• Python"), "senior"],
    ["Security Engineer, Privy", req("• Strong Python"), "unknown"],
  ];
  for (const [title, jd, want] of cases) {
    it(`${title} → ${want}`, () => assert.equal(jobLevel(title, jd), want));
  }
});
