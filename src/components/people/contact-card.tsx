"use client";

import { useState, useTransition } from "react";
import { removeContact, updateContactStatus } from "@/app/people/actions";
import { CopyBox } from "@/components/people/copy-box";
import { CONNECTION_NOTE_LIMIT, CONTACT_ROLES, CONTACT_STATUSES, type ContactRole, type ContactStatus, type Drafts } from "@/lib/outreach";

export type ContactView = {
  id: number;
  name: string;
  title: string;
  profileUrl: string;
  role: ContactRole;
  status: ContactStatus;
  followUpDue: boolean;
  context?: string; // e.g. job title + company, on the People page
};

export function ContactCard({ c, drafts }: { c: ContactView; drafts: Drafts }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className={`space-y-3 rounded-lg border border-border p-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {c.profileUrl ? (
              <a href={c.profileUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                {c.name} ↗
              </a>
            ) : (
              c.name
            )}
          </p>
          <p className="text-xs text-muted">
            {[c.title, CONTACT_ROLES[c.role], c.context].filter(Boolean).join(" · ")}
          </p>
          {c.followUpDue && <p className="text-xs text-ok">No reply yet after 5+ days: send the follow-up.</p>}
        </div>
        <select
          aria-label="Contact status"
          className="input !w-auto !px-2 !py-1 text-xs"
          value={c.status}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value;
            start(() => updateContactStatus(c.id, v));
          }}
        >
          {Object.entries(CONTACT_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide messages" : "Draft messages"}
        </button>
        <button
          type="button"
          className="btn-ghost !px-2 !py-1 text-xs hover:!border-bad hover:!text-bad"
          disabled={pending}
          onClick={() => {
            if (confirm(`Remove ${c.name}?`)) start(() => removeContact(c.id));
          }}
        >
          Remove
        </button>
      </div>
      {open && (
        <div className="space-y-3">
          <CopyBox label="1. Connection request note" text={drafts.connectionNote} limit={CONNECTION_NOTE_LIMIT} />
          <CopyBox label="2. Message after they accept" text={drafts.followUp} />
          <p className="text-xs text-muted">
            Edit before sending: one personal detail (a post of theirs, a tool you both use) makes a reply much more
            likely. You send these yourself; then set the status to &ldquo;Contacted&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}
