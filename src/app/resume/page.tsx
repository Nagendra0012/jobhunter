import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { activateResume, removeResume } from "@/app/actions";
import { ImprovePanel } from "@/components/improve-panel";
import { MatchForm } from "@/components/match-form";
import { MatchList } from "@/components/match-list";
import { ScoreRing } from "@/components/score-ring";
import { UploadForm } from "@/components/upload-form";
import { UNREADABLE_WORDS, type AtsCheck } from "@/lib/ats";
import { getActiveResume, listMatches, listResumes, type ResumeRecord } from "@/lib/db";
import { gapsFromResults } from "@/lib/improve";
import { topScoredJobs } from "@/lib/jobs-db";
import { docFromParsed } from "@/lib/resume-doc";

export const metadata = { title: "Resume · JobHunter" };

const TABS = { report: "ATS report", improve: "Improve", match: "Match a job" } as const;
type Tab = keyof typeof TABS;

export default function ResumePage({ searchParams }: PageProps<"/resume">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Resume</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <ResumeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const SEVERITY_STYLE: Record<AtsCheck["severity"], string> = {
  critical: "bg-bad/15 text-bad",
  warning: "bg-ok/15 text-ok",
  tip: "bg-accent/15 text-accent",
};

async function ResumeContent({ searchParams }: { searchParams: PageProps<"/resume">["searchParams"] }) {
  await connection();
  const resume = getActiveResume();

  if (!resume) {
    return (
      <div className="card max-w-xl space-y-3">
        <p className="text-sm text-muted">
          Upload your resume (PDF or DOCX) to get an ATS score and a match % on every job.
        </p>
        <UploadForm />
      </div>
    );
  }

  const raw = (await searchParams).tab;
  const tab: Tab = typeof raw === "string" && raw in TABS ? (raw as Tab) : "report";
  const { parsed, ats } = resume;
  const failed = ats.checks.filter((c) => !c.passed).length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <section className="card flex flex-col gap-5 sm:flex-row sm:items-center">
          <ScoreRing score={ats.score} label="ATS score" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{parsed.name ?? resume.filename}</h2>
            <p className="text-sm text-muted">
              ~{parsed.yearsExperience} yrs experience · {parsed.skills.length} skills · {parsed.certs.length} certs
            </p>
            <p className="text-sm">
              {failed ? (
                <Link href="/resume" className="text-ok underline">
                  {failed} {failed === 1 ? "thing" : "things"} to fix
                </Link>
              ) : (
                <span className="text-good">All ATS checks passed</span>
              )}
            </p>
          </div>
        </section>

        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm" aria-label="Resume sections">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <Link
              key={t}
              href={t === "report" ? "/resume" : `/resume?tab=${t}`}
              aria-current={tab === t ? "page" : undefined}
              className={`flex-1 rounded-md px-3 py-1.5 text-center ${tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {TABS[t]}
            </Link>
          ))}
        </nav>

        {tab === "report" && <Report resume={resume} />}
        {tab === "improve" && <Improve resume={resume} />}
        {tab === "match" && <Match />}
      </div>

      <Sidebar resume={resume} />
    </div>
  );
}

function Report({ resume }: { resume: ResumeRecord }) {
  const { parsed, ats } = resume;
  const order = ["critical", "warning", "tip"];
  const failed = ats.checks.filter((c) => !c.passed).sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const passed = ats.checks.filter((c) => c.passed);
  const byCategory = Map.groupBy(parsed.skills, (s) => s.category);

  return (
    <>
      {failed.length > 0 && (
        <section className="card space-y-4">
          <h2 className="font-semibold">Fix these</h2>
          <ul className="space-y-4">
            {failed.map((c) => (
              <li key={c.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`chip ${SEVERITY_STYLE[c.severity]}`}>{c.severity}</span>
                  <span className="font-medium">{c.label}</span>
                </div>
                <p className="text-sm text-muted">{c.detail}</p>
                {c.fix && <p className="text-sm">{c.fix}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="font-semibold">Skills an ATS will find</h2>
        {parsed.skills.length === 0 && <p className="text-sm text-muted">No recognized skills.</p>}
        {[...byCategory.entries()].map(([cat, skills]) => (
          <div key={cat}>
            <h3 className="mb-1.5 text-xs uppercase tracking-wide text-muted">{cat}</h3>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s.name} className="chip bg-surface-2 text-foreground">
                  {s.name}
                  {s.count > 1 && <span className="ml-1 text-muted">×{s.count}</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
        {parsed.certs.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs uppercase tracking-wide text-muted">Certifications</h3>
            <div className="flex flex-wrap gap-1.5">
              {parsed.certs.map((c) => (
                <span key={c} className="chip bg-accent/15 text-accent">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {passed.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">
            Passed checks <span className="text-sm font-normal text-muted">({passed.length})</span>
          </summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {passed.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="text-good">✓</span> {c.label}
                <span className="block pl-4 text-xs text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Improve({ resume }: { resume: ResumeRecord }) {
  const { parsed } = resume;
  if (parsed.wordCount < UNREADABLE_WORDS) {
    return <p className="card text-sm text-muted">Upload a readable resume first: this one has almost no text.</p>;
  }
  const topJobs = topScoredJobs(20);
  return (
    <section className="card space-y-4">
      <p className="text-sm text-muted">
        Add the skills and details your target jobs ask for, fix weak bullets, and watch both scores change before
        you save.
      </p>
      <ImprovePanel
        doc={docFromParsed(parsed)}
        name={`${parsed.name?.trim() || "My resume"} – improved`}
        gaps={gapsFromResults(topJobs.flatMap((j) => (j.result ? [j.result] : [])))}
        targets={topJobs.map((j) => ({
          id: String(j.id),
          label: `${j.score}% · ${j.title} – ${j.company}`.slice(0, 100),
          title: j.title,
          jd: j.description,
        }))}
      />
    </section>
  );
}

function Match() {
  const matches = listMatches(10);
  return (
    <>
      <section className="card space-y-4">
        <p className="text-sm text-muted">
          Paste a posting to see how well your resume fits it, which required skills are missing, and what to change.
        </p>
        <MatchForm inline />
      </section>
      {matches.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Past matches</h2>
          <MatchList matches={matches} />
        </section>
      )}
    </>
  );
}

function Sidebar({ resume }: { resume: ResumeRecord }) {
  const { parsed } = resume;
  const all = listResumes();
  return (
    <aside className="space-y-6">
      <section className="card space-y-3">
        <h2 className="font-semibold">Upload a new version</h2>
        <UploadForm compact />
      </section>

      {all.length > 1 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Versions</h2>
          <ul className="space-y-2 text-sm">
            {all.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {r.isActive && <span className="text-accent">● </span>}
                  {r.filename} <span className="text-muted">({r.ats.score}%)</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {!r.isActive && (
                    <form action={activateResume.bind(null, r.id)}>
                      <button className="btn-ghost !px-2 !py-0.5 text-xs">Use</button>
                    </form>
                  )}
                  <form action={removeResume.bind(null, r.id)}>
                    <button className="btn-ghost !px-2 !py-0.5 text-xs hover:!border-bad hover:!text-bad">Delete</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card text-sm">
        <summary className="cursor-pointer font-semibold">What the parser read</summary>
        <div className="mt-3 space-y-2">
          <Row k="Email" v={parsed.contact.email} />
          <Row k="Phone" v={parsed.contact.phone} />
          <Row k="LinkedIn" v={parsed.contact.linkedin} />
          <Row k="GitHub" v={parsed.contact.github} />
          <Row k="Location" v={parsed.contact.location} />
          <Row k="Titles" v={parsed.titles.join(", ") || null} />
          <Row k="Sections" v={Object.keys(parsed.sections).filter((s) => s !== "other").join(", ") || null} />
        </div>
      </details>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`min-w-0 truncate text-right ${v ? "" : "text-bad"}`}>{v ?? "not found"}</span>
    </div>
  );
}
