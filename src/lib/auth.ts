import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_PROFILES, RoleCode, SESSION_COOKIE } from "@/lib/constants";
import { getUserByUsername } from "@/lib/db";

export function isRoleCode(value: string): value is RoleCode {
  return value in ROLE_PROFILES;
}

export function getCurrentRole(): RoleCode | null {
  const session = getCurrentSession();

  return session?.role ?? null;
}

export function getCurrentSession(): {
  id: number;
  username: string;
  role: RoleCode;
  displayName: string;
} | null {
  const cookieStore = cookies();
  const username = cookieStore.get(SESSION_COOKIE)?.value;

  if (!username) {
    return null;
  }

  const user = getUserByUsername(username);

  if (!user || !isRoleCode(user.role)) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name
  };
}

export function requireRole(allowedRoles?: RoleCode[]) {
  const session = getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }

  return session;
}
