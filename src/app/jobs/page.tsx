import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RefreshForm } from "@/components/jobs/refresh-form";
import { StatusSelect } from "@/components/jobs/status-select";
import { scoreColor } from "@/components/score-ring";
import { getActiveResume } from "@/lib/db";
import { countJobs, jobStats, lastRun, listJobs, type JobFilters } from "@/lib/jobs-db";
import type { JobStatus } from "@/lib/jobs-util";
import { LEVEL_LABELS, type JobLevel } from "@/lib/level";
import { isSourceId, SOURCE_LABELS } from "@/lib/sources/types";

export const metadata = { title: "Jobs · JobHunter" };

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="mt-1 text-sm text-muted">
            US security roles from company boards plus Indeed and Dice (via Claude&apos;s connectors), scored against
            your active resume.
          </p>
        </div>
        <RefreshForm />
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading jobs…</p>}>
        <JobsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const PAGE_SIZE = 50;

// Experience filter: URL value → levels shown.
const LEVELS: Record<string, { label: string; levels: JobLevel[] }> = {
  entry: { label: "Entry level & new grad", levels: ["grad", "entry"] },
  grad: { label: "New grad only", levels: ["grad"] },
  upto: { label: "Up to mid level", levels: ["grad", "entry", "mid"] },
  nosenior: { label: "Hide senior", levels: ["grad", "entry", "mid", "unknown"] },
};

const LEVEL_CHIP: Partial<Record<JobLevel, string>> = {
  grad: "bg-good/15 text-good",
  entry: "bg-good/15 text-good",
  mid: "bg-surface-2 text-muted",
  senior: "bg-surface-2 text-muted",
};

const VIEWS: Record<string, { label: string; statuses: JobStatus[] }> = {
  inbox: { label: "To review", statuses: ["new", "saved"] },
  saved: { label: "Saved", statuses: ["saved"] },
  pipeline: { label: "Applied & beyond", statuses: ["applied", "interview", "offer"] },
  all: { label: "All", statuses: [] },
  hidden: { label: "Hidden / rejected", statuses: ["hidden", "rejected"] },
};

