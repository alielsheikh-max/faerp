"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import { acknowledgeAlertAction } from "@/app/actions/notifications";

type PriceUpdateAlertsProps = {
  recentUpdates: {
    id: number;
    item_id: number;
    month: string;
    prev_sell_min: number | null;
    prev_sell_max: number | null;
    new_sell_min: number;
    new_sell_max: number;
    changed_by: string;
    changed_at: string;
    change_reason: string | null;
    /** T17: SA-visible notification message */
    sa_note: string | null;
    /** T17: SC-only internal note (not shown here) */
    internal_note: string | null;
    /** T18: acknowledgment info */
    ack_by: string | null;
    ack_at: string | null;
    item_name: string;
    item_unit: string;
    category_name: string;
  }[];
  /** SC: hides acknowledgement status and button; SA: shows full ack UI */
  role?: "SC" | "SA" | "AD";
};

export default function PriceUpdateAlerts({ recentUpdates, role }: PriceUpdateAlertsProps) {
  const { locale } = useI18n();
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load acknowledged alerts from sessionStorage
    try {
      const stored = sessionStorage.getItem("acknowledged_price_alerts");
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoaded(true);
  }, []);

  const handleDismiss = (id: number) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try {
      sessionStorage.setItem("acknowledged_price_alerts", JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };

  // T18: Acknowledge + persist to DB
  const handleAcknowledge = async (id: number, historyId: number) => {
    handleDismiss(id); // optimistic local dismiss
    const fd = new FormData();
    fd.set("historyId", String(historyId));
    await acknowledgeAlertAction(fd);
  };

  const activeUpdates = recentUpdates.filter((u) => !dismissedIds.includes(u.id));

  if (!isLoaded || activeUpdates.length === 0) return null;

  const isAr = locale === "ar";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
      {activeUpdates.map((update) => {
        const hasPrev = update.prev_sell_min !== null && update.prev_sell_max !== null;
        
        return (
          <div
            key={update.id}
            style={{
              position: "relative",
              padding: "16px 20px",
              background: role === "SC"
                ? "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.04) 100%)"
                : "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.05) 100%)",
              border: role === "SC"
                ? "1.5px solid rgba(99,102,241,0.22)"
                : "1.5px solid rgba(239, 68, 68, 0.25)",
              borderInlineStart: role === "SC"
                ? "5px solid #6366f1"
                : "5px solid var(--danger)",
              borderRadius: "12px",
              boxShadow: role === "SC"
                ? "0 4px 12px rgba(99,102,241,0.06)"
                : "0 4px 12px rgba(239, 68, 68, 0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              animation: "slideIn 0.3s ease-out"
            }}
          >
            {/* Header / Alert Icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Pulsing indicator */}
                <span style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: role === "SC" ? "#6366f1" : "var(--danger)",
                  boxShadow: role === "SC"
                    ? "0 0 0 0 rgba(99,102,241,0.7)"
                    : "0 0 0 0 rgba(239, 68, 68, 0.7)",
                  animation: "pulse 1.8s infinite"
                }} />
                
                <span style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: role === "SC" ? "#4338ca" : "var(--danger)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}>
                  {role === "SC"
                    ? (isAr ? "✓ تحديث سعر منشور" : "✓ PUBLISHED PRICE CHANGE")
                    : (isAr ? "⚠️ تحديث هام للأسعار" : "⚠️ CRITICAL PRICE UPDATE")}
                </span>
              </div>
              
              {/* Top dismiss — hidden for SC (read-only monitoring feed) */}
              {role !== "SC" && (
                <button
                  type="button"
                  onClick={() => handleDismiss(update.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    textDecoration: "underline"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--danger)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                >
                  {isAr ? "إخفاء التنبيه" : "Acknowledge Alert"}
                </button>
              )}
            </div>

            {/* Title / Description */}
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              {update.item_name} ({update.item_unit}) — {update.category_name}
            </div>

            {/* New prices compared to old */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "13px" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>{isAr ? "الأسعار الجديدة:" : "New Pricing:"} </span>
                <strong style={{ color: "var(--danger)", fontSize: "14px" }}>
                  {formatCurrency(update.new_sell_min)} ~ {formatCurrency(update.new_sell_max)}
                </strong>
              </div>
              
              {hasPrev && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  <span>{isAr ? "كانت:" : "Was:"} </span>
                  <span style={{ textDecoration: "line-through" }}>
                    {formatCurrency(update.prev_sell_min!)} ~ {formatCurrency(update.prev_sell_max!)}
                  </span>
                </div>
              )}
            </div>

            {/* T17: SA notification message (highlighted) */}
            {update.sa_note && (
              <div style={{
                background: "linear-gradient(135deg,rgba(59,130,246,0.10) 0%,rgba(99,102,241,0.08) 100%)",
                border: "1.5px solid rgba(59,130,246,0.3)",
                borderRadius: "8px", padding: "8px 12px",
                fontSize: "12.5px", color: "var(--text-primary)", lineHeight: "1.45"
              }}>
                <strong style={{ color: "var(--primary)" }}>📢 Message from SC:</strong>{" "}{update.sa_note}
              </div>
            )}

            {/* Change Reason (secondary, only shown if different from sa_note) */}
            {update.change_reason && update.change_reason !== update.sa_note && (
              <div style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "8px", padding: "8.5px 12px",
                fontSize: "12.5px", color: "var(--text-primary)", lineHeight: "1.45"
              }}>
                <strong>{isAr ? "سبب التحديث:" : "Update Reason:"}</strong> {update.change_reason}
              </div>
            )}

            {/* T18: Already acknowledged indicator — only shown to SA, not SC */}
            {update.ack_by && role !== "SC" && (
              <div style={{ fontSize: "11px", color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>
                <span>✓</span>
                <span>Seen by <strong>{update.ack_by}</strong> at {formatDateTime(update.ack_at)}</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                <span>{isAr ? "بواسطة:" : "By:"} {update.changed_by}</span>
                <span>•</span>
                <span>{formatDateTime(update.changed_at)}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {/* T18: Acknowledge button — only for SA, not SC */}
                {!update.ack_by && role !== "SC" && (
                  <button
                    onClick={() => handleAcknowledge(update.id, update.id)}
                    style={{
                      padding: "5px 12px", borderRadius: "7px", border: "1.5px solid var(--success)",
                      background: "rgba(16,185,129,0.1)", color: "var(--success)",
                      fontSize: "11px", fontWeight: 700, cursor: "pointer"
                    }}>
                    ✓ Acknowledge
                  </button>
                )}
                {/* Bottom dismiss — hidden for SC */}
                {role !== "SC" && (
                  <button
                    onClick={() => handleDismiss(update.id)}
                    style={{
                      padding: "5px 12px", borderRadius: "7px", border: "1px solid var(--border)",
                      background: "var(--bg-elevated)", color: "var(--text-muted)",
                      fontSize: "11px", cursor: "pointer"
                    }}>
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Styled pulsing dot keyframes for this block */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
