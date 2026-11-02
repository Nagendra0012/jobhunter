# JobHunter

A personal job-hunting tool for security roles (Cybersecurity, Cloud Security, Security Engineer) in the US. It runs only on your computer.

## Phase 1 (done)
- **Resume ATS check**: upload a PDF or DOCX and get a score plus specific fixes (sections, contact info, metrics, action verbs, layout, certs, security keyword coverage).
- **Job match %**: paste a job description to get a weighted match score with matched, missing and transferable skills, cert and experience fit, red flags (clearance, citizenship, no sponsorship) and concrete suggestions.

## Run it
```bash
npm install
npm run dev
```
Then open http://127.0.0.1:3000.

```bash
npm test
```
Runs the parser, ATS and matcher tests.

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
