import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import {
  getSearchIndex,
  countPendingRequests,
  countPendingRequestsByUser,
  getUnreadPriceAcknowledgmentsCount,
  getUnreadRejectedPriceEntriesCountForWH,
  getMGPendingItemsCount,
  countPendingQuotes
} from "@/lib/db";
import { currentMonth } from "@/lib/format";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const session = requireRole();
  const searchIndex = (session.role === "WH" || session.role === "SC" || session.role === "SA" || session.role === "MG")
    ? getSearchIndex()
    : { items: [], suppliers: [] };

  // SC sees count of all pending requests (quotes + change requests); WH sees count of their own pending requests; MG sees pending pricing submissions
  const pendingRequests =
    session.role === "SC" ? (countPendingRequests() + countPendingQuotes()) :
    session.role === "WH" ? countPendingRequestsByUser(session.displayName) :
    session.role === "MG" ? getMGPendingItemsCount(currentMonth()) :
    0;

  const ackCount =
    session.role === "SC" ? getUnreadPriceAcknowledgmentsCount() :
    session.role === "WH" ? getUnreadRejectedPriceEntriesCountForWH(session.displayName) :
    0;

  return (
    <AppShell role={session.role} searchIndex={searchIndex} pendingRequests={pendingRequests} ackCount={ackCount}>
      {children}
    </AppShell>
  );
}
