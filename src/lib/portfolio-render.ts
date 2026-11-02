// Renders the portfolio as one self-contained, hardened HTML page.
//
// Security properties of the output (they are also the site's selling point):
// - All user text is HTML-escaped; links are limited to https: and mailto:.
// - No external requests: no CDNs, web fonts, analytics or images.
// - A Content-Security-Policy <meta> pins the single inline <style> and
//   <script> by SHA-256 hash, so nothing else can execute or style the page.
// - No inline style attributes or event handlers (they would need 'unsafe-inline').

import { type CaseStudy, type PortfolioData, TACTICS, tacticName, isTechniqueId } from "./portfolio";
import { dateRange, filled, type ResumeDoc } from "./resume-doc";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns a safe absolute URL (https: or mailto:) or null. Bare "github.com/x" gets https://. */
export function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

async function sha256Base64(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function coverage(studies: CaseStudy[]) {
  return TACTICS.map((t) => ({
    ...t,
    defended: studies.filter((c) => c.blockedAt >= 0 && c.chain[c.blockedAt]?.tactic === t.id).length,
    mapped: studies.filter((c) => c.chain.some((s) => s.tactic === t.id)).length,
  }));
}

function link(href: string | null, text: string, cls = "") {
  if (!href) return esc(text);
  const external = href.startsWith("https:");
  return `<a${cls ? ` class="${cls}"` : ""} href="${esc(href)}"${external ? ' rel="noopener noreferrer" target="_blank"' : ""}>${esc(text)}</a>`;
}

function renderCase(c: CaseStudy, i: number): string {
  const n = c.chain.length;
  const steps = c.chain
    .map((s, idx) => {
      const state = c.blockedAt < 0 ? "reached" : idx < c.blockedAt ? "reached" : idx === c.blockedAt ? "blocked" : "unreached";
      const tech = s.technique.trim().toUpperCase();
      const techHtml = isTechniqueId(tech)
        ? link(`https://attack.mitre.org/techniques/${tech.replace(".", "/")}/`, tech, "tech")
        : tech
          ? `<span class="tech">${esc(tech)}</span>`
          : "";
      return `<li class="step ${state}" tabindex="0">
        <span class="tactic">${esc(tacticName(s.tactic))}</span>${techHtml}
        ${state === "blocked" ? '<span class="shield" aria-label="Blocked here">✕ BLOCKED</span>' : ""}
        ${s.note.trim() ? `<span class="note">${esc(s.note.trim())}</span>` : ""}
      </li>`;
    })
    .join("");
  const impact = filled(c.impact);
  const tools = c.tools.split(",").map((t) => t.trim()).filter(Boolean);
  const href = safeHref(c.link);

  return `<article class="case c${i}" id="case-${pad(i + 1)}">
    ${c.example ? '<p class="example">Example case study — replace with your own (not included in export)</p>' : ""}
    <header>
      <span class="case-id">CASE-${pad(i + 1)}</span>
      <h3>${esc(c.title || "Untitled case study")}</h3>
      ${c.summary.trim() ? `<p class="summary">${esc(c.summary.trim())}</p>` : ""}
    </header>
    ${
      n
        ? `<div class="chain" role="img" aria-label="Attack chain of ${n} steps${c.blockedAt >= 0 ? `, blocked at step ${c.blockedAt + 1}` : ""}">
      ${c.blockedAt >= 0 ? '<span class="packet" aria-hidden="true"></span>' : ""}
      <ol>${steps}</ol></div>`
        : ""
    }
    <dl class="facts">
      ${c.scenario.trim() ? `<div><dt>Threat</dt><dd>${esc(c.scenario.trim())}</dd></div>` : ""}
      ${c.detection.trim() ? `<div><dt>Detection</dt><dd>${esc(c.detection.trim())}</dd></div>` : ""}
      ${c.fix.trim() ? `<div><dt>Fix</dt><dd>${esc(c.fix.trim())}</dd></div>` : ""}
    </dl>
    ${impact.length ? `<ul class="impact">${impact.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
    ${tools.length || href ? `<p class="tools">${tools.map((t) => `<span>${esc(t)}</span>`).join("")}${href ? link(href, "Write-up / code ↗", "more") : ""}</p>` : ""}
  </article>`;
}

// Per-case packet stop positions live in the stylesheet (not style attributes),
// so the strict CSP needs no 'unsafe-inline'.
function caseCss(studies: CaseStudy[]): string {
  return studies
    .map((c, i) => {
      if (c.blockedAt < 0 || !c.chain.length) return "";
      const stop = ((c.blockedAt + 0.5) / c.chain.length) * 100;
      return `.c${i} .chain{--n:${c.chain.length}}.c${i} .packet{--stop:${stop.toFixed(2)}%}`;
    })
    .join("");
}

const BASE_CSS = `
:root{--bg:#0a0e14;--panel:#111823;--line:#223042;--text:#e6edf3;--muted:#8b98a8;--path:#3dd6c4;--block:#ff4d5e;--dim:#3a4757;
--mono:ui-monospace,"Cascadia Code","SF Mono",Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 var(--sans)}
a{color:var(--path)}a:focus-visible,.step:focus-visible,button:focus-visible{outline:2px solid var(--path);outline-offset:3px}
main{max-width:1040px;margin:0 auto;padding:0 20px 64px}
.hero{padding:72px 0 40px;border-bottom:1px solid var(--line)}
.eyebrow{font:12px/1 var(--mono);letter-spacing:.14em;color:var(--path);margin:0 0 20px}
h1{font-size:clamp(34px,6vw,56px);line-height:1.05;margin:0}
.role{color:var(--muted);margin:8px 0 0}.tagline{font-size:clamp(19px,2.6vw,24px);margin:22px 0 0;max-width:30ch}
.links{display:flex;flex-wrap:wrap;gap:10px 18px;margin:26px 0 0;padding:0;list-style:none;font:14px var(--mono)}
section{padding:48px 0 0}h2{font:600 13px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 22px}
.about{max-width:68ch;color:#c9d4df}
.case{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:26px;margin:0 0 22px}
.case-id{font:12px var(--mono);color:var(--muted)}.case h3{font-size:22px;margin:6px 0 4px}.summary{color:var(--muted);margin:0}
.example{font:12px var(--mono);color:#fbbf24;border:1px dashed #fbbf24;border-radius:8px;padding:6px 10px;margin:0 0 14px}
.chain{position:relative;margin:24px 0 8px}
.chain ol{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:14px;list-style:none;margin:0;padding:0}
.step{position:relative;border:1px solid var(--line);border-radius:10px;padding:12px;min-height:92px;background:#0d131c}
.step:not(:last-child)::after{content:"→";position:absolute;right:-13px;top:30px;color:var(--path);font:14px var(--mono)}
.step.unreached{opacity:.45;border-style:dashed}.step.unreached::after{color:var(--dim)}
.step.blocked{border-color:var(--block);box-shadow:0 0 0 1px var(--block),0 0 24px -6px var(--block)}
.step.blocked::after{content:"✕";color:var(--block)}
.tactic{display:block;font-weight:600;font-size:14px}.tech{display:inline-block;font:12px var(--mono);margin-top:4px}
.shield{display:block;font:700 11px var(--mono);letter-spacing:.1em;color:var(--block);margin-top:6px}
.note{display:block;font-size:13px;color:var(--muted);margin-top:6px}
.packet{position:absolute;top:-10px;left:0;width:10px;height:10px;border-radius:50%;background:var(--path);box-shadow:0 0 12px var(--path);
animation:travel 2.8s ease-in-out infinite}
@keyframes travel{0%{left:0;opacity:0}10%{opacity:1}70%{left:var(--stop);opacity:1;background:var(--path)}
80%,100%{left:var(--stop);background:var(--block);box-shadow:0 0 16px var(--block);opacity:0}}
.facts{display:grid;gap:14px;margin:22px 0 0}.facts div{display:grid;grid-template-columns:110px 1fr;gap:14px}
dt{font:600 12px/1.9 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--path)}dd{margin:0;color:#c9d4df}
.impact{display:flex;flex-wrap:wrap;gap:12px;list-style:none;padding:0;margin:22px 0 0}
.impact li{border-left:3px solid var(--path);padding:4px 12px;font-weight:600;background:#0d131c;border-radius:0 8px 8px 0}
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:20px 0 0;font:12px var(--mono)}
.tools span{border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--muted)}.more{margin-left:auto}
.matrix{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.cell{border:1px solid var(--line);border-radius:8px;padding:10px;min-height:78px;font-size:12px;background:var(--panel)}
.cell b{display:block;font:11px var(--mono);color:var(--muted);font-weight:400}
.cell.mapped{border-color:#2b5f5a}.cell.defended{border-color:var(--path);background:#0f2a2a}
.cell .count{display:block;margin-top:6px;font:600 12px var(--mono);color:var(--path)}
.legend{font:12px var(--mono);color:var(--muted);margin:12px 0 0}
.timeline{list-style:none;margin:0;padding:0;border-left:1px solid var(--line)}
.timeline li{position:relative;padding:0 0 22px 22px}.timeline li::before{content:"";position:absolute;left:-5px;top:8px;width:9px;height:9px;border-radius:50%;background:var(--path)}
.when{font:12px var(--mono);color:var(--muted)}.timeline ul{margin:6px 0 0;padding-left:18px;color:#c9d4df;list-style:disc}
.timeline ul li{padding:0 0 4px}.timeline ul li::before{content:none}
.skills p{margin:0 0 8px}.skills b{color:var(--muted);font-weight:600}
.badges{display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;margin:0}
.badges li{border:1px solid var(--path);border-radius:8px;padding:8px 12px;font-size:14px}
footer{max-width:1040px;margin:0 auto;padding:28px 20px 48px;border-top:1px solid var(--line);font:12px/1.8 var(--mono);color:var(--muted)}
footer ul{display:flex;flex-wrap:wrap;gap:6px 18px;list-style:none;padding:0;margin:8px 0 0}footer li::before{content:"✓ ";color:var(--path)}
button.copy{font:12px var(--mono);background:none;border:1px solid var(--line);color:var(--text);border-radius:6px;padding:2px 8px;cursor:pointer}
@media (max-width:760px){.chain ol{grid-template-columns:1fr}.step:not(:last-child)::after{content:"↓";right:auto;left:16px;top:auto;bottom:-18px}
.packet{display:none}.facts div{grid-template-columns:1fr;gap:2px}.matrix{grid-template-columns:repeat(2,minmax(0,1fr))}.more{margin-left:0}}
@media (prefers-reduced-motion:reduce){.packet{animation:none;left:var(--stop);background:var(--block)}html{scroll-behavior:auto}}
@media print{body{background:#fff;color:#000}.packet{display:none}}`;

// Copy-email button. Progressive enhancement only: the page works without JS.
const SCRIPT = `document.querySelectorAll("button.copy").forEach(function(b){b.hidden=false;b.addEventListener("click",function(){
navigator.clipboard&&navigator.clipboard.writeText(b.getAttribute("data-copy")||"").then(function(){b.textContent="copied";
setTimeout(function(){b.textContent="copy"},1500)})})});`;

export type RenderOptions = { includeExamples: boolean };

export async function renderPortfolioHtml(
  data: PortfolioData,
  doc: ResumeDoc | null,
  opts: RenderOptions = { includeExamples: false },
): Promise<string> {
  const studies = data.caseStudies.filter((c) => opts.includeExamples || !c.example);
  const c = doc?.contact;
  const name = c?.name.trim() || "Your Name";
  const cov = coverage(studies);
  const defended = cov.filter((t) => t.defended > 0).length;

  const email = c?.email.trim() ?? "";
  const emailHref = safeHref(email);
  const linkItems = [
    emailHref ? `<li>${link(emailHref, email)} <button class="copy" type="button" data-copy="${esc(email)}" hidden>copy</button></li>` : "",
    c?.linkedin ? `<li>${link(safeHref(c.linkedin), "LinkedIn")}</li>` : "",
    c?.github ? `<li>${link(safeHref(c.github), "GitHub")}</li>` : "",
    c?.website ? `<li>${link(safeHref(c.website), c.website.replace(/^https?:\/\//, ""))}</li>` : "",
  ].join("");

  const exp = doc && data.show.experience ? doc.experience.filter((e) => e.title.trim() || e.company.trim()) : [];
  const skills = doc && data.show.skills ? doc.skills.filter((g) => g.items.trim()) : [];
  const certs = doc && data.show.certifications ? doc.certifications.filter((x) => x.name.trim()) : [];
  const edu = doc && data.show.education ? doc.education.filter((e) => e.degree.trim() || e.school.trim()) : [];

  const css = BASE_CSS + caseCss(studies);
  const [styleHash, scriptHash] = await Promise.all([sha256Base64(css), sha256Base64(SCRIPT)]);
  const csp = [
    "default-src 'none'",
    `style-src 'sha256-${styleHash}'`,
    `script-src 'sha256-${scriptHash}'`,
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");

  const description = `${name}${c?.headline ? ` – ${c.headline}` : ""}. ${data.tagline}`.slice(0, 160);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="description" content="${esc(description)}">
<title>${esc(name)}${c?.headline ? ` · ${esc(c.headline)}` : ""}</title>
<style>${css}</style>
</head>
<body>
<main>
<header class="hero">
  <p class="eyebrow">ATTACK PATHS BROKEN: ${studies.length} · TACTICS DEFENDED: ${defended}/${TACTICS.length}</p>
  <h1>${esc(name)}</h1>
  <p class="role">${esc([c?.headline, c?.location].map((x) => x?.trim()).filter(Boolean).join(" · "))}</p>
  ${data.tagline.trim() ? `<p class="tagline">${esc(data.tagline.trim())}</p>` : ""}
  ${linkItems ? `<ul class="links">${linkItems}</ul>` : ""}
</header>
${data.about.trim() ? `<section id="about"><h2>About</h2><p class="about">${esc(data.about.trim())}</p></section>` : ""}
${
  studies.length
    ? `<section id="paths"><h2>Attack paths I've broken</h2>${studies.map(renderCase).join("")}</section>
<section id="coverage"><h2>MITRE ATT&amp;CK coverage</h2><div class="matrix">${cov
        .map(
          (t) =>
            `<div class="cell${t.defended ? " defended" : t.mapped ? " mapped" : ""}"><b>${t.id}</b>${esc(t.name)}${
              t.defended ? `<span class="count">${t.defended} blocked</span>` : t.mapped ? '<span class="count">mapped</span>' : ""
            }</div>`,
        )
        .join("")}</div><p class="legend">Highlighted: tactics where my work stopped the attack chain.</p></section>`
    : ""
}
${
  exp.length
    ? `<section id="experience"><h2>Experience</h2><ol class="timeline">${exp
        .map(
          (e) => `<li><span class="when">${esc(dateRange(e.start, e.end))}</span>
      <div><strong>${esc(e.title)}</strong>${e.company ? ` · ${esc(e.company)}` : ""}${e.location ? ` · ${esc(e.location)}` : ""}</div>
      ${filled(e.bullets).length ? `<ul>${filled(e.bullets).slice(0, 3).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</li>`,
        )
        .join("")}</ol></section>`
    : ""
}
${
  skills.length
    ? `<section id="skills" class="skills"><h2>Skills</h2>${skills
        .map((g) => `<p>${g.label.trim() ? `<b>${esc(g.label.trim())}:</b> ` : ""}${esc(g.items.trim())}</p>`)
        .join("")}</section>`
    : ""
}
${
  certs.length
    ? `<section id="certifications"><h2>Certifications</h2><ul class="badges">${certs
        .map((x) => `<li>${esc(x.name)}${x.date.trim() ? ` · ${esc(x.date.trim())}` : ""}</li>`)
        .join("")}</ul></section>`
    : ""
}
${
  edu.length
    ? `<section id="education"><h2>Education</h2>${edu
        .map(
          (e) =>
            `<p><strong>${esc(e.degree)}</strong>${e.school ? ` · ${esc(e.school)}` : ""} <span class="when">${esc(dateRange(e.start, e.end))}</span></p>`,
        )
        .join("")}</section>`
    : ""
}
</main>
<footer>
  <div>This site's own security posture:</div>
  <ul><li>hash-pinned Content-Security-Policy</li><li>zero third-party requests</li><li>no cookies or trackers</li><li>no inline event handlers</li><li>security.txt published</li></ul>
</footer>
<script>${SCRIPT}</script>
</body>
</html>`;
}

export function securityTxt(data: PortfolioData, doc: ResumeDoc | null, now = new Date()): string {
  const contact = data.securityContact.trim() || doc?.contact.email.trim() || "";
  const href = safeHref(contact);
  const expires = new Date(now.getTime() + 365 * 86_400_000).toISOString();
  const site = safeHref(data.siteUrl);
  return [
    href ? `Contact: ${href}` : "# Add a contact to publish this file",
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    site ? `Canonical: ${site.replace(/\/?$/, "/")}.well-known/security.txt` : "",
  ]
    .filter(Boolean)
    .join("\n") + "\n";
}

export const DEPLOY_README = `# Portfolio site

Static, self-contained site generated by JobHunter.

## Publish free on GitHub Pages
1. Create a public repository named \`<your-username>.github.io\`.
2. Upload every file in this folder (keep the \`.well-known\` folder).
3. Visit https://<your-username>.github.io

## Security notes
- index.html carries a hash-pinned Content-Security-Policy in a <meta> tag.
- GitHub Pages cannot set HTTP headers, so clickjacking protection (frame-ancestors)
  is not available there. Host behind Cloudflare Pages or Netlify to add headers
  (a ready-made \`_headers\` file is included for those hosts).
`;

export const HEADERS_FILE = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
`;
