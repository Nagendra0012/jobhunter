import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { emptyPortfolio, exampleCaseStudy, newCaseStudy, sanitizePortfolio, type PortfolioData } from "../src/lib/portfolio";
import { coverage, esc, renderPortfolioHtml, safeHref, securityTxt } from "../src/lib/portfolio-render";
import { emptyDoc, type ResumeDoc } from "../src/lib/resume-doc";

const doc = (): ResumeDoc => {
  const d = emptyDoc();
  d.contact = { ...d.contact, name: "Alex Rivera", headline: "Cloud Security Engineer", email: "alex@example.com", location: "Austin, TX", linkedin: "linkedin.com/in/alex" };
  d.experience = [{ id: "e1", title: "Cloud Security Engineer", company: "Acme", location: "Austin, TX", start: "Jan 2023", end: "Present", bullets: ["Built guardrails"] }];
  d.skills = [{ id: "s1", label: "Cloud", items: "AWS, Azure" }];
  d.certifications = [{ id: "c1", name: "Security+", issuer: "CompTIA", date: "2022" }];
  return d;
};

const realCase = () => {
  const c = exampleCaseStudy();
  delete c.example;
  return c;
};

const inlineBlock = (html: string, tag: "style" | "script") => {
  const m = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  assert.ok(m, `missing <${tag}>`);
  return m[1];
};

describe("portfolio renderer security", () => {
  it("pins the inline style and script by SHA-256 in the CSP", async () => {
    const data: PortfolioData = { ...emptyPortfolio(), caseStudies: [realCase()] };
    const html = await renderPortfolioHtml(data, doc());
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
    for (const tag of ["style", "script"] as const) {
      const hash = createHash("sha256").update(inlineBlock(html, tag)).digest("base64");
      assert.ok(csp.includes(`'sha256-${hash}'`), `${tag} hash missing from CSP`);
    }
    assert.match(csp, /default-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    // Exactly one inline style and script; no style attributes or inline handlers.
    assert.equal(html.match(/<style>/g)?.length, 1);
    assert.equal(html.match(/<script>/g)?.length, 1);
    assert.doesNotMatch(html, /\sstyle="/);
    assert.doesNotMatch(html, /\son[a-z]+="/i);
    // No external resources.
    assert.doesNotMatch(html, /<(link|img|iframe)\b|src="https?:/i);
  });

  it("escapes every user field (XSS)", async () => {
    const evil = `<img src=x onerror=alert(1)>"'&`;
    const c = realCase();
    c.title = evil;
    c.summary = evil;
    c.scenario = evil;
    c.detection = evil;
    c.fix = evil;
    c.impact = [evil];
    c.tools = evil;
    c.chain[0].note = evil;
    c.chain[0].technique = evil.slice(0, 12);
    const d = doc();
    d.contact.name = evil;
    d.contact.headline = evil;
    d.experience[0].bullets = [evil];
    d.skills[0].items = evil;
    const data: PortfolioData = { ...emptyPortfolio(), tagline: evil, about: evil, caseStudies: [c] };
    const html = await renderPortfolioHtml(data, d);
    assert.doesNotMatch(html, /<img/i);
    assert.ok(html.includes(esc(evil)));
    // Once the escaped copies are removed, no trace of the payload may remain.
    const rest = html.split(esc(evil)).join("").split(esc(evil.slice(0, 12).toUpperCase())).join("");
    assert.doesNotMatch(rest, /onerror|<img/i);
    assert.equal(html.match(/<script>/g)?.length, 1);
  });

  it("only allows https and mailto links", () => {
    assert.equal(safeHref("github.com/alex"), "https://github.com/alex");
    assert.equal(safeHref("https://linkedin.com/in/alex"), "https://linkedin.com/in/alex");
    assert.equal(safeHref("alex@example.com"), "mailto:alex@example.com");
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "http://insecure.com", "vbscript:x", "https://", "localhost", ""]) {
      assert.equal(safeHref(bad), null, bad);
    }
  });

  it("drops dangerous links from the page", async () => {
    const c = realCase();
    c.link = "javascript:alert(document.cookie)";
    const d = doc();
    d.contact.github = "javascript:alert(1)";
    const html = await renderPortfolioHtml({ ...emptyPortfolio(), caseStudies: [c] }, d);
    assert.doesNotMatch(html, /javascript:/i);
  });
});

describe("portfolio content", () => {
  it("leaves example case studies out of the export but shows them in preview", async () => {
    const data = emptyPortfolio(); // seeded with one example
    const exported = await renderPortfolioHtml(data, doc());
    const preview = await renderPortfolioHtml(data, doc(), { includeExamples: true });
    assert.doesNotMatch(exported, /CASE-01/);
    assert.match(preview, /CASE-01/);
    assert.match(preview, /Example case study/);
  });

  it("marks reached, blocked and unreached steps", async () => {
    const c = realCase(); // 4 steps, blocked at index 1
    const html = await renderPortfolioHtml({ ...emptyPortfolio(), caseStudies: [c] }, doc());
    assert.equal(html.match(/class="step reached"/g)?.length, 1);
    assert.equal(html.match(/class="step blocked"/g)?.length, 1);
    assert.equal(html.match(/class="step unreached"/g)?.length, 2);
    assert.match(html, /https:\/\/attack\.mitre\.org\/techniques\/T1078\/004\//);
    assert.match(html, /\.c0 \.packet\{--stop:37\.50%\}/);
  });

  it("computes ATT&CK coverage", () => {
    const c = realCase();
    const cov = coverage([c]);
    assert.equal(cov.find((t) => t.id === "TA0004")?.defended, 1);
    assert.equal(cov.find((t) => t.id === "TA0001")?.mapped, 1);
    assert.equal(cov.find((t) => t.id === "TA0040")?.mapped, 0);
  });

  it("renders without a resume", async () => {
    const html = await renderPortfolioHtml({ ...emptyPortfolio(), caseStudies: [newCaseStudy()] }, null);
    assert.match(html, /Your Name/);
    assert.doesNotMatch(html, /id="experience"/);
  });

  it("writes a valid security.txt", () => {
    const txt = securityTxt({ ...emptyPortfolio(), siteUrl: "alex.github.io" }, doc(), new Date("2026-11-02T00:00:00Z"));
    assert.match(txt, /^Contact: mailto:alex@example\.com$/m);
    assert.match(txt, /^Expires: 2027-11-02T00:00:00\.000Z$/m);
    assert.match(txt, /^Canonical: https:\/\/alex\.github\.io\/\.well-known\/security\.txt$/m);
  });
});

describe("sanitizePortfolio", () => {
  it("clamps sizes and fixes invalid values", () => {
    const p = sanitizePortfolio({
      docId: -5,
      tagline: "x".repeat(999),
      caseStudies: [
        { title: "ok", chain: [{ tactic: "TA9999", technique: "t1078" }, { tactic: "TA0004" }], blockedAt: 7, impact: "nope" },
        "garbage",
        null,
      ],
      show: { experience: "yes" },
    });
    assert.equal(p.docId, null);
    assert.equal(p.tagline.length, 200);
    assert.equal(p.caseStudies.length, 1);
    const c = p.caseStudies[0];
    assert.equal(c.chain[0].tactic, "TA0001");
    assert.equal(c.chain[0].technique, "T1078");
    assert.equal(c.blockedAt, -1, "out-of-range blockedAt resets");
    assert.deepEqual(c.impact, []);
    assert.equal(p.show.experience, true);
    assert.equal(sanitizePortfolio(null).caseStudies.length, 0);
  });
});
