"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n-context";

type RateData = {
  currency: string;
  rate: number;
  source: string | null;
  fetched_at: string;
};

type Props = {
  onRateChange?: (rate: number | null) => void;
  initialRate?: RateData | null;
};

export default function UsdRateCard({ onRateChange, initialRate }: Props) {
  const { locale } = useI18n();
  const [data, setData] = useState<RateData | null>(initialRate ?? null);
  const [loading, setLoading] = useState(!initialRate);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRate, setManualRate] = useState("");
  const [showManual, setShowManual] = useState(false);

  const lbl = (en: string, ar: string) => (locale === "ar" ? ar : en);

  useEffect(() => {
    if (initialRate) {
      onRateChange?.(initialRate.rate);
      return;
    }
    fetch("/api/exchange-rate")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: RateData) => {
        if (!d || typeof d.rate !== "number") throw new Error();
        setData(d);
        setLoading(false);
        onRateChange?.(d.rate);
      })
      .catch(() => {
        setLoading(false);
        setError(lbl("Could not load rate.", "تعذّر تحميل سعر الصرف."));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFromCBE = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/exchange-rate", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? lbl("Refresh failed.", "فشل التحديث."));
        setShowManual(true);
      } else {
        setData(d);
        onRateChange?.(d.rate);
        setShowManual(false);
      }
    } catch {
      setError(lbl("Network error during refresh.", "خطأ في الشبكة أثناء التحديث."));
      setShowManual(true);
    } finally {
      setRefreshing(false);
    }
  }, [locale, onRateChange]);

  const saveManualRate = useCallback(async () => {
    const val = parseFloat(manualRate);
    if (isNaN(val) || val <= 0) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/exchange-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: val }),
      });
      const d = await res.json();
      if (res.ok) {
        setData(d);
        onRateChange?.(d.rate);
        setShowManual(false);
        setManualRate("");
        setError(null);
      }
    } finally {
      setRefreshing(false);
    }
  }, [manualRate, onRateChange]);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch { return iso; }
  };

  const isStale = data && data.fetched_at
    ? Date.now() - new Date(data.fetched_at).getTime() > 7 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div style={{
      backgroundColor: "var(--bg-surface)",
      borderRadius: "14px",
      border: "1px solid var(--border-light)",
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Compact Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #0f4c81 0%, #1d6fa4 100%)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px",
          backgroundColor: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "15px", flexShrink: 0,
        }}>
          💱
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.65)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {lbl("CBE Official Rate", "السعر الرسمي – البنك المركزي")}
          </div>
          <div style={{ fontSize: "13px", fontWeight: "800", color: "#fff", lineHeight: 1.2 }}>
            {lbl("USD / EGP Exchange Rate", "سعر صرف الدولار / الجنيه")}
          </div>
        </div>
        {isStale && (
          <span style={{
            fontSize: "9px", fontWeight: "700", padding: "2px 7px",
            borderRadius: "20px", backgroundColor: "rgba(245,158,11,0.3)",
            color: "#fde68a", border: "1px solid rgba(245,158,11,0.4)",
            flexShrink: 0,
          }}>
            ⚠️ {lbl("Stale", "قديم")}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-muted)", fontSize: "12px" }}>
            ⏳ {lbl("Loading rate…", "جارٍ تحميل السعر…")}
          </div>
        ) : (
          <>
            {/* Rate Display Row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <div>
                <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>
                  {lbl("1 USD equals", "1 دولار يساوي")}
                </div>
                {data && typeof data.rate === "number" ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <span style={{ fontSize: "28px", fontWeight: "900", color: "var(--primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {data.rate.toFixed(4)}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>EGP</span>
                  </div>
                ) : (
                  <div style={{ fontSize: "16px", color: "var(--text-muted)", fontWeight: "600" }}>
                    {lbl("Not yet fetched", "لم يُحدَّث بعد")}
                  </div>
                )}
                {data && (
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
                    🕐 {formatTime(data.fetched_at)}
                    {data.source && (
                      <span style={{ marginLeft: "5px", color: "var(--text-dim)" }}>· {data.source}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Refresh Button — compact icon button */}
              <button
                type="button"
                onClick={refreshFromCBE}
                disabled={refreshing}
                title={lbl("Refresh from CBE", "تحديث من البنك المركزي")}
                style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  border: "1px solid var(--border-medium)",
                  backgroundColor: refreshing ? "var(--bg-subtle)" : "var(--bg-elevated)",
                  color: refreshing ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: refreshing ? "not-allowed" : "pointer",
                  fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 150ms",
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                }}
              >
                🔄
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div style={{
                padding: "7px 10px",
                backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "7px", fontSize: "11px",
                color: "var(--danger)", lineHeight: 1.4,
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Manual entry toggle */}
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              style={{
                background: "none", border: "none",
                color: "var(--text-muted)", fontSize: "10px",
                cursor: "pointer", textDecoration: "underline",
                textAlign: "left", padding: "0",
              }}
            >
              {showManual ? lbl("▲ Hide manual entry", "▲ إخفاء الإدخال") : lbl("⌨ Enter rate manually", "⌨ إدخال السعر يدوياً")}
            </button>

            {/* Manual rate input */}
            {showManual && (
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="number" step="0.0001" min="1"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  placeholder={lbl("e.g. 50.2963", "مثال: 50.2963")}
                  onKeyDown={(e) => e.key === "Enter" && saveManualRate()}
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-medium)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "12px" }}
                />
                <button
                  type="button" onClick={saveManualRate}
                  disabled={refreshing || !manualRate}
                  style={{ padding: "7px 13px", borderRadius: "7px", border: "none", backgroundColor: "var(--primary)", color: "#fff", fontWeight: "700", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
                >
                  {lbl("Save", "حفظ")}
                </button>
              </div>
            )}

            {/* ── Schedule note ───────────────────────────────── */}
            <div style={{
              marginTop: "4px",
              padding: "7px 10px",
              borderRadius: "7px",
              backgroundColor: "rgba(29,111,164,0.07)",
              border: "1px solid rgba(29,111,164,0.18)",
              fontSize: "10px",
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}>
              📅 {lbl(
                "Auto-refreshes every Sunday at 9:00 AM (Egypt time · EET). Click 🔄 for an immediate update.",
                "يتجدد تلقائياً كل يوم أحد الساعة 9:00 صباحاً (توقيت مصر). اضغط 🔄 لتحديث فوري."
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
