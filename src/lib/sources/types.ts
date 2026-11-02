// Board sources are fetched by the app itself; connector sources arrive as
// JSON files that Claude drops into data/inbox using its connectors.
export const SOURCE_LABELS = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  indeed: "Indeed",
  dice: "Dice",
  ziprecruiter: "ZipRecruiter",
  other: "Other",
} as const;

export type SourceId = keyof typeof SOURCE_LABELS;

export const isSourceId = (s: unknown): s is SourceId =>
  typeof s === "string" && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s);

export type NormalizedJob = {
  source: SourceId;
  externalId: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  description: string; // plain text
  salary: string | null;
  postedAt: string | null; // ISO date
  sponsor: boolean | null; // explicit "willing to sponsor" flag when the source has one
};

export type SourceResult = {
  source: SourceId;
  label: string; // e.g. "greenhouse:cloudflare" or "inbox:dice-2026-11-02.json"
  jobs: NormalizedJob[];
  error?: string;
};
