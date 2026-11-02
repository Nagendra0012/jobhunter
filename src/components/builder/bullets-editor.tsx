"use client";

import { useId } from "react";
import { bulletHints, HINT_TEXT } from "@/lib/resume-doc";

export function BulletsEditor({
  bullets,
  onChange,
  label = "Bullets (one per line)",
}: {
  bullets: string[];
  onChange: (b: string[]) => void;
  label?: string;
}) {
  const id = useId();
  const issues = bullets
    .map((b, i) => ({ i, b, hints: bulletHints(b) }))
    .filter((x) => x.hints.length);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <textarea
        id={id}
        className="input leading-relaxed"
        rows={Math.min(12, Math.max(3, bullets.length + 1))}
        value={bullets.join("\n")}
        placeholder={"Engineered CSPM guardrails across 45 AWS accounts, cutting critical misconfigurations 70%\nAutomated IAM access reviews with Python and Lambda, removing 1,200 unused permissions"}
        onChange={(e) => onChange(e.target.value.split("\n").map((l) => l.replace(/^\s*[•●▪*\-–]\s*/, "")))}
      />
      {issues.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {issues.map(({ i, b, hints }) => (
            <li key={i} className="text-muted">
              <span className="text-ok">Line {i + 1}</span>{" "}
              <span className="italic">&ldquo;{b.length > 40 ? b.slice(0, 40) + "…" : b}&rdquo;</span>:{" "}
              {hints.map((h) => HINT_TEXT[h]).join("; ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
