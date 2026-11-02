import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotesForm } from "@/components/jobs/notes-form";
import { StatusSelect } from "@/components/jobs/status-select";
import { FlagChips, ScoreBreakdown, SkillPanels } from "@/components/match-breakdown";
import { ScoreRing } from "@/components/score-ring";
import { getJob } from "@/lib/jobs-db";
import { SOURCE_LABELS } from "@/lib/sources/types";

export const metadata = { title: "Job · JobHunter" };

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <JobDetail params={params} />
    </Suspense>
  );
}

async function JobDetail({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const job = getJob(Number(id));
  if (!job) notFound();
  const r = job.result;

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-muted hover:text-foreground">
        ← All jobs
      </Link>

      <section className="card flex flex-col gap-6 sm:flex-row sm:items-center">
        {r ? (
          <ScoreRing score={r.score} size={140} label={r.verdict} />
        ) : (
          <div className="flex h-[140px] w-[140px] items-center justify-center rounded-full border-[14px] border-surface-2 text-center text-xs text-muted">
            Not scored
          </div>
        )}
        <div className="flex-1 space-y-2">
          <h1 className="text-xl font-semibold">{job.title}</h1>
          <p className="text-muted">
            {job.company} · {job.location || (job.remote ? "Remote" : "Location not listed")}
            {job.salary && <> · {job.salary}</>}
          </p>
          {r && <FlagChips flags={r.flags} />}
          {!job.active && <p className="text-sm text-bad">This posting no longer appears on its board.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {job.links.map((l) => (
              <a
                key={l.source}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className={l.source === job.links[0]?.source ? "btn" : "btn-ghost"}
              >
                Apply on {SOURCE_LABELS[l.source] ?? l.source} ↗
              </a>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted">Status</span>
          <StatusSelect id={job.id} status={job.status} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {r ? (
            <ScoreBreakdown result={r} />
          ) : (
            <p className="card text-sm text-muted">
              No match score: either no resume is active or this posting has too little description text.
            </p>
          )}
          <section className="card space-y-2">
            <h2 className="font-semibold">Your notes</h2>
            <NotesForm id={job.id} initial={job.notes} />
          </section>
          <details className="card" open={!r}>
            <summary className="cursor-pointer font-semibold">Job description</summary>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-muted">
              {job.description || "No description available. Open the posting to read it."}
            </pre>
          </details>
        </div>
        <aside className="space-y-6">
          {r && <SkillPanels result={r} />}
          <section className="card space-y-2 text-sm">
            <h2 className="font-semibold">Tailor your resume</h2>
            <p className="text-muted">
              Duplicate your base resume in the{" "}
              <Link href="/builder" className="text-accent underline">
                Resume builder
              </Link>{" "}
              and add the missing skills you genuinely have, then download it for this application.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
