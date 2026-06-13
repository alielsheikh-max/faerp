"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/constants";
import { getUserByCredentials } from "@/lib/db";
import { asString } from "@/lib/format";

export async function loginAs(formData: FormData) {
  const username = asString(formData.get("username")).toLowerCase();
  const password = asString(formData.get("password"));
  const cookieStore = cookies();
  const user = getUserByCredentials(username, password);

  if (!user) {
    redirect("/?error=invalid");
  }

  cookieStore.set(SESSION_COOKIE, user.username, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/"
  });

  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
