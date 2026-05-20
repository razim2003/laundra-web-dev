import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LegacyRiderLogin({ searchParams }: Props) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const qs = new URLSearchParams();
  if (next) qs.set("next", next);
  qs.set("switch", "rider");
  redirect(`/login?${qs.toString()}`);
}
