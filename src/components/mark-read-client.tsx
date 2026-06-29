"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markSingleNotificationReadAction, markAcknowledgmentsReadAction, markWHNotificationsReadAction } from "@/app/actions/notifications";

export default function MarkReadClient() {
  // Disabled automatic mark all read on mount so notifications remain highlighted
  return null;
}

export function MarkAllWHReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMarkAll = () => {
    startTransition(async () => {
      await markWHNotificationsReadAction();
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleMarkAll}
      className="button button-secondary"
      style={{ padding: "6px 12px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
    >
      {isPending ? "..." : "✓ Mark all as read"}
    </button>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAcknowledgmentsReadAction();
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleMarkAll}
      className="button button-secondary"
      style={{ padding: "6px 12px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
    >
      {isPending ? "..." : "✓ Mark all as read"}
    </button>
  );
}

export function DismissNotificationButton({ id, type, isAr }: { id: number; type: "acknowledgment" | "rejection" | "negotiation"; isAr: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await markSingleNotificationReadAction(id, type);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleDismiss}
      title={isAr ? "تحديد كمقروء" : "Mark as read"}
      style={{
        background: "rgba(99,102,241,0.06)",
        border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: "6px",
        width: "26px",
        height: "26px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "#6366f1",
        transition: "all 150ms",
        flexShrink: 0,
        opacity: isPending ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "#6366f1";
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(99,102,241,0.06)";
        e.currentTarget.style.color = "#6366f1";
      }}
    >
      ✓
    </button>
  );
}
