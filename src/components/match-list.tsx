import Link from "next/link";
import { scoreColor } from "@/components/score-ring";
import type { MatchRecord } from "@/lib/db";

export function MatchList({ matches }: { matches: MatchRecord[] }) {
  return (
    <ul className="divide-y divide-border">
      {matches.map((m) => (
        <li key={m.id}>
          <Link href={`/match/${m.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
            <span className="min-w-0">
              <span className="block truncate text-sm">{m.jobTitle}</span>
              <span className="block truncate text-xs text-muted">{m.company ?? "—"}</span>
            </span>
            <span className="font-mono text-sm font-semibold" style={{ color: scoreColor(m.score) }}>
              {m.score}%
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
