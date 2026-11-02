"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { createImprovedResume } from "@/app/builder/actions";
import { scoreColor } from "@/components/score-ring";
import { checkAts } from "@/lib/ats";
import {
  applyImprovements,
  hasImprovements,
  noImprovements,
  weakBullets,
  type ContactField,
  type Gap,
  type Gaps,
  type Improvements,
} from "@/lib/improve";
import { matchResume } from "@/lib/matcher";
import { docToText, HINT_TEXT, type ResumeDoc } from "@/lib/resume-doc";
import { parseResume } from "@/lib/resume-parser";

export type ImproveTarget = {
  id: string;
  label: string;
  title: string;
  jd: string;
};

const CONTACT_LABELS: Record<ContactField, string> = {
  email: "Email",
  phone: "Phone",
  location: "City, State",
  linkedin: "LinkedIn URL",
  github: "GitHub URL",
};

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

function scoreDoc(doc: ResumeDoc, targets: ImproveTarget[]) {
  const text = docToText(doc);
  const parsed = parseResume(text);
  return {
    ats: checkAts(parsed, text, {
      hasTables: false,
      hasImages: false,
      fileType: "builder",
    }).score,
    match: avg(targets.map((t) => matchResume(parsed, text, t.title, t.jd).score)),
  };
}

