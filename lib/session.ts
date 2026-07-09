/**
 * Server-side session helpers. requireUserId() is THE auth gate for the data
 * layer — every function in lib/queries/* and lib/actions/* calls it first.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUserId(): Promise<string> {
  return (await requireUser()).id;
}
