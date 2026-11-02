import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MatchList } from "@/components/match-list";
import { ScoreRing, scoreColor } from "@/components/score-ring";
import { getActiveResume, listMatches } from "@/lib/db";
import { jobStats, listJobs } from "@/lib/jobs-db";
import { STATUS_LABELS } from "@/lib/jobs-util";
import { TARGET_LOCATION, TARGET_ROLES } from "@/lib/profile";

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Targeting {TARGET_ROLES.join(" · ")} in {TARGET_LOCATION}
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  await connection();
  const resume = getActiveResume();
  const matches = listMatches(8);
  const avg = matches.length ? Math.round(matches.reduce((s, m) => s + m.score, 0) / matches.length) : null;
  const stats = jobStats();
  const topJobs = listJobs({ statuses: ["new"], minScore: 60, limit: 5 });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="card space-y-4 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Job search</h2>
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span>
              <b className="text-foreground">{stats.total}</b> open
            </span>
            <span>
              <b className="text-good">{stats.strong}</b> strong new matches
            </span>
            {(["saved", "applied", "interview", "offer"] as const).map((s) => (
              <span key={s}>
                <b className="text-foreground">{stats.byStatus[s] ?? 0}</b> {STATUS_LABELS[s].toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        {topJobs.length ? (
          <ul className="divide-y divide-border">
            {topJobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{j.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {j.company} · {j.location || "Remote"}
                    </span>
                  </span>
                  <span className="font-mono text-sm font-semibold" style={{ color: scoreColor(j.score ?? 0) }}>
                    {j.score}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No strong new matches yet.{" "}
            <Link href="/jobs" className="text-accent underline">
              Go to Jobs
            </Link>{" "}
            and refresh.
          </p>
        )}
      </section>
      <section className="card flex items-center gap-6">
        {resume ? (
          <>
            <ScoreRing score={resume.ats.score} label="ATS" />
            <div className="space-y-2">
              <h2 className="font-semibold">Your resume</h2>
              <p className="text-sm text-muted">{resume.filename}</p>
              <p className="text-sm">
                {resume.ats.checks.filter((c) => !c.passed).length} issues to fix
              </p>
              <Link href="/resume" className="btn-ghost">
                View ATS report
              </Link>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold">Start here</h2>
            <p className="text-sm text-muted">Upload your resume to get an ATS score and start matching jobs.</p>
            <Link href="/resume" className="btn">
              Upload resume
            </Link>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent matches</h2>
          {avg != null && <span className="text-xs text-muted">avg {avg}%</span>}
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted">
            No jobs scored yet.{" "}
            <Link href="/match" className="text-accent underline">
              Match a job
            </Link>
          </p>
        ) : (
          <MatchList matches={matches} />
        )}
      </section>
    </div>
  );
}
