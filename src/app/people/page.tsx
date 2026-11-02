import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContactCard } from "@/components/people/contact-card";
import { followUpDue } from "@/components/people/referral-panel";
import { listContacts } from "@/lib/contacts-db";
import { getJob } from "@/lib/jobs-db";
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/outreach";
import { draftsFor, myProfile } from "@/lib/outreach-context";

export const metadata = { title: "People · JobHunter" };

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">People</h1>
        <p className="mt-1 text-sm text-muted">
          Everyone you&apos;re reaching out to for referrals. Add people from any job&apos;s &ldquo;Get a referral&rdquo;
          panel.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

const ORDER: ContactStatus[] = ["to_contact", "contacted", "replied", "referred", "not_relevant"];

async function Content() {
  await connection();
  const contacts = listContacts();
  const me = myProfile();
  if (!contacts.length) {
    return (
      <p className="card text-sm text-muted">
        No one yet. Open a job on the{" "}
        <Link href="/jobs" className="text-accent underline">
          Jobs page
        </Link>
        , use its LinkedIn search buttons to find a recruiter or security engineer, and add them.
      </p>
    );
  }
  const due = contacts.filter(followUpDue).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm text-muted">
        {ORDER.map((s) => (
          <span key={s}>
            <b className="text-foreground">{contacts.filter((c) => c.status === s).length}</b> {CONTACT_STATUSES[s].toLowerCase()}
          </span>
        ))}
        {due > 0 && <span className="text-ok">{due} follow-up{due > 1 ? "s" : ""} due</span>}
      </div>
      {ORDER.map((status) => {
        const group = contacts.filter((c) => c.status === status);
        if (!group.length) return null;
        return (
          <section key={status} className="space-y-2">
            <h2 className="text-sm font-semibold">
              {CONTACT_STATUSES[status]} <span className="text-muted">({group.length})</span>
            </h2>
            {group.map((c) => {
              const job = c.jobId ? getJob(c.jobId) : null;
              return (
                <div key={c.id} className="card !p-3">
                  <ContactCard
                    c={{
                      id: c.id,
                      name: c.name,
                      title: c.title,
                      profileUrl: c.profileUrl,
                      role: c.role,
                      status: c.status,
                      followUpDue: followUpDue(c),
                      context: `${c.company}${c.jobTitle ? ` · ${c.jobTitle}` : ""}`,
                    }}
                    drafts={draftsFor(me, c, {
                      title: job?.title ?? c.jobTitle ?? "open security",
                      company: c.company,
                      result: job?.result ?? null,
                    })}
                  />
                  {job && (
                    <Link href={`/jobs/${job.id}`} className="mt-2 inline-block text-xs text-muted hover:text-accent">
                      View job →
                    </Link>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