async function JobsContent({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const view = VIEWS[one(sp.view)] ? one(sp.view) : "inbox";
  const source = one(sp.source);
  const minScore = Number(one(sp.min));
  const level = LEVELS[one(sp.level)] ? one(sp.level) : "";
  const filters: JobFilters = {
    q: one(sp.q).slice(0, 100),
    minScore: Number.isFinite(minScore) && minScore > 0 && minScore <= 100 ? minScore : undefined,
    source: isSourceId(source) ? source : "",
    statuses: VIEWS[view].statuses,
    remoteOnly: one(sp.remote) === "1",
    hideNoSponsor: one(sp.sponsor) === "1",
    hideClearance: one(sp.clearance) === "1",
    levels: level ? LEVELS[level].levels : undefined,
    sort: one(sp.sort) === "date" ? "date" : "score",
  };
  const total = countJobs(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNum = Math.min(Math.max(1, Math.floor(Number(one(sp.page))) || 1), pages);
  const jobs = listJobs({ ...filters, limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE });
  const stats = jobStats();
  const run = lastRun();
  const resume = getActiveResume();

  // Same query string with some keys replaced (switching view resets to page 1).
  const hrefWith = (changes: Record<string, string>) => {
    const p = new URLSearchParams(
      Object.entries(sp).flatMap(([k, val]) => (k in changes || k === "page" ? [] : [[k, one(val)]])),
    );
    for (const [k, v] of Object.entries(changes)) if (v) p.set(k, v);
    return `/jobs?${p}`;
  };
  const viewHref = (v: string) => hrefWith({ view: v });

  return (
    <div className="space-y-4">
      {resume && resume.ats.score < 60 && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm">
          <b className="text-bad">Your active resume scores {resume.ats.score}% on ATS checks.</b> Match % assumes an ATS
          reads your resume correctly; with this file, many will mangle or reject it first.{" "}
          <Link href="/resume" className="text-accent underline">
            Fix the ATS issues
          </Link>{" "}
          or rebuild it in the{" "}
          <Link href="/builder" className="text-accent underline">
            Resume builder
          </Link>
          .
        </p>
      )}
      {!resume && (
        <p className="card text-sm">
          <Link href="/resume" className="text-accent underline">
            Upload a resume
          </Link>{" "}
          to get a match % on every job.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        <span>
          <b className="text-foreground">{stats.total}</b> open jobs
        </span>
        <span>
          <b className="text-good">{stats.strong}</b> new strong matches (70%+)
        </span>
        {run && (
          <span title={run.sources.map((s) => `${s.label}: ${s.error ?? s.found}`).join("\n")}>
            Last refresh {new Date(run.finishedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {run.sources.some((s) => s.error) && (
              <span className="text-ok"> · {run.sources.filter((s) => s.error).length} source errors</span>
            )}
          </span>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
        {Object.entries(VIEWS).map(([key, v]) => (
          <Link
            key={key}
            href={viewHref(key)}
            className={`rounded-md px-3 py-1.5 ${view === key ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {v.label}
            {key === "saved" && stats.byStatus.saved ? ` (${stats.byStatus.saved})` : ""}
          </Link>
        ))}
      </nav>

      <form className="card grid gap-3 !p-4 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_12rem_9rem_9rem_auto]" action="/jobs">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={filters.q} placeholder="Search title or company" className="input" maxLength={100} />
        <select name="source" defaultValue={filters.source} className="input" aria-label="Source">
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select name="level" defaultValue={level} className="input" aria-label="Experience level">
          <option value="">Any experience</option>
          {Object.entries(LEVELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select name="min" defaultValue={filters.minScore ?? ""} className="input" aria-label="Minimum match">
          <option value="">Any match</option>
          <option value="50">50%+</option>
          <option value="60">60%+</option>
          <option value="70">70%+</option>
          <option value="80">80%+</option>
        </select>
        <select name="sort" defaultValue={filters.sort} className="input" aria-label="Sort">
          <option value="score">Best match</option>
          <option value="date">Newest</option>
        </select>
        <button className="btn">Filter</button>
        <div className="flex flex-wrap gap-4 text-sm sm:col-span-2 lg:col-span-6">
          <Check name="remote" label="Remote only" checked={filters.remoteOnly} />
          <Check name="sponsor" label="Hide “no visa sponsorship”" checked={filters.hideNoSponsor} />
          <Check name="clearance" label="Hide clearance / citizenship required" checked={filters.hideClearance} />
        </div>
      </form>

      {jobs.length === 0 && level ? (
        <p className="card text-sm text-muted">
          No {LEVELS[level].label.toLowerCase()} postings match yet. Most company boards post senior roles; the daily
          pull now also searches Indeed and Dice for junior, associate and new-grad security roles.{" "}
          <Link href={hrefWith({ level: level === "grad" ? "entry" : "upto" })} className="text-accent underline">
            Widen the filter
          </Link>
          .
        </p>
      ) : jobs.length === 0 ? (
        <p className="card text-sm text-muted">
          No jobs here yet. Click <b className="text-foreground">Refresh jobs</b> to pull from company boards, or ask
          Claude to &ldquo;fetch jobs from Indeed and Dice&rdquo; and then <b className="text-foreground">Import inbox</b>.
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li key={j.id} className="card flex flex-col gap-3 !p-4 sm:flex-row sm:items-center">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-lg font-semibold"
                style={{ color: j.score == null ? "var(--muted)" : scoreColor(j.score) }}
                title={j.score == null ? "Not scored (no resume or too little description)" : "Match with your resume"}
              >
                {j.score == null ? "–" : `${j.score}%`}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/jobs/${j.id}`} className="font-medium hover:text-accent">
                  {j.title}
                </Link>
                <p className="truncate text-sm text-muted">
                  {j.company} · {j.location || (j.remote ? "Remote" : "—")}
                  {j.salary && <> · {j.salary}</>}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {j.links.map((l) => (
                    <span key={l.source} className="chip bg-surface-2 text-muted">
                      {SOURCE_LABELS[l.source] ?? l.source}
                    </span>
                  ))}
                  {LEVEL_CHIP[j.level] && <span className={`chip ${LEVEL_CHIP[j.level]}`}>{LEVEL_LABELS[j.level]}</span>}
                  {j.remote && <span className="chip bg-accent/15 text-accent">Remote</span>}
                  {j.sponsor === true && !j.noSponsor && <span className="chip bg-good/15 text-good">Sponsors visa</span>}
                  {j.noSponsor && <span className="chip bg-ok/15 text-ok">No sponsorship</span>}
                  {j.needsClearance && <span className="chip bg-ok/15 text-ok">Clearance/citizenship</span>}
                  {!j.active && <span className="chip bg-bad/15 text-bad">Closed</span>}
                  {j.postedAt && (
                    <span className="text-xs text-muted">
                      posted {new Date(j.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <StatusSelect id={j.id} status={j.status} compact />
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pages">
          <span className="text-muted">
            {(pageNum - 1) * PAGE_SIZE + 1}–{Math.min(pageNum * PAGE_SIZE, total)} of {total}
          </span>
          <span className="flex gap-2">
            {pageNum > 1 ? (
              <Link className="btn-ghost" href={hrefWith({ page: String(pageNum - 1) })}>
                ← Previous
              </Link>
            ) : null}
            <span className="px-2 py-1.5 text-muted">
              Page {pageNum} of {pages}
            </span>
            {pageNum < pages ? (
              <Link className="btn-ghost" href={hrefWith({ page: String(pageNum + 1) })}>
                Next →
              </Link>
            ) : null}
          </span>
        </nav>
      )}
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-muted">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="accent-[var(--accent)]" />
      {label}
    </label>
  );
}
