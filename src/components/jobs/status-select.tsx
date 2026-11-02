"use client";

import { useTransition } from "react";
import { updateJobStatus } from "@/app/jobs/actions";
import { JOB_STATUSES, STATUS_LABELS, type JobStatus } from "@/lib/jobs-util";

export function StatusSelect({ id, status, compact = false }: { id: number; status: JobStatus; compact?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Status"
      className={`input !w-auto ${compact ? "!px-2 !py-1 text-xs" : ""} ${pending ? "opacity-50" : ""}`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(() => updateJobStatus(id, next));
      }}
    >
      {JOB_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
