"use server";

import { redirect } from "next/navigation";
import { checkAts, UNREADABLE_WORDS } from "@/lib/ats";
import { BUILDER_SUFFIX, deleteDocRecord, getDoc, getImportableResume, insertDoc, insertResume, updateDoc } from "@/lib/db";
import { rescoreAllJobs } from "@/lib/jobs-db";
import { docFromParsed, docToText, emptyDoc, sanitizeDoc, type ResumeDoc } from "@/lib/resume-doc";
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
    const active = getImportableResume();
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
export async function activateDoc(id: number): Promise<string | undefined> {
  const rec = getDoc(validId(id));
  if (!rec) redirect("/builder");
  const error = makeActive(rec.name, rec.doc);
  if (error) return error;
  redirect("/resume");
}

/** Saves an "Improve my resume" result as a new builder resume, makes it active, and opens it. */
export async function createImprovedResume(name: string, doc: unknown): Promise<string | undefined> {
  const clean = sanitizeDoc(doc);
  const docName = cleanName(name);
  const error = makeActive(docName, clean);
  if (error) return error;
  const id = insertDoc(docName, clean);
  redirect(`/builder/${id}`);
}

/** Makes a builder resume the active one for ATS checks and matching, unless it is nearly empty. */
function makeActive(name: string, doc: ResumeDoc): string | undefined {
  const text = docToText(doc);
  const parsed = parseResume(text);
  // Never replace a real resume with an empty or near-empty draft.
  if (parsed.wordCount < UNREADABLE_WORDS * 3) {
    return "This resume is almost empty. Fill in your experience and skills before using it for matching.";
  }
  const ats = checkAts(parsed, text, { hasTables: false, hasImages: false, fileType: "builder" });
  insertResume(`${name}${BUILDER_SUFFIX}`, text, parsed, ats);
  rescoreAllJobs();
}
