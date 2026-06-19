"use client";

import { useState, useEffect, useTransition } from "react";

type RateData = { rate: number; date: string; source: string; timestamp: string };

export default function UsdRateCompact() {
  const [data, setData]       = useState<RateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [isPending, start]    = useTransition();

  const loadRate = async () => {
    try {
      const res = await globalThis.fetch("/api/exchange-rate");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRate(); }, []);

  const handleRefresh = () => {
    start(async () => {
      try {
        const res = await globalThis.fetch("/api/exchange-rate", { method: "POST" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setData(json);
        setError(false);
      } catch {
        setError(true);
      }
    });
  };

  // Format date: 17-06-2026
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch {
      return iso;
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "11px 14px", borderRadius: "12px",
      background: "linear-gradient(135deg, #0f4c81 0%, #1d6fa4 100%)",
      border: "1.5px solid rgba(255,255,255,0.12)",
      boxShadow: "0 4px 14px rgba(15,76,129,0.45)",
      color: "#fff", width: "100%",
      transition: "all 200ms ease",
    }}>
      {/* Icon */}
      <span style={{
        width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
        background: "rgba(255,255,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "14px",
      }}>💱</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.1em", opacity: 0.7, marginBottom: "2px" }}>
          CBE · USD / EGP
        </div>
        {loading ? (
          <div style={{ fontSize: "13px", fontWeight: 700, opacity: 0.7 }}>Loading…</div>
        ) : error ? (
          <div style={{ fontSize: "12px", opacity: 0.7 }}>Rate unavailable</div>
        ) : (
          <>
            <div style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {data?.rate.toFixed(4)}
              <span style={{ fontSize: "11px", fontWeight: 600, opacity: 0.8, marginInlineStart: "4px" }}>EGP</span>
            </div>
            {data?.date && (
              <div style={{ fontSize: "9px", opacity: 0.6, marginTop: "2px" }}>
                {formatDate(data.date)} · {data.source ?? "CBE"}
              </div>
            )}
          </>
        )}
      </div>

      {/* Refresh button */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending || loading}
        title="Refresh rate from CBE"
        style={{
          width: "26px", height: "26px", borderRadius: "6px", flexShrink: 0,
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", transition: "all 200ms",
          animation: isPending ? "spin 1s linear infinite" : "none",
        }}
      >
        🔄
      </button>
    </div>
  );
}
