import { connection } from "next/server";
import { Suspense } from "react";
import { PortfolioEditor } from "@/components/portfolio/editor";
import { getPortfolio, listDocs } from "@/lib/db";

export const metadata = { title: "Portfolio · JobHunter" };

export default function PortfolioPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const data = getPortfolio();
  const docs = listDocs().map((d) => ({ id: d.id, name: d.name, doc: d.doc }));
  return <PortfolioEditor initial={data} docs={docs} />;
}
