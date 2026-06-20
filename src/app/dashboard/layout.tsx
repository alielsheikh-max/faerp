import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { getSearchIndex, countPendingRequests, countPendingRequestsByUser } from "@/lib/db";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const session = requireRole();
  const searchIndex = (session.role === "WH" || session.role === "SC" || session.role === "SA")
    ? getSearchIndex()
    : { items: [], suppliers: [] };

  // SC sees count of all pending requests; WH sees count of their own pending requests
  const pendingRequests =
    session.role === "SC" ? countPendingRequests() :
    session.role === "WH" ? countPendingRequestsByUser(session.displayName) :
    0;

  return (
    <AppShell role={session.role} searchIndex={searchIndex} pendingRequests={pendingRequests}>
      {children}
    </AppShell>
  );
}
