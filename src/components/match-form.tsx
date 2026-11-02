"use client";

import Link from "next/link";
import { useActionState } from "react";
import { runMatch, type FormState } from "@/app/actions";
import { FlagChips, ScoreBreakdown, SkillPanels } from "@/components/match-breakdown";
import { ScoreRing } from "@/components/score-ring";

// `inline` scores in place and shows the result under the form (Resume page);
// otherwise the action redirects to the saved match page.
export function MatchForm({ inline = false }: { inline?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(runMatch, {});
  const m = state.match;

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        {inline && <input type="hidden" name="inline" value="1" />}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="text-muted">Job title{inline && " (optional)"}</span>
            <input
              name="jobTitle"
              className="input"
              placeholder="Cloud Security Engineer"
              maxLength={200}
              defaultValue={state.values?.jobTitle}
              required={!inline}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted">Company (optional)</span>
            <input
              name="company"
              className="input"
              placeholder="Acme Corp"
              maxLength={200}
              defaultValue={state.values?.company}
            />
          </label>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Job description</span>
          <textarea
            name="jd"
            defaultValue={state.values?.jd}
            className={`input font-mono text-xs leading-relaxed ${inline ? "min-h-48" : "min-h-72"}`}
            placeholder="Paste the full job description, including requirements and preferred qualifications."
            maxLength={60000}
            required
          />
        </label>
        <div className="flex items-center gap-3">
          <button className="btn" disabled={pending}>
            {pending ? "Scoring…" : "Score my match"}
          </button>
          {state.error && <p className="text-sm text-bad">{state.error}</p>}
        </div>
      </form>

      {m && !pending && (
        <div className="space-y-6 border-t border-border pt-6" aria-live="polite">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ScoreRing score={m.result.score} label={m.result.verdict} />
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-semibold">
                {m.result.score}% match · {m.jobTitle}
              </h3>
              <FlagChips flags={m.result.flags} />
              <Link href={`/match/${m.id}`} className="text-sm text-accent underline">
                Open saved result
              </Link>
            </div>
          </div>
          <ScoreBreakdown result={m.result} />
          <SkillPanels result={m.result} />
        </div>
      )}
    </div>
  );
}
