// Server-only: reads uploaded files. Kept apart from the parser so the parser
// can also run in the browser (live ATS score in the resume builder).
/** Pulls plain text out of an uploaded PDF or DOCX file. */
export async function extractText(
  file: { name: string; bytes: Uint8Array },
): Promise<{ text: string; hasTables: boolean; hasImages: boolean }> {
  const lower = file.name.toLowerCase();
  // Trust the file's bytes, not its name: PDFs start with "%PDF", DOCX files are zip archives ("PK").
  const head = new TextDecoder("latin1").decode(file.bytes.slice(0, 5));
  if (lower.endsWith(".pdf") && !head.startsWith("%PDF")) throw new Error("That file isn't a valid PDF.");
  if (lower.endsWith(".docx") && !head.startsWith("PK")) throw new Error("That file isn't a valid DOCX.");
  if (lower.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(file.bytes);
    const { text } = await pdfText(pdf, { mergePages: true });
    return { text, hasTables: false, hasImages: false };
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(file.bytes);
    const [{ value: text }, { value: html }] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }),
    ]);
    return { text, hasTables: html.includes("<table"), hasImages: html.includes("<img") };
  }
  throw new Error("Unsupported file type. Upload a PDF or DOCX file.");
}
