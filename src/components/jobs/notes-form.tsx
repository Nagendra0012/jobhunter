"use client";

import { useState, useTransition } from "react";
import { updateJobNotes } from "@/app/jobs/actions";

export function NotesForm({ id, initial }: { id: number; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <textarea
        className="input leading-relaxed"
        rows={4}
        maxLength={5000}
        value={notes}
        placeholder="Recruiter name, referral contact, interview dates, salary discussed…"
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        type="button"
        className="btn-ghost"
        disabled={pending || notes === saved}
        onClick={() =>
          start(async () => {
            await updateJobNotes(id, notes);
            setSaved(notes);
          })
        }
      >
        {pending ? "Saving…" : notes === saved ? "Saved" : "Save notes"}
      </button>
    </div>
  );
}
