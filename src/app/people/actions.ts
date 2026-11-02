"use server";

import { refresh } from "next/cache";
import { deleteContact, insertContact, setContactNotes, setContactStatus } from "@/lib/contacts-db";
import { getJob } from "@/lib/jobs-db";
import { isContactRole, isContactStatus, normalizeProfileUrl } from "@/lib/outreach";

function validId(id: unknown): number {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid id.");
  return id;
}

const text = (fd: FormData, k: string, max: number) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
};

export type AddContactState = { error?: string; ok?: number };

export async function addContact(_prev: AddContactState, fd: FormData): Promise<AddContactState> {
  const jobId = Number(text(fd, "jobId", 12));
  const job = Number.isSafeInteger(jobId) && jobId > 0 ? getJob(jobId) : null;
  if (!job) return { error: "Job not found." };
  const name = text(fd, "name", 100);
  if (!name) return { error: "Enter the person's name." };
  const profileUrl = normalizeProfileUrl(text(fd, "profileUrl", 300));
  if (profileUrl === null) return { error: "Profile link must be a linkedin.com URL." };
  const role = text(fd, "role", 30);
  insertContact({
    jobId: job.id,
    company: job.company,
    name,
    title: text(fd, "title", 150),
    profileUrl,
    role: isContactRole(role) ? role : "other",
  });
  refresh();
  return { ok: Date.now() }; // changes each time so the form can reset
}

export async function updateContactStatus(id: number, status: string) {
  if (!isContactStatus(status)) throw new Error("Invalid status.");
  setContactStatus(validId(id), status);
  refresh();
}

export async function updateContactNotes(id: number, notes: string) {
  setContactNotes(validId(id), typeof notes === "string" ? notes.slice(0, 3000) : "");
  refresh();
}

export async function removeContact(id: number) {
  deleteContact(validId(id));
  refresh();
}
