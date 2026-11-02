"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { insertDoc } from "@/lib/db";
import { isJobStatus } from "@/lib/jobs-util";
import { rescoreAllJobs, setJobNotes, setJobStatus } from "@/lib/jobs-db";
import { refreshJobs } from "@/lib/refresh";
import { tailoredForJob } from "@/lib/tailor-context";

function validId(id: unknown): number {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid id.");
  return id;
}

export type RefreshState = { message?: string; error?: string };

export async function refreshJobsAction(_prev: RefreshState, formData: FormData): Promise<RefreshState> {
  try {
    const s = await refreshJobs({ boards: formData.get("boards") !== "inbox-only" });
    const failed = s.sources.filter((x) => x.error).length;
    refresh();
    return {
      message: `${s.added} new, ${s.updated} updated, ${s.scored} scored${failed ? ` · ${failed} source(s) failed` : ""}.`,
    };
  } catch (e) {
    console.error("Job refresh failed:", e);
    return { error: "Refresh failed. Check the server log." };
  }
}

export async function updateJobStatus(id: number, status: string) {
  if (!isJobStatus(status)) throw new Error("Invalid status.");
  setJobStatus(validId(id), status);
  refresh();
}

export async function updateJobNotes(id: number, notes: string) {
  setJobNotes(validId(id), typeof notes === "string" ? notes.slice(0, 5000) : "");
  refresh();
}

export async function rescoreJobsAction() {
  rescoreAllJobs();
  refresh();
}

/** Saves the job-tailored resume as a builder document to edit before downloading. */
export async function tailorInBuilder(id: number) {
  const t = tailoredForJob(String(validId(id)));
  if (!t) redirect("/jobs");
  const docId = insertDoc(`${t.doc.contact.name || "Resume"} – ${t.job.company}`.slice(0, 100), t.doc);
  redirect(`/builder/${docId}`);
}
