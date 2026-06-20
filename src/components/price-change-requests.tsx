"use client";

import { useState, useTransition } from "react";
import {
  approvePriceChangeRequestAction,
  rejectPriceChangeRequestAction,
} from "@/app/actions/pricing";
import { formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import type { PriceChangeRequest } from "@/lib/db";
import { useI18n } from "@/lib/i18n-context";

type Props = {
  requests: PriceChangeRequest[];
  username: string;
};

export default function PriceChangeRequests({ requests, username }: Props) {
  const { t, isRTL } = useI18n();
  const [reviewNote, setReviewNote]     = useState<Record<number, string>>({});
  const [processing, setProcessing]     = useState<number | null>(null);
  const [pending, startTransition]      = useTransition();

  const handleApprove = (id: number) => {
    setProcessing(id);
    const fd = new FormData();
    fd.set("requestId",  String(id));
    fd.set("reviewedBy", username);
    fd.set("reviewNote", reviewNote[id] ?? "");
    startTransition(async () => {
      await approvePriceChangeRequestAction(fd);
      setProcessing(null);
    });
  };

  const handleReject = (id: number) => {
    if (!reviewNote[id]?.trim()) {
      alert(t("pcr.errNoteRequired"));
      return;
    }
    setProcessing(id);
    const fd = new FormData();
    fd.set("requestId",  String(id));
    fd.set("reviewedBy", username);
    fd.set("reviewNote", reviewNote[id] ?? "");
    startTransition(async () => {
      await rejectPriceChangeRequestAction(fd);
      setProcessing(null);
    });
  };

  if (requests.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
        <span style={{ fontSize: "32px", display: "block", marginBottom: "10px" }}>✅</span>
        {t("pcr.noRequests")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {requests.map((req) => {
        const priceDiff = req.new_price - req.old_price;
        const pricePct  = req.old_price > 0 ? (priceDiff / req.old_price) * 100 : 0;
        const isIncrease = priceDiff > 0;
        const isMe = processing === req.id;

        return (
          <div
            key={req.id}
            style={{
              padding: "16px 18px",
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--border-medium)",
              background: "var(--bg-surface)",
              boxShadow: "var(--shadow-sm)",
              opacity: isMe && pending ? 0.6 : 1,
              transition: "opacity 200ms",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px", flexWrap: "wrap", flexDirection: isRTL ? "row-reverse" : "row" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--warning)", marginBottom: "3px" }}>
                  {t("pcr.pendingReview")}
                </div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "2px" }}>
                  {req.item_name}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flexDirection: isRTL ? "row-reverse" : "row" }}>
                  <span className="badge" style={{ fontSize: "10px" }}>{req.category_name}</span>
                  <span className="badge badge-strong" style={{ fontSize: "10px" }}>{req.supplier_name}</span>
                  <span className="badge" style={{ fontSize: "10px" }}>{formatMonthLabel(req.month)}</span>
                </div>
              </div>

              {/* Price change summary */}
              <div style={{
                padding: "10px 14px",
                background: isIncrease ? "var(--danger-light)" : "var(--success-light)",
                border: `1px solid ${isIncrease ? "rgba(220,38,38,0.25)" : "rgba(16,185,129,0.25)"}`,
                borderRadius: "var(--radius)",
                display: "flex", flexDirection: "column", gap: "4px", minWidth: "160px",
                textAlign: isRTL ? "right" : "left",
              }}>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>{t("pcr.priceChange")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", textDecoration: "line-through" }}>
                    {formatCurrency(req.old_price)}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{isRTL ? "←" : "→"}</span>
                  <span style={{ fontSize: "15px", fontWeight: 800, color: isIncrease ? "var(--danger)" : "var(--success)" }}>
                    {formatCurrency(req.new_price)}
                  </span>
                </div>
                <div style={{
                  fontSize: "11px", fontWeight: 800,
                  color: isIncrease ? "var(--danger)" : "var(--success)",
                }}>
                  {isIncrease ? "▲" : "▼"} {Math.abs(priceDiff).toFixed(2)} {t("gen.egp")} ({Math.abs(pricePct).toFixed(1)}%)
                </div>
              </div>
            </div>

            {/* Reason from WH */}
            <div style={{
              padding: "8px 12px", marginBottom: "12px",
              background: "var(--bg-subtle)", borderRadius: "var(--radius)",
              borderInlineStart: isRTL ? "none" : "3px solid var(--warning)",
              borderInlineEnd: isRTL ? "3px solid var(--warning)" : "none",
              fontSize: "12px", color: "var(--text-secondary)",
              textAlign: isRTL ? "right" : "left",
            }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{t("pcr.whReason")} </span>
              {req.reason}
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", textAlign: isRTL ? "right" : "left" }}>
              {t("pcr.requestedBy")
                .replace("{user}", req.requested_by)
                .replace("{date}", formatDateTime(req.requested_at))}
            </div>

            {/* Review note input */}
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexDirection: isRTL ? "row-reverse" : "row" }}>
              <label className="field" style={{ flex: 1, textAlign: isRTL ? "right" : "left" }}>
                <span>{t("pcr.reviewNote")} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{t("pcr.reviewNoteHint")}</span></span>
                <input
                  type="text"
                  value={reviewNote[req.id] ?? ""}
                  onChange={e => setReviewNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                  placeholder={t("pcr.reviewNotePlaceholder")}
                  dir={isRTL ? "rtl" : "ltr"}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px", textAlign: isRTL ? "right" : "left" }}
                />
              </label>
              <button
                type="button"
                onClick={() => handleApprove(req.id)}
                disabled={isMe && pending}
                className="button button-success"
                style={{ padding: "8px 18px", fontSize: "12px", whiteSpace: "nowrap" }}
              >
                ✓ {t("gen.approve")}
              </button>
              <button
                type="button"
                onClick={() => handleReject(req.id)}
                disabled={isMe && pending}
                className="button button-danger"
                style={{ padding: "8px 18px", fontSize: "12px", whiteSpace: "nowrap" }}
              >
                ✕ {t("gen.reject")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
