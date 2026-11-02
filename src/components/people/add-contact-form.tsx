"use client";

import { useActionState, useEffect, useRef } from "react";
import { addContact, type AddContactState } from "@/app/people/actions";
import { CONTACT_ROLES } from "@/lib/outreach";

export function AddContactForm({ jobId }: { jobId: number }) {
  const [state, action, pending] = useActionState<AddContactState, FormData>(addContact, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" className="input" placeholder="Name (e.g. Jordan Lee)" maxLength={100} required />
        <input name="title" className="input" placeholder="Their title" maxLength={150} />
        <input name="profileUrl" className="input" placeholder="linkedin.com/in/…" maxLength={300} />
        <select name="role" className="input" defaultValue="recruiter" aria-label="Role">
          {Object.entries(CONTACT_ROLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-ghost" disabled={pending}>
          {pending ? "Adding…" : "+ Add person"}
        </button>
        {state.error && <span className="text-sm text-bad">{state.error}</span>}
      </div>
    </form>
  );
}
