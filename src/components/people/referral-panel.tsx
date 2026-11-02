import { AddContactForm } from "@/components/people/add-contact-form";
import { ContactCard } from "@/components/people/contact-card";
import { contactsForCompany, type ContactRecord } from "@/lib/contacts-db";
import type { JobRecord } from "@/lib/jobs-db";
import { companySearchName, searchLinks } from "@/lib/outreach";
import { draftsFor, myProfile } from "@/lib/outreach-context";

export function followUpDue(c: ContactRecord): boolean {
  if (c.status !== "contacted" || !c.statusAt) return false;
  const t = new Date(c.statusAt.replace(" ", "T") + "Z").getTime();
  return Date.now() - t >= 5 * 86_400_000;
}

/** "Get a referral" box on a job page. Server component. */
export function ReferralPanel({ job }: { job: JobRecord }) {
  const me = myProfile();
  const contacts = contactsForCompany(job.company);
  const links = searchLinks(job.company, { schools: me?.schools, pastEmployers: me?.pastEmployers });

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">Get a referral at {companySearchName(job.company)}</h2>
        <p className="mt-1 text-sm text-muted">
          Referred candidates get interviews far more often than cold applicants. Find one or two people, add them
          here, and the app drafts a message for each. Nothing is sent for you.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">1. Find people on LinkedIn</h3>
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
              title={l.hint}
            >
              {l.label} ↗
            </a>
          ))}
        </div>
        {!me && <p className="mt-2 text-xs text-muted">Upload your resume to also get alumni and ex-colleague searches.</p>}
      </div>

      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">2. Add who you&apos;ll reach out to</h3>
        <AddContactForm jobId={job.id} />
      </div>

      {contacts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-muted">3. Message them ({contacts.length})</h3>
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              c={{
                id: c.id,
                name: c.name,
                title: c.title,
                profileUrl: c.profileUrl,
                role: c.role,
                status: c.status,
                followUpDue: followUpDue(c),
              }}
              drafts={draftsFor(me, c, { title: job.title, company: job.company, result: job.result })}
            />
          ))}
        </div>
      )}
    </section>
  );
}
