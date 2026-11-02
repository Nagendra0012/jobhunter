"use server";

import { redirect } from "next/navigation";
import { checkAts } from "@/lib/ats";
import {
  deleteMatch,
  deleteResume,
  getActiveResume,
  insertMatch,
  insertResume,
  setActiveResume,
} from "@/lib/db";
import { matchResume } from "@/lib/matcher";
import { extractText, parseResume } from "@/lib/resume-parser";

export type FormState = { error?: string; values?: Record<string, string> };

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 60_000; // characters; real resumes and job posts are far smaller
const MAX_FIELD = 200;

function field(formData: FormData, name: string, max: number) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function validId(id: unknown): number {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid id.");
  return id;
}

export async function uploadResume(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF or DOCX file first." };
  if (file.size > MAX_BYTES) return { error: "File is larger than 8 MB." };
  // Keep only a safe display name (no paths or control characters).
  const filename = file.name.replace(/^.*[\\/]/, "").replace(/[^\w.\- ()]/g, "_").slice(0, 120);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractText({ name: filename, bytes });
    const text = extracted.text.slice(0, MAX_TEXT);
    const parsed = parseResume(text);
    const fileType = filename.split(".").pop()?.toLowerCase() ?? "";
    const ats = checkAts(parsed, text, { ...extracted, fileType });
    insertResume(filename, text, parsed, ats);
  } catch (e) {
    console.error("Resume upload failed:", e);
    const known = e instanceof Error && /^(That file|Unsupported file)/.test(e.message);
    return { error: known ? (e as Error).message : "Couldn't read that file. Try exporting it again as PDF or DOCX." };
  }
  redirect("/resume");
}

export async function runMatch(_prev: FormState, formData: FormData): Promise<FormState> {
  const jobTitle = field(formData, "jobTitle", MAX_FIELD);
  const company = field(formData, "company", MAX_FIELD) || null;
  const jd = field(formData, "jd", MAX_TEXT);
  // Echo inputs back so React's post-action form reset doesn't wipe them.
  const values = { jobTitle, company: company ?? "", jd };
  if (!jobTitle) return { error: "Enter the job title.", values };
  if (jd.length < 200) return { error: "Paste the full job description (at least a few paragraphs).", values };

  const resume = getActiveResume();
  if (!resume) return { error: "Upload your resume first.", values };

  const result = matchResume(resume.parsed, resume.text, jobTitle, jd);
  const id = insertMatch(resume.id, jobTitle, company, jd, result);
  redirect(`/match/${id}`);
}

export async function activateResume(id: number) {
  setActiveResume(validId(id));
  redirect("/resume");
}

export async function removeResume(id: number) {
  deleteResume(validId(id));
  redirect("/resume");
}

export async function removeMatch(id: number) {
  deleteMatch(validId(id));
  redirect("/match");
}
