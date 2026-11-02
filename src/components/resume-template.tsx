import { contactLine, dateRange, filled, HEADINGS, type ResumeDoc } from "@/lib/resume-doc";

// ATS-safe layout: one column, real text, standard headings, no tables,
// icons or graphics. Sized in points so screen preview and print match.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-[9pt]">
      <h2 className="border-b border-black pb-[1pt] text-[10.5pt] font-bold uppercase tracking-[0.06em]">{title}</h2>
      <div className="mt-[4pt]">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  const list = filled(items);
  if (!list.length) return null;
  return (
    <ul className="mt-[2pt] list-disc pl-[14pt]">
      {list.map((b, i) => (
        <li key={i} className="mb-[1.5pt] pl-[2pt]">
          {b}
        </li>
      ))}
    </ul>
  );
}

export function ResumeTemplate({ doc }: { doc: ResumeDoc }) {
  const c = doc.contact;
  const contact = contactLine(c);
  const skills = doc.skills.filter((g) => g.items.trim());
  const exp = doc.experience.filter((e) => e.title.trim() || e.company.trim());
  const edu = doc.education.filter((e) => e.degree.trim() || e.school.trim());
  const certs = doc.certifications.filter((x) => x.name.trim());
  const projects = doc.projects.filter((p) => p.name.trim());

  return (
    <article className="resume-page bg-white font-[Arial,Helvetica,sans-serif] text-[10pt] leading-[1.32] text-black">
      <header className="text-center">
        <h1 className="text-[17pt] font-bold leading-tight">{c.name || "Your Name"}</h1>
        {c.headline && <p className="mt-[1pt] text-[10.5pt]">{c.headline}</p>}
        {contact.length > 0 && <p className="mt-[2pt] text-[9.5pt]">{contact.join("  |  ")}</p>}
      </header>

      {doc.summary.trim() && (
        <Section title={HEADINGS.summary}>
          <p>{doc.summary.trim()}</p>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title={HEADINGS.skills}>
          {skills.map((g) => (
            <p key={g.id} className="mb-[1.5pt]">
              {g.label.trim() && <b>{g.label.trim()}: </b>}
              {g.items.trim()}
            </p>
          ))}
        </Section>
      )}

      {exp.length > 0 && (
        <Section title={HEADINGS.experience}>
          {exp.map((e) => (
            <div key={e.id} className="mb-[6pt] break-inside-avoid-page">
              <div className="flex justify-between gap-[8pt]">
                <p>
                  <b>{e.title}</b>
                  {e.company && <>{e.title ? " | " : ""}{e.company}</>}
                  {e.location && <> | {e.location}</>}
                </p>
                <p className="shrink-0">{dateRange(e.start, e.end)}</p>
              </div>
              <Bullets items={e.bullets} />
            </div>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title={HEADINGS.projects}>
          {projects.map((p) => (
            <div key={p.id} className="mb-[5pt] break-inside-avoid-page">
              <p>
                <b>{p.name}</b>
                {p.link && <> | {p.link}</>}
              </p>
              <Bullets items={p.bullets} />
            </div>
          ))}
        </Section>
      )}

      {edu.length > 0 && (
        <Section title={HEADINGS.education}>
          {edu.map((e) => (
            <div key={e.id} className="mb-[4pt]">
              <div className="flex justify-between gap-[8pt]">
                <p>
                  <b>{e.degree}</b>
                  {e.school && <>{e.degree ? " | " : ""}{e.school}</>}
                  {e.location && <> | {e.location}</>}
                </p>
                <p className="shrink-0">{dateRange(e.start, e.end)}</p>
              </div>
              {e.details.trim() && <p>{e.details.trim()}</p>}
            </div>
          ))}
        </Section>
      )}

      {certs.length > 0 && (
        <Section title={HEADINGS.certifications}>
          <ul className="list-disc pl-[14pt]">
            {certs.map((x) => (
              <li key={x.id} className="mb-[1.5pt] pl-[2pt]">
                <b>{x.name}</b>
                {x.issuer && <> | {x.issuer}</>}
                {x.date && <> | {x.date}</>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
