"use server";

import { redirect } from "next/navigation";
import { checkAts } from "@/lib/ats";
import { deleteDocRecord, getActiveResume, getDoc, insertDoc, insertResume, updateDoc } from "@/lib/db";
import { rescoreAllJobs } from "@/lib/jobs-db";
import { docFromParsed, docToText, emptyDoc, sanitizeDoc } from "@/lib/resume-doc";
import { parseResume } from "@/lib/resume-parser";

function validId(id: unknown): number {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid id.");
  return id;
}

const cleanName = (name: unknown) =>
  (typeof name === "string" ? name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 100) : "") || "Untitled resume";

export async function createDoc(from: "blank" | "resume") {
  let doc = emptyDoc();
  let name = "My resume";
  if (from === "resume") {
    const active = getActiveResume();
    if (active) {
      doc = docFromParsed(active.parsed);
      name = active.parsed.name ? `${active.parsed.name} – base resume` : "My resume";
    }
  }
  const id = insertDoc(cleanName(name), doc);
  redirect(`/builder/${id}`);
}

export async function duplicateDoc(id: number) {
  const rec = getDoc(validId(id));
  if (!rec) redirect("/builder");
  const newId = insertDoc(cleanName(`${rec.name} (copy)`), rec.doc);
  redirect(`/builder/${newId}`);
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

export async function saveDoc(id: number, name: string, doc: unknown): Promise<SaveResult> {
  try {
    const ok = updateDoc(validId(id), cleanName(name), sanitizeDoc(doc));
    return ok ? { ok: true, savedAt: new Date().toISOString() } : { ok: false, error: "This resume no longer exists." };
  } catch (e) {
    console.error("Saving resume doc failed:", e);
    return { ok: false, error: "Couldn't save. Your changes are still in the editor." };
  }
}

export async function deleteDoc(id: number) {
  deleteDocRecord(validId(id));
  redirect("/builder");
}

/** Makes this builder resume the active one used for ATS checks and job matching. */
export async function activateDoc(id: number) {
  const rec = getDoc(validId(id));
  if (!rec) redirect("/builder");
  const text = docToText(rec.doc);
  const parsed = parseResume(text);
  const ats = checkAts(parsed, text, { hasTables: false, hasImages: false, fileType: "builder" });
  insertResume(`${rec.name} (builder)`, text, parsed, ats);
  rescoreAllJobs();
  redirect("/resume");
}