export function ImprovePanel({
  doc,
  name,
  gaps,
  targets,
}: {
  doc: ResumeDoc;
  name: string;
  gaps: Gaps;
  targets: ImproveTarget[];
}) {
  const [imp, setImp] = useState<Improvements>(noImprovements);
  const [extra, setExtra] = useState("");
  const [target, setTarget] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const weak = useMemo(() => weakBullets(doc), [doc]);
  const missingContact = (Object.keys(CONTACT_LABELS) as ContactField[]).filter((f) => !doc.contact[f].trim());

  const full = useMemo<Improvements>(() => {
    const typed = extra
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length <= 60);
    return { ...imp, skills: [...imp.skills, ...typed] };
  }, [imp, extra]);
  const improved = useMemo(() => applyImprovements(doc, full), [doc, full]);
  const deferred = useDeferredValue(improved);

  const chosen = useMemo(
    () => (target === "all" ? targets : targets.filter((t) => t.id === target)),
    [targets, target],
  );
  // "Before" is the same builder layout without changes, so deltas show only what the user added.
  const before = useMemo(() => scoreDoc(doc, chosen), [doc, chosen]);
  const after = useMemo(() => scoreDoc(deferred, chosen), [deferred, chosen]);

  const toggle = (key: "skills" | "certs", value: string) =>
    setImp((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }));

  const changed = hasImprovements(full);
  const stale = deferred !== improved;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <ScoreDelta label="ATS score" before={before.ats} after={after.ats} stale={stale} />
        {targets.length > 0 && (
          <ScoreDelta
            label={target === "all" ? `Avg match, your top ${targets.length} jobs` : "Match for this job"}
            before={before.match}
            after={after.match}
            stale={stale}
          >
            {targets.length > 1 && (
              <select
                className="input mt-2 !py-1 text-xs"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-label="Measure match against"
              >
                <option value="all">Average of top {targets.length} jobs</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </ScoreDelta>
        )}
      </div>

      <p className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-xs">
        Only add what you have really used. Recruiters and interviewers ask about every skill on your resume.
      </p>

      {gaps.skills.length > 0 && (
        <Section
          title="Skills these jobs ask for"
          hint={`From your top ${gaps.jobs} jobs. Tick the ones you have; the number is how many of those jobs ask for it.`}
        >
          <ChipList gaps={gaps.skills} selected={imp.skills} onToggle={(v) => toggle("skills", v)} jobs={gaps.jobs} />
        </Section>
      )}

      {gaps.keywords.length > 0 && (
        <Section title="Keywords they use" hint="Terms from the postings that your resume never says.">
          <ChipList gaps={gaps.keywords} selected={imp.skills} onToggle={(v) => toggle("skills", v)} jobs={gaps.jobs} />
        </Section>
      )}

      <Section title="Other skills you have" hint="Comma-separated, e.g. Burp Suite, Terraform">
        <input
          className="input"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          maxLength={500}
          placeholder="Skill, skill, skill"
        />
      </Section>

      {gaps.certs.length > 0 && (
        <Section
          title="Certifications they ask for"
          hint="Tick only the ones you hold (or say “in progress” in the builder)."
        >
          <ChipList gaps={gaps.certs} selected={imp.certs} onToggle={(v) => toggle("certs", v)} jobs={gaps.jobs} />
        </Section>
      )}

      {weak.length > 0 && (
        <Section
          title="Bullets to strengthen"
          hint="Start with a strong verb and add a number: what, how, and the result."
        >
          <ul className="space-y-4">
            {weak.map((b) => (
              <li key={b.key} className="space-y-1.5">
                <p className="text-xs text-muted">
                  {b.where} · <span className="text-ok">{b.hints.map((h) => HINT_TEXT[h]).join("; ")}</span>
                </p>
                <textarea
                  className="input min-h-16 text-sm"
                  defaultValue={b.text}
                  maxLength={400}
                  aria-label={`Bullet from ${b.where}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    setImp((p) => {
                      const bullets = { ...p.bullets };
                      if (v.trim() && v !== b.text) bullets[b.key] = v;
                      else delete bullets[b.key];
                      return { ...p, bullets };
                    });
                  }}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(missingContact.length > 0 || !doc.summary.trim()) && (
        <Section title="Missing basics" hint="ATS filters and recruiters look for these first.">
          <div className="grid gap-3 sm:grid-cols-2">
            {missingContact.map((f) => (
              <label key={f} className="space-y-1 text-sm">
                <span className="text-muted">{CONTACT_LABELS[f]}</span>
                <input
                  className="input"
                  maxLength={200}
                  value={imp.contact[f] ?? ""}
                  onChange={(e) =>
                    setImp((p) => ({
                      ...p,
                      contact: { ...p.contact, [f]: e.target.value },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {!doc.summary.trim() && (
            <textarea
              className="input mt-3 min-h-20 text-sm"
              placeholder="2–3 lines: your target role, years and focus, and 2–3 core tools."
              maxLength={800}
              value={imp.summary}
              onChange={(e) => setImp((p) => ({ ...p, summary: e.target.value }))}
            />
          )}
        </Section>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          className="btn"
          disabled={!changed || pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const err = await createImprovedResume(name, improved);
              if (err) setError(err);
            })
          }
        >
          {pending ? "Saving…" : "Create improved version"}
        </button>
        <p className="min-w-0 flex-1 text-xs text-muted">
          Saves a new resume in the builder (download it as Word or PDF there) and uses it for job matching. Your upload
          stays under Versions.
        </p>
        {error && <p className="w-full text-sm text-bad">{error}</p>}
      </div>
    </div>
  );
}

function ScoreDelta({
  label,
  before,
  after,
  stale,
  children,
}: {
  label: string;
  before: number;
  after: number;
  stale: boolean;
  children?: React.ReactNode;
}) {
  const diff = after - before;
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${stale ? "opacity-60" : ""}`} aria-live="polite">
        <span className="text-muted">{before}%</span> → <span style={{ color: scoreColor(after) }}>{after}%</span>
        {diff !== 0 && (
          <span className={`ml-2 text-sm ${diff > 0 ? "text-good" : "text-bad"}`}>
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        )}
      </p>
      {children}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function ChipList({
  gaps,
  selected,
  onToggle,
  jobs,
}: {
  gaps: Gap[];
  selected: string[];
  onToggle: (name: string) => void;
  jobs: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {gaps.map((g) => {
        const on = selected.includes(g.name);
        return (
          <button
            key={g.name}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(g.name)}
            title={`${g.count} of ${jobs} jobs${g.required ? `, required in ${g.required}` : ""}`}
            className={`chip border ${on ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface-2 text-foreground hover:border-accent"}`}
          >
            {on ? "✓ " : "+ "}
            {g.name}
            <span className="ml-1 text-muted">{g.count}</span>
            {g.required > 0 && <span className="ml-1 text-bad">req</span>}
          </button>
        );
      })}
    </div>
  );
}
