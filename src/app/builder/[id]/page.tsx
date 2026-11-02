import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Editor, type TailorMatch } from "@/components/builder/editor";
import { getDoc, listMatches } from "@/lib/db";

export const metadata = { title: "Edit resume · JobHunter" };

export default function EditDocPage({ params }: PageProps<"/builder/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <EditDoc params={params} />
    </Suspense>
  );
}

async function EditDoc({ params }: { params: PageProps<"/builder/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const rec = getDoc(Number(id));
  if (!rec) notFound();

  const matches: TailorMatch[] = listMatches(30).map((m) => ({
    id: m.id,
    title: m.jobTitle,
    company: m.company,
    score: m.score,
    skills: [
      ...m.result.missingRequired,
      ...m.result.transferable.map((t) => t.name),
      ...m.result.matchedSkills.map((s) => s.name),
      ...m.result.missingPreferred,
    ],
    keywords: [...m.result.keywords.matched, ...m.result.keywords.missing],
    certs: m.result.certs.listed,
  }));

  // key: remount the editor (resetting its state) when switching documents.
  return <Editor key={rec.id} id={rec.id} initialName={rec.name} initialDoc={rec.doc} matches={matches} />;
}
