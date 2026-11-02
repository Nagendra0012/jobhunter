import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { ResumeTemplate } from "@/components/resume-template";
import { tailoredFilename } from "@/lib/tailor";
import { tailoredForJob } from "@/lib/tailor-context";

// The browser uses the page title as the default "Save as PDF" file name.
export async function generateMetadata({ params }: PageProps<"/jobs/[id]/resume">): Promise<Metadata> {
  await connection();
  const t = tailoredForJob((await params).id);
  return { title: t ? tailoredFilename(t.doc, t.job.company, "pdf").replace(/\.pdf$/, "") : "Resume · JobHunter" };
}

export default function TailoredPrintPage({ params }: PageProps<"/jobs/[id]/resume">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <TailoredPrint params={params} />
    </Suspense>
  );
}

async function TailoredPrint({ params }: { params: PageProps<"/jobs/[id]/resume">["params"] }) {
  await connection();
  const { id } = await params;
  const t = tailoredForJob(id);
  if (!t) notFound();

  return (
    <div className="space-y-4">
      <style>{"@page { size: letter; margin: 0.5in; }"}</style>
      <div className="card flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="space-y-1 text-sm">
          <p>
            Resume for <b>{t.job.title}</b> at <b>{t.job.company}</b>
            <Link href={`/jobs/${t.job.id}`} className="ml-2 text-muted hover:text-foreground">
              ← back to job
            </Link>
          </p>
          <p className="text-muted">
            Choose <b className="text-foreground">Save as PDF</b>, paper <b className="text-foreground">Letter</b>, and turn{" "}
            <b className="text-foreground">off &ldquo;Headers and footers&rdquo;</b>.
          </p>
        </div>
        <PrintButton />
      </div>
      <div className="print-sheet mx-auto w-[8.5in] max-w-full bg-white p-[0.5in] shadow-lg print:w-auto print:p-0 print:shadow-none">
        <ResumeTemplate doc={t.doc} />
      </div>
    </div>
  );
}
