"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { savePortfolio } from "@/app/portfolio/actions";
import { Area, EntryControls, Field } from "@/components/builder/fields";
import {
  isTechniqueId,
  newCaseStudy,
  newStep,
  TACTICS,
  type CaseStudy,
  type PortfolioData,
  type TacticId,
} from "@/lib/portfolio";
import { renderPortfolioHtml } from "@/lib/portfolio-render";
import type { ResumeDoc } from "@/lib/resume-doc";

type SaveState = "saved" | "unsaved" | "saving" | "error";

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function PortfolioEditor({
  initial,
  docs,
}: {
  initial: PortfolioData;
  docs: { id: number; name: string; doc: ResumeDoc }[];
}) {
  const [data, setData] = useState(initial);
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(initial.caseStudies[0]?.id ?? null);
  const [html, setHtml] = useState("");

  // Autosave, same pattern as the resume builder.
  const version = useRef(0);
  const latest = useRef(data);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const v = version.current;
    setSave("saving");
    const res = await savePortfolio(latest.current);
    if (v !== version.current) return res.ok;
    setSave(res.ok ? "saved" : "error");
    setError(res.ok ? null : res.error);
    return res.ok;
  }, []);
  const first = useRef(true);
  useEffect(() => {
    latest.current = data;
    if (first.current) {
      first.current = false;
      return;
    }
    version.current++;
    setSave("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  }, [data, flush]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // Live preview renders the exact HTML that gets exported (examples included, flagged).
  const deferred = useDeferredValue(data);
  const doc = docs.find((d) => d.id === deferred.docId)?.doc ?? null;
  useEffect(() => {
    let cancelled = false;
    renderPortfolioHtml(deferred, doc, { includeExamples: true }).then((h) => {
      if (!cancelled) setHtml(h);
    });
    return () => {
      cancelled = true;
    };
  }, [deferred, doc]);

  const update = (fn: (d: PortfolioData) => void) =>
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const updateCase = (i: number, fn: (c: CaseStudy) => void) => update((d) => fn(d.caseStudies[i]));

  const examples = data.caseStudies.filter((c) => c.example).length;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 !py-3">
        <h1 className="text-lg font-semibold">Portfolio</h1>
        <span
          role="status"
          className={`text-xs ${save === "error" ? "text-bad" : save === "saved" ? "text-good" : "text-muted"}`}
        >
          {save === "saved" ? "✓ Saved" : save === "saving" ? "Saving…" : save === "unsaved" ? "Editing…" : error}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              if (save !== "saved" && !(await flush())) return;
              // A file download, not a page navigation.
              const a = document.createElement("a");
              a.href = "/portfolio/export";
              a.download = "portfolio-site.zip";
              a.click();
            }}
          >
            Download site (.zip)
          </button>
        </div>
      </div>

      {examples > 0 && (
        <p className="rounded-lg border border-ok/40 bg-ok/10 px-4 py-2 text-sm text-ok">
          {examples} example case {examples === 1 ? "study is" : "studies are"} shown in the preview but left out of the
          download. Replace it with your own project, then click &ldquo;This is my real project&rdquo;.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <section className="card space-y-3">
            <h2 className="font-semibold">Profile</h2>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Name, contact, experience, skills and certs come from</span>
              <select
                className="input"
                value={data.docId ?? ""}
                onChange={(e) => update((d) => void (d.docId = e.target.value ? Number(e.target.value) : null))}
              >
                <option value="">No resume (case studies only)</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {docs.length === 0 && (
              <p className="text-xs text-muted">
                Create a resume in the{" "}
                <Link href="/builder" className="text-accent underline">
                  Resume builder
                </Link>{" "}
                first; the portfolio reuses it.
              </p>
            )}
            <Field
              label="Tagline (one line, what you do)"
              value={data.tagline}
              onChange={(v) => update((d) => void (d.tagline = v))}
              placeholder="I break attack paths before attackers walk them."
            />
            <Area
              label="About (2–4 sentences)"
              value={data.about}
              rows={3}
              onChange={(v) => update((d) => void (d.about = v))}
              placeholder="Cloud security engineer focused on AWS guardrails and detection. I like turning one-off fixes into code that keeps whole classes of bugs from coming back."
            />
            <div className="flex flex-wrap gap-4 text-sm text-muted">
              {(["experience", "skills", "certifications", "education"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={data.show[k]}
                    onChange={(e) => update((d) => void (d.show[k] = e.target.checked))}
                    className="accent-[var(--accent)]"
                  />
                  Show {k}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Attack-path case studies</h2>
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() => {
                  const c = newCaseStudy();
                  update((d) => void d.caseStudies.push(c));
                  setOpen(c.id);
                }}
              >
                + Case study
              </button>
            </div>
            <p className="text-xs text-muted">
              Good sources: a misconfiguration you fixed at work, a detection you wrote, a home-lab attack you simulated
              and caught, or a CTF. Only describe work you actually did; interviewers will dig in.
            </p>

            {data.caseStudies.map((c, i) => (
              <div key={c.id} className="card space-y-3 !p-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium hover:text-accent"
                    onClick={() => setOpen(open === c.id ? null : c.id)}
                    aria-expanded={open === c.id}
                  >
                    {open === c.id ? "▾" : "▸"} {c.title || "Untitled case study"}
                    {c.example && <span className="chip ml-2 bg-ok/15 text-ok">example</span>}
                  </button>
                  <EntryControls
                    index={i}
                    count={data.caseStudies.length}
                    onMove={(dir) => update((d) => void (d.caseStudies = move(d.caseStudies, i, dir)))}
                    onRemove={() => update((d) => void d.caseStudies.splice(i, 1))}
                  />
                </div>

                {open === c.id && (
                  <div className="space-y-3">
                    {c.example && (
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => updateCase(i, (x) => void delete x.example)}
                      >
                        ✓ This is my real project (include it in the download)
                      </button>
                    )}
                    <Field label="Title" value={c.title} onChange={(v) => updateCase(i, (x) => void (x.title = v))} placeholder="Stopping privilege escalation through over-permissive IAM roles" />
                    <Field label="One-line summary" value={c.summary} onChange={(v) => updateCase(i, (x) => void (x.summary = v))} placeholder="Closed an AWS escalation path before it reached production data." />
                    <Area label="Threat: what could an attacker do?" value={c.scenario} rows={3} onChange={(v) => updateCase(i, (x) => void (x.scenario = v))} />

                    <div className="space-y-2">
                      <span className="text-xs text-muted">Attack chain: pick the step where you stopped it</span>
                      {c.chain.map((s, si) => (
                        <div key={s.id} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[auto_11rem_7rem_1fr_auto] sm:items-center">
                          <label className="flex items-center gap-1.5 text-xs text-muted" title="Blocked at this step">
                            <input
                              type="radio"
                              name={`blocked-${c.id}`}
                              checked={c.blockedAt === si}
                              onChange={() => updateCase(i, (x) => void (x.blockedAt = si))}
                              className="accent-[var(--bad)]"
                            />
                            blocked
                          </label>
                          <select
                            aria-label="Tactic"
                            className="input !py-1.5 text-sm"
                            value={s.tactic}
                            onChange={(e) => updateCase(i, (x) => void (x.chain[si].tactic = e.target.value as TacticId))}
                          >
                            {TACTICS.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label="ATT&CK technique ID"
                            className={`input !py-1.5 font-mono text-sm ${s.technique && !isTechniqueId(s.technique) ? "!border-ok" : ""}`}
                            value={s.technique}
                            placeholder="T1078"
                            maxLength={12}
                            onChange={(e) => updateCase(i, (x) => void (x.chain[si].technique = e.target.value))}
                          />
                          <input
                            aria-label="What happens at this step"
                            className="input !py-1.5 text-sm"
                            value={s.note}
                            placeholder="What the attacker does here"
                            maxLength={200}
                            onChange={(e) => updateCase(i, (x) => void (x.chain[si].note = e.target.value))}
                          />
                          <button
                            type="button"
                            className="btn-ghost !px-2 !py-0.5 text-xs"
                            onClick={() =>
                              updateCase(i, (x) => {
                                x.chain.splice(si, 1);
                                if (x.blockedAt >= x.chain.length) x.blockedAt = x.chain.length - 1;
                                else if (si < x.blockedAt) x.blockedAt--;
                              })
                            }
                            aria-label="Remove step"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {c.chain.length < 8 && (
                        <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => updateCase(i, (x) => void x.chain.push(newStep("TA0010")))}>
                          + Step
                        </button>
                      )}
                      {c.chain.some((s) => s.technique && !isTechniqueId(s.technique)) && (
                        <p className="text-xs text-ok">Technique IDs look like T1078 or T1078.004 (they link to attack.mitre.org).</p>
                      )}
                    </div>

                    <Area label="Detection: how was it found?" value={c.detection} rows={2} onChange={(v) => updateCase(i, (x) => void (x.detection = v))} />
                    <Area label="Fix: what did you change?" value={c.fix} rows={2} onChange={(v) => updateCase(i, (x) => void (x.fix = v))} />
                    <Area
                      label="Impact (one metric per line)"
                      value={c.impact.join("\n")}
                      rows={3}
                      onChange={(v) => updateCase(i, (x) => void (x.impact = v.split("\n").slice(0, 6)))}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Tools (comma separated)" value={c.tools} onChange={(v) => updateCase(i, (x) => void (x.tools = v))} placeholder="AWS Config, Terraform, Splunk" />
                      <Field label="Write-up or repo link (optional)" value={c.link} onChange={(v) => updateCase(i, (x) => void (x.link = v))} placeholder="github.com/you/project" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Publishing</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Site URL (optional)" value={data.siteUrl} onChange={(v) => update((d) => void (d.siteUrl = v))} placeholder="https://yourname.github.io" />
              <Field
                label="security.txt contact (defaults to your email)"
                value={data.securityContact}
                onChange={(v) => update((d) => void (d.securityContact = v))}
                placeholder="you@email.com"
              />
            </div>
            <p className="text-xs text-muted">
              The download is a folder you can upload to GitHub Pages as-is. Instructions are in its README.
            </p>
          </section>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <iframe
            title="Portfolio preview"
            className="h-[80vh] w-full rounded-xl border border-border bg-[#0a0e14]"
            sandbox="allow-scripts"
            srcDoc={html}
          />
        </div>
      </div>
    </div>
  );
}
