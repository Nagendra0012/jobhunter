// Public job-board APIs (no keys needed). Only security roles in the US are kept.

import { htmlToText } from "../html";
import { isSecurityRole, isUsLocation } from "./filters";
import type { NormalizedJob, SourceResult } from "./types";

// Verified to respond on 2026-11-02. Board token → display name.
export const GREENHOUSE: Record<string, string> = {
  cloudflare: "Cloudflare", datadog: "Datadog", okta: "Okta", wizinc: "Wiz", elastic: "Elastic",
  gitlab: "GitLab", twilio: "Twilio", coinbase: "Coinbase", robinhood: "Robinhood", stripe: "Stripe",
  databricks: "Databricks", figma: "Figma", abnormalsecurity: "Abnormal Security", zscaler: "Zscaler",
  netskope: "Netskope", chainguard: "Chainguard", huntress: "Huntress", expel: "Expel", tailscale: "Tailscale",
  mongodb: "MongoDB", samsara: "Samsara", toast: "Toast", affirm: "Affirm", brex: "Brex", chime: "Chime",
  discord: "Discord", dropbox: "Dropbox", lyft: "Lyft", pinterest: "Pinterest", reddit: "Reddit",
  roblox: "Roblox", block: "Block", squarespace: "Squarespace", asana: "Asana", duolingo: "Duolingo",
  gusto: "Gusto", instacart: "Instacart", cockroachlabs: "Cockroach Labs", grafanalabs: "Grafana Labs",
  fastly: "Fastly", axonius: "Axonius", orcasecurity: "Orca Security", island: "Island",
  recordedfuture: "Recorded Future", securityscorecard: "SecurityScorecard", torq: "Torq",
  sumologic: "Sumo Logic", newrelic: "New Relic", pagerduty: "PagerDuty", bugcrowd: "Bugcrowd",
};
export const LEVER: Record<string, string> = { palantir: "Palantir", spotify: "Spotify", secureframe: "Secureframe" };
export const ASHBY: Record<string, string> = {
  snyk: "Snyk", vanta: "Vanta", openai: "OpenAI", notion: "Notion", linear: "Linear", ramp: "Ramp",
  semgrep: "Semgrep", socket: "Socket", "1password": "1Password", drata: "Drata",
};

const TIMEOUT_MS = 15_000;
const MAX_DESC = 40_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json", "User-Agent": "jobhunter (personal job search tool)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const safeUrl = (u: unknown) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : "");
const iso = (d: unknown) => {
  const t = typeof d === "number" ? new Date(d) : typeof d === "string" ? new Date(d) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toISOString() : null;
};

type GhList = { jobs: { id: number; title: string; absolute_url: string; location?: { name?: string }; updated_at?: string; first_published?: string }[] };
type GhJob = { content?: string };

async function greenhouse(token: string, company: string): Promise<NormalizedJob[]> {
  const list = await getJson<GhList>(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`);
  const wanted = list.jobs.filter((j) => isSecurityRole(j.title) && isUsLocation(j.location?.name ?? ""));
  // Descriptions come from a per-job call, made only for the few matching jobs.
  return Promise.all(
    wanted.map(async (j) => {
      const detail = await getJson<GhJob>(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${j.id}`).catch(() => ({}) as GhJob);
      const loc = j.location?.name ?? "";
      return {
        source: "greenhouse" as const,
        externalId: `${token}:${j.id}`,
        company,
        title: j.title,
        location: loc,
        remote: /remote/i.test(loc),
        url: safeUrl(j.absolute_url),
        description: htmlToText(detail.content ?? "").slice(0, MAX_DESC),
        salary: null,
        postedAt: iso(j.first_published ?? j.updated_at),
        sponsor: null,
      };
    }),
  );
}

type LeverJob = {
  id: string; text: string; hostedUrl: string; createdAt?: number; country?: string; workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] }; descriptionPlain?: string; additionalPlain?: string;
  lists?: { text: string; content: string }[]; salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

async function lever(token: string, company: string): Promise<NormalizedJob[]> {
  const jobs = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${token}?mode=json`);
  return jobs
    .filter((j) => isSecurityRole(j.text) && isUsLocation(j.categories?.allLocations?.join("; ") ?? j.categories?.location ?? "", j.country))
    .map((j) => {
      const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
      const s = j.salaryRange;
      return {
        source: "lever" as const,
        externalId: `${token}:${j.id}`,
        company,
        title: j.text,
        location: j.categories?.location ?? "",
        remote: j.workplaceType === "remote",
        url: safeUrl(j.hostedUrl),
        description: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n\n").slice(0, MAX_DESC),
        salary: s?.min && s.max ? `${s.currency ?? "USD"} ${s.min.toLocaleString()}–${s.max.toLocaleString()}` : null,
        postedAt: iso(j.createdAt),
        sponsor: null,
      };
    });
}

type AshbyJob = {
  id: string; title: string; location?: string; secondaryLocations?: { location?: string }[]; isRemote?: boolean;
  isListed?: boolean; jobUrl: string; publishedAt?: string; descriptionPlain?: string;
  address?: { postalAddress?: { addressCountry?: string } }; compensation?: { compensationTierSummary?: string };
};

async function ashby(token: string, company: string): Promise<NormalizedJob[]> {
  const { jobs } = await getJson<{ jobs: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`,
  );
  return jobs
    .filter((j) => j.isListed !== false && isSecurityRole(j.title))
    .filter((j) => {
      const locs = [j.location ?? "", ...(j.secondaryLocations ?? []).map((l) => l.location ?? "")].join("; ");
      return isUsLocation(locs, j.address?.postalAddress?.addressCountry);
    })
    .map((j) => ({
      source: "ashby" as const,
      externalId: `${token}:${j.id}`,
      company,
      title: j.title,
      location: j.location ?? "",
      remote: Boolean(j.isRemote),
      url: safeUrl(j.jobUrl),
      description: (j.descriptionPlain ?? "").slice(0, MAX_DESC),
      salary: j.compensation?.compensationTierSummary ?? null,
      postedAt: iso(j.publishedAt),
      sponsor: null,
    }));
}

/** Runs async tasks with a concurrency cap so we don't hammer the APIs. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

export async function fetchBoards(): Promise<SourceResult[]> {
  const run = (source: SourceResult["source"], token: string, fn: () => Promise<NormalizedJob[]>) => async () => {
    const label = `${source}:${token}`;
    try {
      return { source, label, jobs: (await fn()).filter((j) => j.url) };
    } catch (e) {
      return { source, label, jobs: [], error: e instanceof Error ? e.message : String(e) };
    }
  };
  return pool(
    [
      ...Object.entries(GREENHOUSE).map(([t, c]) => run("greenhouse", t, () => greenhouse(t, c))),
      ...Object.entries(LEVER).map(([t, c]) => run("lever", t, () => lever(t, c))),
      ...Object.entries(ASHBY).map(([t, c]) => run("ashby", t, () => ashby(t, c))),
    ],
    8,
  );
}
