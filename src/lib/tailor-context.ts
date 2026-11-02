import "server-only";
import { getActiveResume } from "./db";
import { getJob, type JobRecord } from "./jobs-db";
import { matchResume } from "./matcher";
import { docFromParsed, docToText, type ResumeDoc } from "./resume-doc";
import { parseResume } from "./resume-parser";
import { tailorDoc } from "./tailor";

export type TailoredResume = { job: JobRecord; doc: ResumeDoc; score: number };

/** The active resume tailored to a job, or null if the job or resume is missing. */
export function tailoredForJob(id: string): TailoredResume | null {
  if (!/^\d{1,9}$/.test(id)) return null;
  const job = getJob(Number(id));
  const resume = getActiveResume();
  if (!job || !resume) return null;
  const doc = tailorDoc(docFromParsed(resume.parsed), {
    title: job.title,
    description: job.description,
    keywords: job.result?.keywords.matched,
  });
  const text = docToText(doc);
  const score = matchResume(parseResume(text), text, job.title, job.description).score;
  return { job, doc, score };
}
