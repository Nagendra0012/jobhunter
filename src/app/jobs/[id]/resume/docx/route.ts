import { connection } from "next/server";
import { docxBuffer } from "@/lib/resume-docx";
import { tailoredFilename } from "@/lib/tailor";
import { tailoredForJob } from "@/lib/tailor-context";

export async function GET(_req: Request, ctx: RouteContext<"/jobs/[id]/resume/docx">) {
  await connection();
  const { id } = await ctx.params;
  const t = tailoredForJob(id);
  if (!t) return new Response("Not found", { status: 404 });

  const buf = await docxBuffer(t.doc);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${tailoredFilename(t.doc, t.job.company)}"`,
      "Cache-Control": "no-store",
    },
  });
}
