import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { removeMatch } from "@/app/actions";
import { FlagChips, ScoreBreakdown, SkillPanels } from "@/components/match-breakdown";
import { ScoreRing } from "@/components/score-ring";
import { getMatch } from "@/lib/db";

export const metadata = { title: "Match result · JobHunter" };

export default function MatchResultPage({ params }: PageProps<"/match/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <MatchResult params={params} />
    </Suspense>
  );
}

async function MatchResult({ params }: { params: PageProps<"/match/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const match = getMatch(Number(id));
  if (!match) notFound();
  const r = match.result;

  return (
    <div className="space-y-6">
      <Link href="/resume?tab=match" className="text-sm text-muted hover:text-foreground">
        ← All matches
      </Link>

      <section className="card flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={r.score} size={140} label={r.verdict} />
        <div className="flex-1 space-y-2">
          <h1 className="text-xl font-semibold">{match.jobTitle}</h1>
          {match.company && <p className="text-muted">{match.company}</p>}
          <p className="text-xs text-muted">
            Scored{" "}
            {new Date(match.createdAt.replace(" ", "T") + "Z").toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <FlagChips flags={r.flags} />
        </div>
        <form action={removeMatch.bind(null, match.id)}>
          <button className="btn-ghost hover:!border-bad hover:!text-bad">Delete</button>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ScoreBreakdown result={r} />
          <details className="card">
            <summary className="cursor-pointer font-semibold">Job description</summary>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-muted">{match.jdText}</pre>
          </details>
        </div>
        <aside className="space-y-6">
          <SkillPanels result={r} />
        </aside>
      </div>
    </div>
  );
}
