"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";

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
    item_name: string;
    item_unit: string;
    category_name: string;
  }[];
};

export default function PriceUpdateAlerts({ recentUpdates }: PriceUpdateAlertsProps) {
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
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.05) 100%)",
              border: "1.5px solid rgba(239, 68, 68, 0.25)",
              borderInlineStart: "5px solid var(--danger)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              animation: "slideIn 0.3s ease-out"
            }}
          >
            {/* Header / Alert Icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Pulsing red live indicator */}
                <span style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--danger)",
                  boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.7)",
                  animation: "pulse 1.8s infinite"
                }} />
                
                <span style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "var(--danger)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}>
                  {isAr ? "⚠️ تحديث هام للأسعار" : "⚠️ CRITICAL PRICE UPDATE"}
                </span>
              </div>
              
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

            {/* Change Reason & Metadata */}
            {update.change_reason && (
              <div style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "8.5px 12px",
                fontSize: "12.5px",
                color: "var(--text-primary)",
                lineHeight: "1.45"
              }}>
                <strong>{isAr ? "سبب التحديث:" : "Update Reason:"}</strong> {update.change_reason}
              </div>
            )}

            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <span>{isAr ? "بواسطة:" : "By:"} {update.changed_by}</span>
              <span>•</span>
              <span>{formatDateTime(update.changed_at)}</span>
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
