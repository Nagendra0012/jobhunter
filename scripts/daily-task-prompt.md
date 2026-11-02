Daily job pull for the JobHunter app in N:\jobhunter (a local Next.js app for a job seeker targeting Cybersecurity Engineer, Cloud Security Engineer and Security Engineer roles in the United States).

Goal: fetch fresh full-time US security engineering jobs from the Indeed and Dice connectors into the app's inbox, then refresh the app. The job seeker is a new graduate (M.S. Cybersecurity, Dec 2026) with internship experience, so entry-level and new-grad roles matter most.

Rules (strict):
- Only read job listings. Never apply to jobs, message anyone, or create accounts.
- Only write files inside N:\jobhunter\data\inbox\. Only run the two npm commands named below.
- Do not use Apollo or any other connector. If the ZipRecruiter connector is available, you may also use it the same way (source "ziprecruiter").
- Copy job text faithfully. Never invent or embellish job details.

Steps:
1. In N:\jobhunter run `npm run known-jobs`. It prints "Company | Title" for every job already in the app. Skip those postings later (match loosely: same company and essentially the same title).
2. Dice connector (search_jobs): run three searches, keywords "Cloud Security Engineer", "Cybersecurity Engineer" and "Security Engineer"; location "United States"; posted_date "THREE"; employment_types ["FULLTIME"]; jobs_per_page 25. Then run four early-career searches the same way but with posted_date "SEVEN": "Junior Security Engineer", "Entry Level Cybersecurity", "Associate Security Engineer" and "New Grad Security".
3. Indeed connector (search_jobs): run the same seven keywords with location "remote" and country_code "US", job_type "fulltime".
4. From all results keep only postings that: are full-time; are in the US or US-remote; have a security engineering title (not sales, recruiting, management/director, intern, or "AI Trainer"/data-annotation gigs); are not already known (step 1); are not duplicates of each other.
5. Pick up to 15 per source. At least half of the picks must be entry-level or new-grad roles when enough exist: titles with Junior, Jr, Associate, Entry Level, New Grad, Graduate, Early Career, or a level "I", or postings asking for 0–2 years of experience. Skip postings that ask for 5+ years when choosing these. Then prefer direct-hire employers, remote or hybrid roles, and the newest postings. For each, call the connector's get_job_details (Dice: pass the job's guid; Indeed: the Job Id) to get the full description.
6. Write one JSON file per source to N:\jobhunter\data\inbox\<source>-<YYYY-MM-DD>.json (source is "dice" or "indeed"; use today's date). If that name exists, add "-2". Format:
   {"source": "dice", "fetchedAt": "<YYYY-MM-DD>", "jobs": [{"externalId": "<guid or job id>", "title": "...", "company": "...", "location": "<City, ST or Remote>", "remote": true|false, "url": "<https apply/details link>", "salary": "<as listed or omit>", "postedAt": "<YYYY-MM-DD or ISO>", "sponsor": <Dice willingToSponsor as true/false; omit for Indeed>, "description": "<plain text>"}]}
   Description: plain text of the role, responsibilities, requirements, preferred qualifications, clearance/citizenship/sponsorship statements and work location. Leave out benefits lists, EEO/legal boilerplate and company marketing. For Dice links, drop the "?utm_..." query string. Only https links.
   Skip a source's file entirely if it has no new jobs.
7. Run `npm run daily` in N:\jobhunter. It imports the inbox, refreshes ~63 company job boards, scores everything against the active resume, and prints the new jobs.
8. Finish with a short report: how many new jobs came from each source (and how many of those are entry-level or new-grad), any source that failed, and the top new matches exactly as `npm run daily` printed them (score, title, company, link). If nothing new, say so in one line.
