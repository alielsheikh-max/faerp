"use client";

import { useState, useEffect } from "react";
import { publishSellingPrice } from "@/app/actions/pricing";
import { formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import type { SellingPriceHistoryRow } from "@/lib/db";

type PricingCalculatorProps = {
  month: string;
  itemId: number;
  createdBy: string;
  buyMin: number;
  buyMax: number;
  buyAvg: number;
  /** Effective margin floor % for this item (null = no floor configured) */
  floorPct?: number | null;
  /** Recent audit history entries for this item+month */
  history?: SellingPriceHistoryRow[];
  existing: {
    strategy: string;
    markup_type?: string;
    markup_min: number;
    markup_max: number;
    sell_min: number;
    sell_max: number;
    created_at: string;
  } | null | undefined;
  redirectTo?: string;
  errorRedirect?: string;
};

export default function PricingCalculator({
  month,
  itemId,
  createdBy,
  buyMin,
  buyMax,
  buyAvg,
  floorPct = null,
  history = [],
  existing,
  redirectTo,
  errorRedirect,
}: PricingCalculatorProps) {
  const [strategy, setStrategy] = useState<"min" | "avg" | "max">(
    (existing?.strategy as "min" | "avg" | "max") || "avg"
  );
  const [markupType, setMarkupType] = useState<"percent" | "amount">(
    existing?.markup_type === "amount" ? "amount" : "percent"
  );
  const [markupMin, setMarkupMin] = useState<number>(existing?.markup_min ?? 8);
  const [markupMax, setMarkupMax] = useState<number>(existing?.markup_max ?? 14);
  const [basePrice, setBasePrice] = useState<number>(buyAvg);
  const [changeReason, setChangeReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const selectedBase = strategy === "min" ? buyMin : strategy === "max" ? buyMax : buyAvg;
    setBasePrice(selectedBase);
  }, [strategy, buyMin, buyMax, buyAvg]);

  // ── Derived selling prices ──────────────────────────────────────────────────
  const liveSellMin =
    markupType === "amount" ? basePrice + markupMin : basePrice * (1 + markupMin / 100);
  const liveSellMax =
    markupType === "amount" ? basePrice + markupMax : basePrice * (1 + markupMax / 100);

  // ── Margin floor check (live, client-side) ──────────────────────────────────
  // For percent mode: markupMin must be >= floorPct
  // For amount mode: convert to equivalent pct against base for comparison
  const effectiveMarkupMinPct =
    markupType === "percent"
      ? markupMin
      : basePrice > 0
      ? (markupMin / basePrice) * 100
      : 0;

  const floorViolated = floorPct !== null && effectiveMarkupMinPct < floorPct;
  const floorWarn = floorPct !== null && effectiveMarkupMinPct >= floorPct && effectiveMarkupMinPct < floorPct + 2;

  // ── Preset helpers ──────────────────────────────────────────────────────────
  const handleMarkupTypeChange = (newType: "percent" | "amount") => {
    setMarkupType(newType);
    if (newType === "amount") {
      setMarkupMin(Math.round(basePrice * 0.08));
      setMarkupMax(Math.round(basePrice * 0.15));
    } else {
      setMarkupMin(floorPct !== null ? Math.max(floorPct, 8) : 8);
      setMarkupMax(14);
    }
  };

  const applyPreset = (minVal: number, maxVal: number) => {
    setMarkupMin(minVal);
    setMarkupMax(maxVal);
  };

  const handleSellMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    if (markupType === "amount") {
      setMarkupMin(Math.max(0, parseFloat((val - basePrice).toFixed(2))));
    } else {
      if (basePrice > 0) {
        setMarkupMin(Math.max(0, parseFloat((((val / basePrice) - 1) * 100).toFixed(2))));
      }
    }
  };

  const handleSellMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    if (markupType === "amount") {
      setMarkupMax(Math.max(0, parseFloat((val - basePrice).toFixed(2))));
    } else {
      if (basePrice > 0) {
        setMarkupMax(Math.max(0, parseFloat((((val / basePrice) - 1) * 100).toFixed(2))));
      }
    }
  };

  const percentPresets = [
    { label: "Low (5–10%)", min: 5, max: 10 },
    { label: "Balanced (8–14%)", min: 8, max: 14 },
    { label: "High (12–20%)", min: 12, max: 20 },
    { label: "Aggressive (15–25%)", min: 15, max: 25 },
  ];

  const amountBase = Math.round(basePrice);
  const amountPresets = [
    { label: `+${Math.round(amountBase * 0.05)} / +${Math.round(amountBase * 0.1)} ج.م`, min: Math.round(amountBase * 0.05), max: Math.round(amountBase * 0.1) },
    { label: `+${Math.round(amountBase * 0.08)} / +${Math.round(amountBase * 0.15)} ج.م`, min: Math.round(amountBase * 0.08), max: Math.round(amountBase * 0.15) },
    { label: `+${Math.round(amountBase * 0.12)} / +${Math.round(amountBase * 0.2)} ج.م`, min: Math.round(amountBase * 0.12), max: Math.round(amountBase * 0.2) },
    { label: `+${Math.round(amountBase * 0.15)} / +${Math.round(amountBase * 0.25)} ج.م`, min: Math.round(amountBase * 0.15), max: Math.round(amountBase * 0.25) },
  ];

  const activePresets = markupType === "amount" ? amountPresets : percentPresets;
  const isUpdate = !!existing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

      {/* ── Base Price Card ─────────────────────────────────────────────────── */}
      <div className="summary-card accent-card" style={{ padding: "14px 16px" }}>
        <span className="eyebrow" style={{ fontSize: "10px" }}>سعر التكلفة الأساسي (شامل جميع التكاليف)</span>
        <div style={{ display: "flex", gap: "20px", marginTop: "8px", flexWrap: "wrap" }}>
          {[
            { label: "أقل سعر", val: buyMin, color: "var(--success)" },
            { label: "متوسط السعر", val: buyAvg, color: "var(--primary)" },
            { label: "أعلى سعر", val: buyMax, color: "var(--danger)" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                {s.label}
              </span>
              <span style={{ fontSize: "15px", fontWeight: 800, color: s.color }}>
                {formatCurrency(s.val)}
              </span>
            </div>
          ))}
        </div>
        {/* Floor indicator */}
        {floorPct !== null && (
          <div style={{
            marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border-light)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>حد الهامش الأدنى المسموح:</span>
            <span style={{
              fontSize: "12px", fontWeight: 800,
              color: floorViolated ? "var(--danger)" : "var(--warning)",
              background: floorViolated ? "var(--danger-light)" : "var(--warning-light)",
              padding: "2px 8px", borderRadius: "6px",
              border: `1px solid ${floorViolated ? "rgba(220,38,38,0.3)" : "rgba(217,119,6,0.3)"}`,
            }}>
              {floorPct}% هامش كحد أدنى
            </span>
          </div>
        )}
      </div>

      {/* ── Floor Violation Banner ──────────────────────────────────────────── */}
      {floorViolated && (
        <div style={{
          padding: "12px 16px",
          background: "var(--danger-light)",
          border: "1.5px solid rgba(220,38,38,0.4)",
          borderRadius: "var(--radius)",
          display: "flex", alignItems: "flex-start", gap: "10px",
        }}>
          <span style={{ fontSize: "18px", flexShrink: 0, lineHeight: 1 }}>🚫</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--danger)", marginBottom: "3px" }}>
              انتهاك حد الهامش الأدنى
            </div>
            <div style={{ fontSize: "12px", color: "var(--danger)", lineHeight: 1.5 }}>
              الهامش المحدد ({effectiveMarkupMinPct.toFixed(1)}%) أقل من الحد الأدنى المسموح ({floorPct}%).
              يجب رفع هامش الربح الأدنى قبل الحفظ.
            </div>
          </div>
        </div>
      )}

      {/* ── Floor Near-Warning ──────────────────────────────────────────────── */}
      {floorWarn && !floorViolated && (
        <div style={{
          padding: "10px 14px",
          background: "var(--warning-light)",
          border: "1px solid rgba(217,119,6,0.35)",
          borderRadius: "var(--radius)",
          display: "flex", alignItems: "center", gap: "8px",
          fontSize: "12px", color: "var(--warning)",
        }}>
          <span>⚠️</span>
          <span>الهامش قريب جداً من الحد الأدنى ({floorPct}%). تأكد أن هذا مقصود.</span>
        </div>
      )}

      {/* ── Markup Mode Toggle ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Markup Mode
        </span>
        <div style={{ display: "flex", background: "var(--bg-subtle)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", gap: "4px" }}>
          {(["percent", "amount"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleMarkupTypeChange(mode)}
              className={`button ${markupType === mode ? "button-primary" : "button-secondary"}`}
              style={{ flex: 1, padding: "8px", fontSize: "11px", borderRadius: "7px", cursor: "pointer", transition: "all 200ms" }}
            >
              {mode === "percent" ? "% Percentage Markup" : "EGP Fixed Amount"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick Presets ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Quick Margin Presets
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {activePresets.map((preset) => {
            // Highlight presets that would violate the floor
            const presetPct = markupType === "percent"
              ? preset.min
              : basePrice > 0 ? (preset.min / basePrice) * 100 : 0;
            const wouldViolate = floorPct !== null && presetPct < floorPct;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => !wouldViolate && applyPreset(preset.min, preset.max)}
                disabled={wouldViolate}
                className="markup-preset-btn"
                style={{
                  fontSize: "11px", padding: "6px 10px",
                  background: wouldViolate ? "var(--danger-light)" : "var(--bg-elevated)",
                  border: `1px solid ${wouldViolate ? "rgba(220,38,38,0.3)" : "var(--border-light)"}`,
                  borderRadius: "6px", cursor: wouldViolate ? "not-allowed" : "pointer",
                  color: wouldViolate ? "var(--danger)" : "var(--text-secondary)",
                  opacity: wouldViolate ? 0.6 : 1,
                  transition: "all 150ms",
                }}
                title={wouldViolate ? `Below floor (${floorPct}%)` : undefined}
              >
                {preset.label}
                {wouldViolate && " 🚫"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Action Form ────────────────────────────────────────────────────── */}
      <form
        action={publishSellingPrice}
        className="form-grid compact-form"
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="createdBy" value={createdBy} />
        <input type="hidden" name="markupType" value={markupType} />
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
        {errorRedirect && <input type="hidden" name="errorRedirect" value={errorRedirect} />}

        {/* Strategy selector */}
        <label className="field">
          <span>Pricing Strategy Base</span>
          <select
            name="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as "min" | "avg" | "max")}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            <option value="min">Cheapest Supplier — {formatCurrency(buyMin)}</option>
            <option value="avg">Average Supplier — {formatCurrency(buyAvg)}</option>
            <option value="max">Highest Supplier — {formatCurrency(buyMax)}</option>
          </select>
        </label>

        {/* Min row */}
        <div style={{ display: "flex", gap: "12px" }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Min Markup {markupType === "percent" ? "%" : "(EGP)"}</span>
            <input
              type="number"
              name="markupMin"
              min="0"
              step={markupType === "percent" ? "0.1" : "1"}
              value={markupMin}
              onChange={(e) => setMarkupMin(parseFloat(e.target.value) || 0)}
              style={{
                padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
                border: `1.5px solid ${floorViolated ? "var(--danger)" : "var(--border)"}`,
                background: floorViolated ? "var(--danger-light)" : "var(--bg-elevated)",
                color: "var(--text-primary)",
                boxShadow: floorViolated ? "var(--glow-danger)" : "none",
              }}
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Min Selling Price (EGP)</span>
            <input
              type="number"
              name="sellMin"
              step="any"
              value={parseFloat(liveSellMin.toFixed(2))}
              onChange={handleSellMinChange}
              style={{
                padding: "8px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
                border: `1.5px solid ${floorViolated ? "var(--danger)" : "var(--border)"}`,
                background: "var(--bg-elevated)",
                color: floorViolated ? "var(--danger)" : "var(--success)",
              }}
            />
          </label>
        </div>

        {/* Max row */}
        <div style={{ display: "flex", gap: "12px" }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Max Markup {markupType === "percent" ? "%" : "(EGP)"}</span>
            <input
              type="number"
              name="markupMax"
              min="0"
              step={markupType === "percent" ? "0.1" : "1"}
              value={markupMax}
              onChange={(e) => setMarkupMax(parseFloat(e.target.value) || 0)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Max Selling Price (EGP)</span>
            <input
              type="number"
              name="sellMax"
              step="any"
              value={parseFloat(liveSellMax.toFixed(2))}
              onChange={handleSellMaxChange}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 700, fontSize: "13px" }}
            />
          </label>
        </div>

        {/* Change reason — required when updating an existing price */}
        {isUpdate && (
          <label className="field">
            <span>
              Change Reason
              <span style={{ color: "var(--text-muted)", fontWeight: 400, marginInlineStart: "4px" }}>(optional — logged in audit trail)</span>
            </span>
            <input
              type="text"
              name="changeReason"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g. Supplier raised prices, seasonal adjustment…"
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
            />
          </label>
        )}

        {/* Submit */}
        <div style={{ marginTop: "4px" }}>
          <button
            type="submit"
            disabled={floorViolated}
            className="button button-primary button-block"
            style={{
              padding: "10px", fontSize: "13px", cursor: floorViolated ? "not-allowed" : "pointer",
              opacity: floorViolated ? 0.5 : 1,
            }}
            title={floorViolated ? `Cannot save: below minimum margin floor of ${floorPct}%` : undefined}
          >
            {isUpdate ? "Update Selling Prices" : "Publish Selling Prices to Sales"}
          </button>
          {floorViolated && (
            <p style={{ textAlign: "center", fontSize: "11px", color: "var(--danger)", marginTop: "6px", fontWeight: 600 }}>
              ارفع الهامش الأدنى إلى {floorPct}% على الأقل لتتمكن من الحفظ
            </p>
          )}
        </div>
      </form>

      {/* ── Audit History ──────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "none", border: "none", cursor: "pointer", padding: "0",
              fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)",
              width: "100%", justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>📋</span>
              Price Change Audit Trail
              <span style={{
                fontSize: "10px", fontWeight: 800, background: "var(--bg-subtle)",
                border: "1px solid var(--border)", borderRadius: "99px",
                padding: "1px 7px", color: "var(--text-muted)",
              }}>{history.length}</span>
            </span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {showHistory ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {showHistory && (
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {history.map((h) => {
                const isFirstPublish = !h.is_update;
                return (
                  <div
                    key={h.id}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "var(--radius)",
                      background: isFirstPublish ? "var(--success-light)" : "var(--bg-elevated)",
                      border: `1px solid ${isFirstPublish ? "rgba(16,185,129,0.25)" : "var(--border-light)"}`,
                    }}
                  >
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: "9px", fontWeight: 800, textTransform: "uppercase",
                        letterSpacing: "0.08em", padding: "2px 7px", borderRadius: "4px",
                        background: isFirstPublish ? "var(--success)" : "var(--primary)",
                        color: "#fff",
                      }}>
                        {isFirstPublish ? "First Publish" : "Updated"}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {formatMonthLabel(h.month)}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginInlineStart: "auto" }}>
                        {formatDateTime(h.changed_at)} · {h.changed_by}
                      </span>
                    </div>

                    {/* Price change row */}
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px" }}>
                      {h.prev_sell_min !== null && (
                        <div>
                          <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>Previous</span>
                          <div style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                            {formatCurrency(h.prev_sell_min)} → {formatCurrency(h.prev_sell_max ?? 0)}
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {h.prev_markup_min?.toFixed(1)}% – {h.prev_markup_max?.toFixed(1)}%
                            {h.prev_strategy ? ` · ${h.prev_strategy.toUpperCase()}` : ""}
                          </div>
                        </div>
                      )}
                      {h.prev_sell_min !== null && (
                        <div style={{ alignSelf: "center", color: "var(--text-dim)", fontSize: "16px" }}>→</div>
                      )}
                      <div>
                        <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                          {isFirstPublish ? "Published" : "New"}
                        </span>
                        <div style={{ fontWeight: 800, color: isFirstPublish ? "var(--success)" : "var(--primary)" }}>
                          {formatCurrency(h.new_sell_min)} → {formatCurrency(h.new_sell_max)}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                          {h.new_markup_min.toFixed(1)}% – {h.new_markup_max.toFixed(1)}%
                          {" · "}{h.new_strategy.toUpperCase()}
                          {" · Avg buy "}{formatCurrency(h.new_buy_avg)}
                        </div>
                      </div>
                    </div>

                    {/* Change reason */}
                    {h.change_reason && (
                      <div style={{
                        marginTop: "6px", padding: "5px 10px",
                        background: "var(--bg-subtle)", borderRadius: "6px",
                        fontSize: "11px", color: "var(--text-secondary)",
                        borderInlineStart: "3px solid var(--primary)",
                      }}>
                        💬 {h.change_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
