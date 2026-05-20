import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LegacyCustomerLogin({ searchParams }: Props) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
