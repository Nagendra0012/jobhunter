"use client";

import { useActionState } from "react";
import { runMatch, type FormState } from "@/app/actions";

export function MatchForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(runMatch, {});

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="text-muted">Job title</span>
          <input
            name="jobTitle"
            className="input"
            placeholder="Cloud Security Engineer"
            maxLength={200}
            defaultValue={state.values?.jobTitle}
            required
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
          className="input min-h-72 font-mono text-xs leading-relaxed"
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
  );
}
