import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { removeMatch } from "@/app/actions";
import { Bar, ScoreRing } from "@/components/score-ring";
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
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const match = getMatch(Number(id));
  if (!match) notFound();
  const r = match.result;

  return (
    <div className="space-y-6">
      <Link href="/match" className="text-sm text-muted hover:text-foreground">
        ← All matches
      </Link>

      <section className="card flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={r.score} size={140} label={r.verdict} />
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-semibold">{match.jobTitle}</h1>
          {match.company && <p className="text-muted">{match.company}</p>}
          <p className="text-xs text-muted">
            Scored{" "}
            {new Date(match.createdAt.replace(" ", "T") + "Z").toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          {r.flags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-2">
              {r.flags.map((f) => (
                <li key={f} className="chip bg-ok/15 text-ok">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
        <form action={removeMatch.bind(null, match.id)}>
          <button className="btn-ghost hover:!border-bad hover:!text-bad">Delete</button>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card space-y-4">
            <h2 className="font-semibold">Score breakdown</h2>
            {r.components.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>
                    {c.label} <span className="text-xs text-muted">({c.weight}% weight)</span>
                  </span>
                  <span className="font-mono">{c.score}%</span>
                </div>
                <Bar value={c.score} />
                <p className="text-xs text-muted">{c.detail}</p>
              </div>
            ))}
          </section>

          {r.suggestions.length > 0 && (
            <section className="card space-y-3">
              <h2 className="font-semibold">How to raise this score</h2>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {r.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="text-xs text-muted">Only add skills you actually have. Interviewers will ask about them.</p>
            </section>
          )}

          <details className="card">
            <summary className="cursor-pointer font-semibold">Job description</summary>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-muted">{match.jdText}</pre>
          </details>
        </div>

        <aside className="space-y-6">
          <SkillList title="Missing (required)" items={r.missingRequired} tone="bad" />
          <SkillList
            title="Transferable"
            items={r.transferable.map((t) => `${t.name} ← ${t.via}`)}
            tone="ok"
          />
          <SkillList
            title="Matched"
            items={r.matchedSkills.map((s) => s.name + (s.required ? "" : " (pref.)"))}
            tone="good"
          />
          <SkillList title="Missing (preferred)" items={r.missingPreferred} tone="muted" />
          {r.certs.listed.length > 0 && (
            <SkillList
              title="Certifications mentioned"
              items={r.certs.listed.map((c) => (r.certs.matched.includes(c) ? `✓ ${c}` : c))}
              tone="muted"
            />
          )}
          <SkillList title="Job terms not in your resume" items={r.keywords.missing} tone="muted" />
        </aside>
      </div>
    </div>
  );
}

const TONE = {
  good: "bg-good/15 text-good",
  ok: "bg-ok/15 text-ok",
  bad: "bg-bad/15 text-bad",
  muted: "bg-surface-2 text-foreground",
};

function SkillList({ title, items, tone }: { title: string; items: string[]; tone: keyof typeof TONE }) {
  if (!items.length) return null;
  return (
    <section className="card space-y-2">
      <h2 className="text-sm font-semibold">
        {title} <span className="text-muted">({items.length})</span>
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className={`chip ${TONE[tone]}`}>
            {i}
          </span>
        ))}
      </div>
    </section>
  );
}
