"use client";

import { useState } from "react";
import { cancelPendingPriceAction } from "@/app/actions/notifications";
import { useI18n } from "@/lib/i18n-context";

export default function CancelPendingButton({ itemId, month, itemName }: { itemId: number; month: string; itemName: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  if (done) {
    return (
      <span style={{
        fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
        background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
      }}>✓ {isAr ? "تم الإلغاء" : "Cancelled"}</span>
    );
  }

  async function handleCancel() {
    if (!confirm(isAr ? `هل أنت متأكد من إلغاء الطلب المعلق لـ "${itemName}"؟` : `Cancel pending request for "${itemName}"? This will revert to the last approved price.`)) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("itemId", String(itemId));
    fd.set("month", month);
    const res = await cancelPendingPriceAction(fd);
    setLoading(false);
    if (res.ok) {
      setDone(true);
    } else {
      alert(res.error || "Failed to cancel");
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      style={{
        padding: "5px 12px", borderRadius: "7px",
        border: "1.5px solid var(--danger)",
        background: loading ? "var(--bg-elevated)" : "rgba(239,68,68,0.08)",
        color: "var(--danger)",
        fontSize: "11px", fontWeight: 700, cursor: loading ? "wait" : "pointer",
        transition: "background 150ms",
      }}
    >
      {loading ? (isAr ? "جارٍ..." : "Cancelling...") : (isAr ? "✕ إلغاء الطلب" : "✕ Cancel Request")}
    </button>
  );
}
