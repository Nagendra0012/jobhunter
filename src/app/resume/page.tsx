import { connection } from "next/server";
import { Suspense } from "react";
import { activateResume, removeResume } from "@/app/actions";
import { ScoreRing } from "@/components/score-ring";
import { UploadForm } from "@/components/upload-form";
import type { AtsCheck } from "@/lib/ats";
import { getActiveResume, listResumes } from "@/lib/db";

export const metadata = { title: "Resume · JobHunter" };

export default function ResumePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Resume</h1>
        <p className="mt-1 text-sm text-muted">
          Upload your resume to get an ATS report. The newest upload becomes your active resume for job matching.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <ResumeContent />
      </Suspense>
    </div>
  );
}

const SEVERITY_STYLE: Record<AtsCheck["severity"], string> = {
  critical: "bg-bad/15 text-bad",
  warning: "bg-ok/15 text-ok",
  tip: "bg-accent/15 text-accent",
};

async function ResumeContent() {
  await connection();
  const resume = getActiveResume();
  const all = listResumes();

  if (!resume) {
    return (
      <div className="card max-w-xl">
        <UploadForm />
      </div>
    );
  }

  const { parsed, ats } = resume;
  const failed = ats.checks
    .filter((c) => !c.passed)
    .sort((a, b) => ["critical", "warning", "tip"].indexOf(a.severity) - ["critical", "warning", "tip"].indexOf(b.severity));
  const passed = ats.checks.filter((c) => c.passed);
  const byCategory = Map.groupBy(parsed.skills, (s) => s.category);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={ats.score} label="ATS score" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{parsed.name ?? resume.filename}</h2>
            <p className="text-sm text-muted">{resume.filename}</p>
            <p className="text-sm">
              ~{parsed.yearsExperience} yrs experience · {parsed.skills.length} skills · {parsed.certs.length} certs ·{" "}
              {parsed.wordCount} words
            </p>
            <p className="text-xs text-muted">
              {failed.length ? `${failed.length} things to fix, ${passed.length} checks passed.` : "All checks passed."}
            </p>
          </div>
        </section>

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

        <section className="card space-y-3">
          <h2 className="font-semibold">Passed</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {passed.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="text-good">✓</span> {c.label}
                <span className="block pl-4 text-xs text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        </section>

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
      </div>

      <aside className="space-y-6">
        <section className="card space-y-3">
          <h2 className="font-semibold">Upload a new version</h2>
          <UploadForm compact />
        </section>

        <section className="card space-y-2 text-sm">
          <h2 className="font-semibold">What the parser read</h2>
          <Row k="Email" v={parsed.contact.email} />
          <Row k="Phone" v={parsed.contact.phone} />
          <Row k="LinkedIn" v={parsed.contact.linkedin} />
          <Row k="GitHub" v={parsed.contact.github} />
          <Row k="Location" v={parsed.contact.location} />
          <Row k="Titles" v={parsed.titles.join(", ") || null} />
          <Row k="Sections" v={Object.keys(parsed.sections).filter((s) => s !== "other").join(", ") || null} />
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
      </aside>
    </div>
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
