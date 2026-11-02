import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from "docx";
import { contactLine, dateRange, filled, HEADINGS, type ResumeDoc } from "./resume-doc";

// Word export mirroring ResumeTemplate: Letter size, 0.5" margins, Arial,
// one column, no tables/text boxes/headers, so every ATS can parse it.

const PAGE_WIDTH = 12240; // twips (8.5")
const MARGIN = 720; // 0.5"
const RIGHT_TAB = PAGE_WIDTH - MARGIN * 2;
const pt = (n: number) => n * 2; // docx sizes are half-points

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: pt(10.5) })],
  });
}

function bullet(text: string) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [new TextRun(text)] });
}

/** "Title | Company | Location" on the left and dates flush right. */
function entryLine(bold: string, rest: string[], dates: string) {
  const restText = rest.filter(Boolean);
  return new Paragraph({
    spacing: { before: 60, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
    children: [
      new TextRun({ text: bold, bold: true }),
      new TextRun((bold && restText.length ? " | " : "") + restText.join(" | ")),
      ...(dates ? [new TextRun({ children: [new Tab(), dates] })] : []),
    ],
  });
}

export function buildDocx(doc: ResumeDoc): Document {
  const c = doc.contact;
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: c.name || "Your Name", bold: true, size: pt(17) })],
    }),
  ];
  if (c.headline.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: c.headline.trim(), size: pt(10.5) })],
      }),
    );
  }
  const contact = contactLine(c);
  if (contact.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: contact.join("  |  "), size: pt(9.5) })],
      }),
    );
  }

  if (doc.summary.trim()) {
    children.push(heading(HEADINGS.summary), new Paragraph({ children: [new TextRun(doc.summary.trim())] }));
  }

  const skills = doc.skills.filter((g) => g.items.trim());
  if (skills.length) {
    children.push(heading(HEADINGS.skills));
    for (const g of skills) {
      children.push(
        new Paragraph({
          spacing: { after: 30 },
          children: [
            ...(g.label.trim() ? [new TextRun({ text: `${g.label.trim()}: `, bold: true })] : []),
            new TextRun(g.items.trim()),
          ],
        }),
      );
    }
  }

  const exp = doc.experience.filter((e) => e.title.trim() || e.company.trim());
  if (exp.length) {
    children.push(heading(HEADINGS.experience));
    for (const e of exp) {
      children.push(entryLine(e.title.trim(), [e.company.trim(), e.location.trim()], dateRange(e.start, e.end)));
      children.push(...filled(e.bullets).map(bullet));
    }
  }

  const projects = doc.projects.filter((p) => p.name.trim());
  if (projects.length) {
    children.push(heading(HEADINGS.projects));
    for (const p of projects) {
      children.push(entryLine(p.name.trim(), [p.link.trim()], ""));
      children.push(...filled(p.bullets).map(bullet));
    }
  }

  const edu = doc.education.filter((e) => e.degree.trim() || e.school.trim());
  if (edu.length) {
    children.push(heading(HEADINGS.education));
    for (const e of edu) {
      children.push(entryLine(e.degree.trim(), [e.school.trim(), e.location.trim()], dateRange(e.start, e.end)));
      if (e.details.trim()) children.push(new Paragraph({ children: [new TextRun(e.details.trim())] }));
    }
  }

  const certs = doc.certifications.filter((x) => x.name.trim());
  if (certs.length) {
    children.push(heading(HEADINGS.certifications));
    for (const x of certs) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 30 },
          children: [
            new TextRun({ text: x.name.trim(), bold: true }),
            new TextRun([x.issuer, x.date].map((v) => v.trim()).filter(Boolean).map((v) => ` | ${v}`).join("")),
          ],
        }),
      );
    }
  }

  return new Document({
    creator: c.name || "JobHunter",
    title: `${c.name || "Resume"} – Resume`,
    styles: { default: { document: { run: { font: "Arial", size: pt(10) } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: 15840 },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        children,
      },
    ],
  });
}

export async function docxBuffer(doc: ResumeDoc): Promise<Buffer> {
  return Packer.toBuffer(buildDocx(doc));
}

/** A safe download filename like "Alex_Rivera_Resume.docx". */
export function docxFilename(doc: ResumeDoc): string {
  const base = (doc.contact.name || "Resume").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
  return `${base || "Resume"}_Resume.docx`;
}
