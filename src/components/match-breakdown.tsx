import { Bar } from "@/components/score-ring";
import type { MatchResult } from "@/lib/matcher";

export function ScoreBreakdown({ result }: { result: MatchResult }) {
  return (
    <>
      <section className="card space-y-4">
        <h2 className="font-semibold">Score breakdown</h2>
        {result.components.map((c) => (
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

      {result.suggestions.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">How to raise this score</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {result.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="text-xs text-muted">Only add skills you actually have. Interviewers will ask about them.</p>
        </section>
      )}
    </>
  );
}

export function FlagChips({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <li key={f} className={`chip ${/willing to sponsor/i.test(f) ? "bg-good/15 text-good" : "bg-ok/15 text-ok"}`}>
          {f}
        </li>
      ))}
    </ul>
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

export function SkillPanels({ result: r }: { result: MatchResult }) {
  return (
    <>
      <SkillList title="Missing (required)" items={r.missingRequired} tone="bad" />
      <SkillList title="Transferable" items={r.transferable.map((t) => `${t.name} ← ${t.via}`)} tone="ok" />
      <SkillList title="Matched" items={r.matchedSkills.map((s) => s.name + (s.required ? "" : " (pref.)"))} tone="good" />
      <SkillList title="Missing (preferred)" items={r.missingPreferred} tone="muted" />
      {r.certs.listed.length > 0 && (
        <SkillList
          title="Certifications mentioned"
          items={r.certs.listed.map((c) => (r.certs.matched.includes(c) ? `✓ ${c}` : c))}
          tone="muted"
        />
      )}
      <SkillList title="Job terms not in your resume" items={r.keywords.missing} tone="muted" />
    </>
  );
}
