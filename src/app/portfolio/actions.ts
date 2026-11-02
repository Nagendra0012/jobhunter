"use server";

import { savePortfolioData } from "@/lib/db";
import { sanitizePortfolio } from "@/lib/portfolio";

export type PortfolioSaveResult = { ok: true } | { ok: false; error: string };

export async function savePortfolio(data: unknown): Promise<PortfolioSaveResult> {
  try {
    savePortfolioData(sanitizePortfolio(data));
    return { ok: true };
  } catch (e) {
    console.error("Saving portfolio failed:", e);
    return { ok: false, error: "Couldn't save. Your changes are still in the editor." };
  }
}
