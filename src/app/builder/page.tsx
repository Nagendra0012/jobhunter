import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { createDoc } from "@/app/builder/actions";
import { getActiveResume, listDocs } from "@/lib/db";

export const metadata = { title: "Resume builder · JobHunter" };

export default function BuilderPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Resume builder</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Build an ATS-friendly resume: one column, standard headings, real text. Edit with a live ATS score, tailor
          copies to specific jobs, and download as Word or PDF.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <DocList />
      </Suspense>
    </div>
  );
}

async function DocList() {
  await connection();
  const docs = listDocs();
  const uploaded = getActiveResume();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <form action={createDoc.bind(null, "resume")} className="card flex flex-col gap-3">
          <h2 className="font-semibold">Start from my uploaded resume</h2>
          <p className="flex-1 text-sm text-muted">
            {uploaded
              ? `Pre-fills from ${uploaded.filename}. Check every field: parsing is best-effort.`
              : "Upload a resume on the Resume page first, or start blank."}
          </p>
          <button className="btn self-start" disabled={!uploaded}>
            Import & edit
          </button>
        </form>
        <form action={createDoc.bind(null, "blank")} className="card flex flex-col gap-3">
          <h2 className="font-semibold">Start blank</h2>
          <p className="flex-1 text-sm text-muted">An empty ATS template with example placeholders.</p>
          <button className="btn-ghost self-start">New blank resume</button>
        </form>
      </div>

      {docs.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Your resumes</h2>
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id}>
                <Link href={`/builder/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
                  <span className="min-w-0 truncate">{d.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    edited{" "}
                    {new Date(d.updatedAt.replace(" ", "T") + "Z").toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
