"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { deleteDoc, duplicateDoc, saveDoc, activateDoc } from "@/app/builder/actions";
import { BulletsEditor } from "@/components/builder/bullets-editor";
import { Area, EntryControls, Field } from "@/components/builder/fields";
import { ResumeTemplate } from "@/components/resume-template";
import { ScoreRing } from "@/components/score-ring";
import { checkAts } from "@/lib/ats";
import { docToText, isAtsDate, newId, type ResumeDoc } from "@/lib/resume-doc";
import { parseResume } from "@/lib/resume-parser";
import { findSkills } from "@/lib/skills";

export type TailorMatch = {
  id: number;
  title: string;
  company: string | null;
  score: number;
  skills: string[]; // missing required + preferred skills
  keywords: string[];
  certs: string[];
};

type SaveState = "saved" | "unsaved" | "saving" | "error";
type Tab = "preview" | "ats" | "tailor";

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const dateHint = (s: string) => (isAtsDate(s) ? null : 'Use "Jan 2023", "2023" or "Present"');

export function Editor({
  id,
  initialName,
  initialDoc,
  matches,
}: {
  id: number;
  initialName: string;
  initialDoc: ResumeDoc;
  matches: TailorMatch[];
}) {
  const [name, setName] = useState(initialName);
  const [doc, setDoc] = useState(initialDoc);
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [matchId, setMatchId] = useState<number | null>(matches[0]?.id ?? null);

  // Autosave: debounce edits; a version counter ignores out-of-order replies.
  const version = useRef(0);
  const latest = useRef({ name, doc });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const v = version.current;
    setSave("saving");
    const res = await saveDoc(id, latest.current.name, latest.current.doc);
    if (v !== version.current) return res.ok; // newer edits pending
    if (res.ok) {
      setSave("saved");
      setError(null);
    } else {
      setSave("error");
      setError(res.error);
    }
    return res.ok;
  }, [id]);

  useEffect(() => {
    latest.current = { name, doc };
    // Nothing edited yet (also covers Strict Mode's double effect run in dev).
    if (name === initialName && doc === initialDoc) return;
    version.current++;
    setSave("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  }, [name, doc, flush, initialName, initialDoc]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const update = (fn: (d: ResumeDoc) => void) =>
    setDoc((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  // Live ATS analysis on a deferred copy so typing stays smooth.
  const deferred = useDeferredValue(doc);
  const text = useMemo(() => docToText(deferred), [deferred]);
  const analysis = useMemo(() => {
    const parsed = parseResume(text);
    return { parsed, ats: checkAts(parsed, text, { hasTables: false, hasImages: false, fileType: "builder" }) };
  }, [text]);
  const docSkills = useMemo(() => new Set(findSkills(text).map((s) => s.skill.name)), [text]);

  const openAfterSave = async (href: string, newTab: boolean) => {
    if (save !== "saved" && !(await flush())) return;
    if (newTab) window.open(href, "_blank", "noopener");
    else window.location.href = href;
  };

  const c = doc.contact;
  const setContact = (k: keyof ResumeDoc["contact"]) => (v: string) =>
    update((d) => {
      d.contact[k] = v;
    });

  const match = matches.find((m) => m.id === matchId) ?? null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-3 !py-3">
        <Link href="/builder" className="text-sm text-muted hover:text-foreground">
          ←
        </Link>
        <input
          aria-label="Resume name"
          className="input !w-auto min-w-48 flex-1 font-medium"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
        <span
          className={`text-xs ${save === "error" ? "text-bad" : save === "saved" ? "text-good" : "text-muted"}`}
          role="status"
        >
          {save === "saved" ? "✓ Saved" : save === "saving" ? "Saving…" : save === "unsaved" ? "Editing…" : error}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => openAfterSave(`/builder/${id}/docx`, false)}>
            Download Word
          </button>
          <button type="button" className="btn-ghost" onClick={() => openAfterSave(`/builder/${id}/print`, true)}>
            PDF
          </button>
          <form
            action={async () => {
              if (save !== "saved" && !(await flush())) return;
              const err = await activateDoc(id);
              if (err) {
                setSave("error");
                setError(err);
              }
            }}
          >
            <button className="btn-ghost" title="Make this your active resume for ATS checks and job matching">
              Use for matching
            </button>
          </form>
          <form
            action={async () => {
              if (save !== "saved" && !(await flush())) return;
              await duplicateDoc(id);
            }}
          >
            <button className="btn-ghost" title="Copy this resume, e.g. to tailor it for one job">
              Duplicate
            </button>
          </form>
          <form
            action={async () => {
              if (confirm(`Delete "${name}"? This can't be undone.`)) await deleteDoc(id);
            }}
          >
            <button className="btn-ghost hover:!border-bad hover:!text-bad">Delete</button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <section className="card space-y-3">
            <h2 className="font-semibold">Contact</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" value={c.name} onChange={setContact("name")} placeholder="Alex Rivera" />
              <Field
                label="Headline (target title)"
                value={c.headline}
                onChange={setContact("headline")}
                placeholder="Cloud Security Engineer"
              />
              <Field label="Email" value={c.email} onChange={setContact("email")} placeholder="you@email.com" />
              <Field label="Phone" value={c.phone} onChange={setContact("phone")} placeholder="(512) 555-0142" />
              <Field
                label="Location"
                value={c.location}
                onChange={setContact("location")}
                placeholder="Austin, TX"
                hint={c.location && !/,\s*[A-Z]{2}\b/.test(c.location) ? 'US recruiters filter by "City, ST"' : null}
              />
              <Field label="LinkedIn" value={c.linkedin} onChange={setContact("linkedin")} placeholder="linkedin.com/in/you" />
              <Field label="GitHub (optional)" value={c.github} onChange={setContact("github")} placeholder="github.com/you" />
              <Field label="Website (optional)" value={c.website} onChange={setContact("website")} placeholder="yourname.dev" />
            </div>
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Professional summary</h2>
            <Area
              label="2–3 lines: title, years, top skills, one result"
              value={doc.summary}
              rows={4}
              onChange={(v) => update((d) => void (d.summary = v))}
              placeholder="Cloud Security Engineer with 4 years securing AWS and Azure. Build CSPM guardrails, SIEM detections and IaC security checks; cut critical misconfigurations 70% across 45 accounts."
            />
          </section>

          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Technical skills</h2>
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() => update((d) => void d.skills.push({ id: newId(), label: "", items: "" }))}
              >
                + Group
              </button>
            </div>
            {doc.skills.map((g, i) => (
              <div key={g.id} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                <Field label="Group" value={g.label} onChange={(v) => update((d) => void (d.skills[i].label = v))} placeholder="Cloud" />
                <Field
                  label="Skills (comma separated, exact tool names)"
                  value={g.items}
                  onChange={(v) => update((d) => void (d.skills[i].items = v))}
                  placeholder="AWS, Azure, IAM, GuardDuty, Security Hub"
                />
                <EntryControls
                  index={i}
                  count={doc.skills.length}
                  onMove={(dir) => update((d) => void (d.skills = move(d.skills, i, dir)))}
                  onRemove={() => update((d) => void d.skills.splice(i, 1))}
                />
              </div>
            ))}
          </section>

          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Experience</h2>
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() =>
                  update((d) =>
                    void d.experience.unshift({
                      id: newId(),
                      title: "",
                      company: "",
                      location: "",
                      start: "",
                      end: "Present",
                      bullets: [""],
                    }),
                  )
                }
              >
                + Role
              </button>
            </div>
            {doc.experience.map((e, i) => (
              <div key={e.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex justify-end">
                  <EntryControls
                    index={i}
                    count={doc.experience.length}
                    onMove={(dir) => update((d) => void (d.experience = move(d.experience, i, dir)))}
                    onRemove={() => update((d) => void d.experience.splice(i, 1))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Job title" value={e.title} onChange={(v) => update((d) => void (d.experience[i].title = v))} placeholder="Cloud Security Engineer" />
                  <Field label="Company" value={e.company} onChange={(v) => update((d) => void (d.experience[i].company = v))} placeholder="Acme Health" />
                  <Field label="Location" value={e.location} onChange={(v) => update((d) => void (d.experience[i].location = v))} placeholder="Austin, TX or Remote" />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Start" value={e.start} onChange={(v) => update((d) => void (d.experience[i].start = v))} placeholder="Jan 2023" hint={dateHint(e.start)} />
                    <Field label="End" value={e.end} onChange={(v) => update((d) => void (d.experience[i].end = v))} placeholder="Present" hint={dateHint(e.end)} />
                  </div>
                </div>
                <BulletsEditor bullets={e.bullets} onChange={(b) => update((d) => void (d.experience[i].bullets = b))} />
              </div>
            ))}
          </section>

          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Projects / home lab</h2>
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() => update((d) => void d.projects.push({ id: newId(), name: "", link: "", bullets: [""] }))}
              >
                + Project
              </button>
            </div>
            {doc.projects.length === 0 && (
              <p className="text-sm text-muted">
                Strong for security roles: a home lab, detection rules, CTF write-ups, or Terraform/policy-as-code repos.
              </p>
            )}
            {doc.projects.map((p, i) => (
              <div key={p.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex justify-end">
                  <EntryControls
                    index={i}
                    count={doc.projects.length}
                    onMove={(dir) => update((d) => void (d.projects = move(d.projects, i, dir)))}
                    onRemove={() => update((d) => void d.projects.splice(i, 1))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project name" value={p.name} onChange={(v) => update((d) => void (d.projects[i].name = v))} placeholder="AWS Detection Lab" />
                  <Field label="Link (optional)" value={p.link} onChange={(v) => update((d) => void (d.projects[i].link = v))} placeholder="github.com/you/aws-detection-lab" />
                </div>
                <BulletsEditor bullets={p.bullets} onChange={(b) => update((d) => void (d.projects[i].bullets = b))} />
              </div>
            ))}
          </section>

          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Education</h2>
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() =>
                  update((d) =>
                    void d.education.push({ id: newId(), degree: "", school: "", location: "", start: "", end: "", details: "" }),
                  )
                }
              >
                + School
              </button>
            </div>
            {doc.education.map((e, i) => (
              <div key={e.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex justify-end">
                  <EntryControls
                    index={i}
                    count={doc.education.length}
                    onMove={(dir) => update((d) => void (d.education = move(d.education, i, dir)))}
                    onRemove={() => update((d) => void d.education.splice(i, 1))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Degree" value={e.degree} onChange={(v) => update((d) => void (d.education[i].degree = v))} placeholder="B.S. Computer Science" />
                  <Field label="School" value={e.school} onChange={(v) => update((d) => void (d.education[i].school = v))} placeholder="University of Texas at Dallas" />
                  <Field label="Location" value={e.location} onChange={(v) => update((d) => void (d.education[i].location = v))} placeholder="Dallas, TX" />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Start" value={e.start} onChange={(v) => update((d) => void (d.education[i].start = v))} placeholder="2017" hint={dateHint(e.start)} />
                    <Field label="End" value={e.end} onChange={(v) => update((d) => void (d.education[i].end = v))} placeholder="2021" hint={dateHint(e.end)} />
                  </div>
                </div>
                <Field label="Details (optional)" value={e.details} onChange={(v) => update((d) => void (d.education[i].details = v))} placeholder="GPA 3.7; Cybersecurity club lead" />
              </div>
            ))}
          </section>

          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Certifications</h2>
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() => update((d) => void d.certifications.push({ id: newId(), name: "", issuer: "", date: "" }))}
              >
                + Cert
              </button>
            </div>
            {doc.certifications.length === 0 && (
              <p className="text-sm text-muted">
                Write full names with the acronym, e.g. &ldquo;CompTIA Security+ (SY0-701)&rdquo;. In-progress certs count: put
                &ldquo;Expected Mar 2027&rdquo; as the date.
              </p>
            )}
            {doc.certifications.map((x, i) => (
              <div key={x.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
                <Field label="Certification" value={x.name} onChange={(v) => update((d) => void (d.certifications[i].name = v))} placeholder="AWS Certified Security – Specialty" />
                <Field label="Issuer" value={x.issuer} onChange={(v) => update((d) => void (d.certifications[i].issuer = v))} placeholder="Amazon" />
                <Field label="Date" value={x.date} onChange={(v) => update((d) => void (d.certifications[i].date = v))} placeholder="2025" />
                <EntryControls
                  index={i}
                  count={doc.certifications.length}
                  onMove={(dir) => update((d) => void (d.certifications = move(d.certifications, i, dir)))}
                  onRemove={() => update((d) => void d.certifications.splice(i, 1))}
                />
              </div>
            ))}
          </section>
        </div>

        {/* Live panel */}
        <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
          <div className="mb-3 flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm" role="tablist">
            {(
              [
                ["preview", "Preview"],
                ["ats", `ATS ${analysis.ats.score}%`],
                ["tailor", "Tailor to a job"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`flex-1 rounded-md px-3 py-1.5 ${tab === key ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "preview" && (
            <div className="overflow-x-auto rounded-lg shadow-lg">
              <div className="min-w-[612px] bg-white p-[36pt]">
                <ResumeTemplate doc={deferred} />
              </div>
            </div>
          )}

          {tab === "ats" && (
            <div className="card space-y-4">
              <div className="flex items-center gap-4">
                <ScoreRing score={analysis.ats.score} size={90} />
                <p className="text-sm text-muted">
                  Live score from the same checks as your uploaded resume. ~{analysis.parsed.yearsExperience} yrs detected,{" "}
                  {analysis.parsed.skills.length} skills, {analysis.parsed.wordCount} words.
                </p>
              </div>
              <ul className="space-y-3">
                {analysis.ats.checks
                  .slice()
                  .sort((a, b) => Number(a.passed) - Number(b.passed))
                  .map((ch) => (
                    <li key={ch.id} className="text-sm">
                      <span className={ch.passed ? "text-good" : ch.severity === "critical" ? "text-bad" : "text-ok"}>
                        {ch.passed ? "✓" : "✗"}
                      </span>{" "}
                      <span className="font-medium">{ch.label}</span>
                      <span className="block pl-4 text-xs text-muted">{ch.detail}</span>
                      {!ch.passed && ch.fix && <span className="block pl-4 text-xs">{ch.fix}</span>}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {tab === "tailor" && (
            <div className="card space-y-4">
              {matches.length === 0 ? (
                <p className="text-sm text-muted">
                  Score a job on the{" "}
                  <Link href="/resume?tab=match" className="text-accent underline">
                    Match page
                  </Link>{" "}
                  first. Its missing keywords will show up here so you can work them in.
                </p>
              ) : (
                <>
                  <label className="block space-y-1 text-sm">
                    <span className="text-xs text-muted">Job</span>
                    <select
                      className="input"
                      value={matchId ?? ""}
                      onChange={(e) => setMatchId(Number(e.target.value))}
                    >
                      {matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                          {m.company ? ` · ${m.company}` : ""} ({m.score}%)
                        </option>
                      ))}
                    </select>
                  </label>
                  {match && (
                    <>
                      <TailorList
                        title="Skills the job wants"
                        items={match.skills.map((s) => ({ label: s, done: docSkills.has(s) }))}
                      />
                      <TailorList
                        title="Certifications it mentions"
                        items={match.certs.map((s) => ({ label: s, done: analysis.parsed.certs.includes(s) }))}
                      />
                      <TailorList
                        title="Job terms"
                        items={match.keywords.map((k) => ({ label: k, done: text.toLowerCase().includes(k) }))}
                      />
                      <p className="text-xs text-muted">
                        Only add what you&apos;ve actually done. Put tools in Skills <i>and</i> in a bullet that shows how
                        you used them. Tip: Duplicate this resume first to keep your base version clean.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TailorList({ title, items }: { title: string; items: { label: string; done: boolean }[] }) {
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium">
        {title}{" "}
        <span className="text-xs text-muted">
          {done}/{items.length} in your resume
        </span>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i.label} className={`chip ${i.done ? "bg-good/15 text-good" : "bg-surface-2 text-foreground"}`}>
            {i.done ? "✓ " : ""}
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}
