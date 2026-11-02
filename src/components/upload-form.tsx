"use client";

import { useActionState, useState } from "react";
import { uploadResume, type FormState } from "@/app/actions";

export function UploadForm({ compact = false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadResume, {});
  const [name, setName] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-3">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-2/50 text-center transition hover:border-accent ${compact ? "p-4" : "p-10"}`}
      >
        <input
          type="file"
          name="resume"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
          required
        />
        <span className="text-sm font-medium">{name ?? "Click to choose your resume"}</span>
        <span className="text-xs text-muted">PDF or DOCX, up to 8 MB. Stays on this computer.</span>
      </label>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending || !name}>
          {pending ? "Analyzing…" : "Upload & analyze"}
        </button>
        {state.error && <p className="text-sm text-bad">{state.error}</p>}
      </div>
    </form>
  );
}
