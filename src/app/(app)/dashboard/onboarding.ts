"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ONBOARDING_COOKIE } from "@/lib/onboarding";


/** Hides the getting-started checklist on this browser. */
export async function hideOnboarding() {
  (await cookies()).set(ONBOARDING_COOKIE, "1", { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax", httpOnly: true, secure: true });
  revalidatePath("/dashboard");
}
