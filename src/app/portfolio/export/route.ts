import JSZip from "jszip";
import { connection } from "next/server";
import { getDoc, getPortfolio } from "@/lib/db";
import { DEPLOY_README, HEADERS_FILE, renderPortfolioHtml, securityTxt } from "@/lib/portfolio-render";

export async function GET() {
  await connection(); // always build from the latest saved portfolio, never at build time
  const data = getPortfolio();
  const doc = data.docId ? (getDoc(data.docId)?.doc ?? null) : null;

  const zip = new JSZip();
  zip.file("index.html", await renderPortfolioHtml(data, doc, { includeExamples: false }));
  zip.file(".well-known/security.txt", securityTxt(data, doc));
  zip.file("robots.txt", "User-agent: *\nAllow: /\n");
  zip.file("_headers", HEADERS_FILE);
  zip.file("README.md", DEPLOY_README);
  const body = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="portfolio-site.zip"',
      "Cache-Control": "no-store",
    },
  });
}
