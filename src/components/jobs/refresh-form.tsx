"use client";

import { useActionState } from "react";
import { refreshJobsAction, type RefreshState } from "@/app/jobs/actions";

export function RefreshForm() {
  const [state, action, pending] = useActionState<RefreshState, FormData>(refreshJobsAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button className="btn" name="boards" value="all" disabled={pending}>
        {pending ? "Refreshing… (up to a minute)" : "Refresh jobs"}
      </button>
      <button className="btn-ghost" name="boards" value="inbox-only" disabled={pending} title="Only import jobs Claude fetched via connectors">
        Import inbox only
      </button>
      {state.message && <span className="text-sm text-good">{state.message}</span>}
      {state.error && <span className="text-sm text-bad">{state.error}</span>}
    </form>
  );
}
