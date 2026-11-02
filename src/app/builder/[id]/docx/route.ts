import { getDoc } from "@/lib/db";
import { docxBuffer, docxFilename } from "@/lib/resume-docx";

export async function GET(_req: Request, ctx: RouteContext<"/builder/[id]/docx">) {
  const { id } = await ctx.params;
  if (!/^\d{1,9}$/.test(id)) return new Response("Not found", { status: 404 });
  const rec = getDoc(Number(id));
  if (!rec) return new Response("Not found", { status: 404 });

  const buf = await docxBuffer(rec.doc);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docxFilename(rec.doc)}"`,
      "Cache-Control": "no-store",
    },
  });
}
