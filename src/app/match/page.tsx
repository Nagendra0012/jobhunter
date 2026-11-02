import { redirect } from "next/navigation";

// "Match a job" now lives on the Resume page.
export default function MatchPage() {
  redirect("/resume?tab=match");
}
