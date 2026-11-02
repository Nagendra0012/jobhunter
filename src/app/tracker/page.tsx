import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusSelect } from "@/components/jobs/status-select";
import { scoreColor } from "@/components/score-ring";
import { listJobs } from "@/lib/jobs-db";
import { STATUS_LABELS, type JobStatus } from "@/lib/jobs-util";

export const metadata = { title: "Tracker · JobHunter" };

const COLUMNS: JobStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

export default function TrackerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Application tracker</h1>
        <p className="mt-1 text-sm text-muted">Move jobs along with the status menu. Follow up on anything applied 7+ days ago.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Board />
      </Suspense>
    </div>
  );
}

function daysSince(sqlDate: string | null) {
  if (!sqlDate) return null;
  const t = new Date(sqlDate.replace(" ", "T") + "Z").getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
}

async function Board() {
  await connection();
  const jobs = listJobs({ statuses: COLUMNS, includeClosed: true, sort: "date", limit: 1000 });

  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
      {COLUMNS.map((col) => {
        const items = jobs.filter((j) => j.status === col);
        return (
          <section key={col} className="space-y-2">
            <h2 className="flex items-center justify-between text-sm font-semibold">
              {STATUS_LABELS[col]} <span className="text-muted">{items.length}</span>
            </h2>
            {items.length === 0 && <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">Empty</p>}
            {items.map((j) => {
              const days = daysSince(j.statusAt);
              const followUp = col === "applied" && days != null && days >= 7;
              return (
                <div key={j.id} className="card space-y-2 !p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/jobs/${j.id}`} className="text-sm font-medium hover:text-accent">
                      {j.title}
                    </Link>
                    {j.score != null && (
                      <span className="font-mono text-xs" style={{ color: scoreColor(j.score) }}>
                        {j.score}%
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted">{j.company}</p>
                  {days != null && (
                    <p className={`text-xs ${followUp ? "text-ok" : "text-muted"}`}>
                      {followUp ? `Applied ${days} days ago: follow up` : `${days === 0 ? "today" : `${days}d ago`}`}
                    </p>
                  )}
                  <StatusSelect id={j.id} status={j.status} compact />
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
