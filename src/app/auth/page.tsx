import { redirect } from "next/navigation";

type Search = { role?: string; next?: string; switch?: string };

export default async function LegacyAuthRedirect({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.next) q.set("next", sp.next);
  if (sp.role === "rider") q.set("switch", "rider");
  const qs = q.toString();
  redirect(`/login${qs ? `?${qs}` : ""}`);
}
