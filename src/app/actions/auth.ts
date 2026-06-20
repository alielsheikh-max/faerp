"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/constants";
import { getUserByCredentials, getUserByUsernameAndPassword, getUserByUsername } from "@/lib/db";
import { asString } from "@/lib/format";
import { log } from "@/lib/activity";

export async function loginAs(formData: FormData) {
  const username = asString(formData.get("username")).toLowerCase();
  const password = asString(formData.get("password"));
  const cookieStore = cookies();

  // Primary check — active users only
  const user = getUserByCredentials(username, password);

  if (!user) {
    // Secondary check — same credentials but without the active filter.
    // If this returns a row with active=0 the account exists but is disabled.
    const anyUser = getUserByUsernameAndPassword(username, password);
    if (anyUser && anyUser.active === 0) {
      redirect("/?error=disabled");
    }
    redirect("/?error=invalid");
  }

  cookieStore.set(SESSION_COOKIE, user.username, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  // Audit log — sign-in event
  log.signIn({ username: user.username, role: user.role, displayName: user.display_name });

  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = cookies();

  // Read session before deleting so we can log who signed out
  const sessionUsername = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionUsername) {
    try {
      const user = getUserByUsername(sessionUsername);
      if (user) {
        log.signOut({ username: user.username, role: user.role, displayName: user.display_name });
      }
    } catch {
      // never block logout
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
