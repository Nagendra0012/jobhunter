// End-to-end strength check: a strong, a weak and an image-only resume for
// the same (fictional) engineer must be ranked clearly and for the right reasons.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { checkAts, type AtsReport } from "../src/lib/ats";
import { extractText } from "../src/lib/extract";
import { matchResume } from "../src/lib/matcher";
import { parseResume, type ParsedResume } from "../src/lib/resume-parser";

type Loaded = { text: string; parsed: ParsedResume; ats: AtsReport };

async function load(name: string): Promise<Loaded> {
  const bytes = new Uint8Array(fs.readFileSync(path.join(import.meta.dirname, "fixtures", name)));
  const { text, hasTables, hasImages } = await extractText({ name, bytes });
  const parsed = parseResume(text);
  return { text, parsed, ats: checkAts(parsed, text, { hasTables, hasImages, fileType: name.split(".").pop()! }) };
}

const JD = `Cloud Security Engineer
Requirements
- 5+ years of experience in cloud security
- AWS security: GuardDuty, Security Hub, IAM, KMS, AWS Config
- Terraform and Python automation
- SIEM experience with Splunk or Microsoft Sentinel
- Kubernetes security and incident response
Preferred
- AWS Certified Security - Specialty or CCSP
- Threat modeling and SOC 2 experience
You will partner with engineering teams to build guardrails, detections and secure architecture reviews.`;

const failed = (r: Loaded) => r.ats.checks.filter((c) => !c.passed).map((c) => c.id);

describe("resume strength: strong vs weak vs image-only", () => {
  let strong: Loaded, weak: Loaded, image: Loaded;
  before(async () => {
    [strong, weak, image] = await Promise.all([load("strong.pdf"), load("weak.docx"), load("image-only.pdf")]);
  });

  it("strong resume passes every ATS check", () => {
    assert.equal(strong.ats.score, 100, `failed: ${failed(strong)}`);
    assert.equal(strong.parsed.name, "Morgan Patel");
    assert.ok(strong.parsed.skills.length >= 30);
    assert.equal(strong.parsed.certs.length, 4);
  });

  it("weak resume scores low and is told exactly why", () => {
    assert.ok(weak.ats.score <= 15, `score ${weak.ats.score}`);
    for (const id of ["sections", "layout", "symbols", "weak", "pronouns", "metrics", "certs", "contact"]) {
      assert.ok(failed(weak).includes(id), `expected "${id}" to be flagged`);
    }
    const parseable = weak.ats.checks.find((c) => c.id === "parseable")!;
    assert.doesNotMatch(parseable.fix ?? "", /image-based/, "readable-but-short text is not image-based");
    assert.match(weak.ats.checks.find((c) => c.id === "metrics")!.detail, /No bullet points detected/);
  });

  it("image-only resume is treated as blank", () => {
    assert.ok(image.parsed.wordCount < 30);
    assert.equal(image.ats.score, 0);
    assert.equal(image.ats.checks.length, 1, "no trivially-passing checks on empty text");
    assert.match(image.ats.checks[0].fix ?? "", /image-based/);
  });

  it("job match ranks them in the right order with clear gaps", () => {
    const s = matchResume(strong.parsed, strong.text, "Cloud Security Engineer", JD);
    const w = matchResume(weak.parsed, weak.text, "Cloud Security Engineer", JD);
    const i = matchResume(image.parsed, image.text, "Cloud Security Engineer", JD);
    assert.ok(s.score >= 80, `strong ${s.score}`);
    assert.ok(w.score <= 50, `weak ${w.score}`);
    assert.ok(s.score - w.score >= 30, `gap ${s.score - w.score}`);
    assert.equal(i.score, 0);
    assert.ok(i.flags.some((f) => /can't be read/.test(f)));
  });
});
