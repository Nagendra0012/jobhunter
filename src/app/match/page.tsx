import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MatchForm } from "@/components/match-form";
import { MatchList } from "@/components/match-list";
import { getActiveResume, listMatches } from "@/lib/db";

export const metadata = { title: "Match a job · JobHunter" };

export default function MatchPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Match a job</h1>
        <p className="mt-1 text-sm text-muted">
          Paste a job posting to see how well your active resume matches it and what to change.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <MatchContent />
      </Suspense>
    </div>
  );
}

async function MatchContent() {
  await connection();
  const resume = getActiveResume();
  const matches = listMatches();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card lg:col-span-2">
        {resume ? (
          <>
            <p className="mb-4 text-xs text-muted">
              Matching against <span className="text-foreground">{resume.filename}</span>
            </p>
            <MatchForm />
          </>
        ) : (
          <p className="text-sm">
            <Link href="/resume" className="text-accent underline">
              Upload your resume
            </Link>{" "}
            first, then come back to score jobs.
          </p>
        )}
      </section>
      <aside className="card space-y-3">
        <h2 className="font-semibold">Past matches</h2>
        {matches.length === 0 && <p className="text-sm text-muted">None yet.</p>}
        <MatchList matches={matches} />
      </aside>
    </div>
  );
}
