import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { ResumeTemplate } from "@/components/resume-template";
import { getDoc } from "@/lib/db";

export const metadata = { title: "Print resume · JobHunter" };

export default function PrintPage({ params }: PageProps<"/builder/[id]/print">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <PrintDoc params={params} />
    </Suspense>
  );
}

async function PrintDoc({ params }: { params: PageProps<"/builder/[id]/print">["params"] }) {
  await connection();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const rec = getDoc(Number(id));
  if (!rec) notFound();

  return (
    <div className="space-y-4">
      <style>{"@page { size: letter; margin: 0.5in; }"}</style>
      <div className="card flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">
          Choose <b className="text-foreground">Save as PDF</b> as the printer, paper size <b className="text-foreground">Letter</b>, and
          turn <b className="text-foreground">off &ldquo;Headers and footers&rdquo;</b>.
        </p>
        <PrintButton />
      </div>
      <div className="print-sheet mx-auto w-[8.5in] max-w-full bg-white p-[0.5in] shadow-lg print:w-auto print:p-0 print:shadow-none">
        <ResumeTemplate doc={rec.doc} />
      </div>
    </div>
  );
}
