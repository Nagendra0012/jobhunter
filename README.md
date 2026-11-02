# JobHunter

A personal job-hunting tool for security roles (Cybersecurity, Cloud Security, Security Engineer) in the US. It runs only on your computer.

## Phase 1 (done)
- **Resume ATS check**: upload a PDF or DOCX and get a score plus specific fixes (sections, contact info, metrics, action verbs, layout, certs, security keyword coverage).
- **Job match %**: paste a job description to get a weighted match score with matched, missing and transferable skills, cert and experience fit, red flags (clearance, citizenship, no sponsorship) and concrete suggestions.

## Resume builder (done)
- **Build an ATS-friendly resume** from your uploaded one (pre-filled) or from scratch: one column, standard headings, real text.
- **Live ATS score and per-bullet hints** while you edit (numbers, strong verbs, length, first person, date format).
- **Tailor to a job**: pick a scored job and see which of its skills, certs and terms your resume covers, updating as you type.
- **Download as Word (.docx) or PDF** (print page → Save as PDF). Both exports are tested by parsing them back like an ATS would.
- **Versions**: duplicate a base resume per job; "Use for matching" makes a version your active resume.

## Job search (phase 2)
- **Jobs page**: US security roles, sorted by match % with your active resume, with filters (source, min match, remote, hide clearance/citizenship, hide no-sponsorship) and status tracking.
- **Tracker**: Saved → Applied → Interviewing → Offer / Rejected, with a follow-up nudge after 7 days.
- **Sources**
  - *Company boards (built in)*: Greenhouse, Lever and Ashby boards of ~63 companies (Cloudflare, Okta, Wiz, Zscaler, Datadog, Snyk, 1Password, …), fetched by **Refresh jobs**. List in `src/lib/sources/boards.ts`.
  - *Connectors (via Claude)*: Indeed and Dice (ZipRecruiter once connected). Ask Claude to "fetch new security jobs from Indeed and Dice into the inbox"; it writes `data/inbox/<source>-<date>.json`, then click **Import inbox only** (or Refresh).
- The same job found on several sites is merged into one entry with an apply link per site.
- Every job is re-scored automatically when your active resume changes.

Inbox file format (validated on import; only `https://` links are accepted):
```json
{ "source": "dice", "jobs": [ { "title": "…", "company": "…", "location": "…", "url": "https://…",
  "description": "…", "remote": false, "salary": "…", "postedAt": "2026-11-02", "sponsor": false } ] }
```

## Referrals
- Every job page has a **Get a referral** panel: one-click LinkedIn people searches (recruiters, security leaders, security engineers, alumni of your school, people from your past employers).
- Add the people you pick; the app drafts a personalized connection note (kept under LinkedIn's 300-character limit) and a follow-up, using your matched skills and strongest relevant achievement. **Nothing is ever sent automatically.**
- The **People** page tracks status (to contact → contacted → replied → referred) and flags follow-ups after 5 days.
- (Apollo's people search would automate step 1, but its API needs a paid Apollo plan.)

## Portfolio (phase 3)
- **Attack-path case studies**: each project is an ATT&CK-mapped kill chain showing the step where you stopped it, plus Threat / Detection / Fix / Impact.
- **ATT&CK coverage grid** across all case studies; experience, skills and certs come from a Resume builder document.
- **Hardened static site**: one `index.html` with a hash-pinned CSP, no external requests, `security.txt`, and a `_headers` file for hosts that support it.
- **Download site (.zip)** and upload to GitHub Pages. Example case studies are never exported.

## Run it
```bash
npm install
npm run app
```
Then open http://127.0.0.1:3000. `npm run app` builds an optimized version and serves it (about 4× less JavaScript than
dev mode). While changing the code, use `npm run dev` instead for instant reloads.

```bash
npm test
```
Runs the parser, ATS, matcher and builder tests.

If styles ever look out of date while developing, stop the server and run:
```bash
npm run clean
```

## Privacy & security
- The server listens on `127.0.0.1` only, so other devices on your network can't reach it.
- Resumes and scores are stored in `data/jobhunter.db`, which is git-ignored and never uploaded anywhere.
- Uploads are capped at 8 MB and checked by file signature (real PDF/DOCX), not just extension.
- All SQL uses prepared statements. Responses send strict security headers (CSP, frame denial, nosniff).
- Server actions use Next.js's built-in origin check against CSRF.

## How the match score works
| Part | Weight | What it measures |
|---|---|---|
| Skills | 50% | JD skills found on your resume. Required skills count 3× preferred; a related tool (e.g. Sentinel for Splunk) gets half credit. |
| Experience | 20% | Your years (from date ranges) vs the years the job asks for |
| Role fit | 10% | Job title vs your target roles and past titles |
| Certifications | 10% | Only counted if the JD lists certs |
| Other keywords | 10% | Frequent JD terms outside the skill list |

Target roles live in `src/lib/profile.ts`; the skill and cert list is in `src/lib/skills.ts`.
