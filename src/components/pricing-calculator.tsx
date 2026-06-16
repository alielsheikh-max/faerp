"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { publishSellingPriceAction } from "@/app/actions/pricing";
import { formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import type { SellingPriceHistoryRow } from "@/lib/db";
import { useI18n } from "@/lib/i18n-context";

type PriceEntry = {
  id: number;
  item_id: number;
  supplier_id: number;
  month: string;
  price: number;
  recorded_at: string;
  supplier_name: string;
};

type Supplier = {
  id: number;
  name: string;
};

type PricingCalculatorProps = {
  month: string;
  itemId: number;
  createdBy: string;
  buyMin: number;
  buyMax: number;
  buyAvg: number;
  floorPct?: number | null;
  history?: SellingPriceHistoryRow[];
  existing: {
    strategy: string;
    markup_type?: string;
    markup_min: number;
    markup_max: number;
    sell_min: number;
    sell_max: number;
    created_at: string;
    transportation?: number;
    other_expenses?: number;
    tier_pricing_enabled?: number;
  } | null | undefined;
  redirectTo?: string;
  errorRedirect?: string;
  transportation?: number;
  moq?: number;
  isTiered?: boolean;
  tier1Max?: number;
  tier1Discount?: number;
  tier2Max?: number;
  tier2Discount?: number;
  tier3Discount?: number;
  onSuccess?: () => void;
  priceEntries?: PriceEntry[];
  suppliers?: Supplier[];
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
  transportation = 0,
  moq = 0,
  isTiered = false,
  tier1Max = 100,
  tier1Discount = 0,
  tier2Max = 200,
  tier2Discount = 5,
  tier3Discount = 10,
  onSuccess,
  priceEntries = [],
  suppliers = [],
}: PricingCalculatorProps) {
  const [sellMinStr, setSellMinStr] = useState<string>("");
  const [sellMaxStr, setSellMaxStr] = useState<string>("");
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [changeReason, setChangeReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  const { locale } = useI18n();
  const router = useRouter();

  // Get last 3 months in chronological order
  const last3Months = useMemo(() => {
    const [year, monthVal] = month.split("-").map(Number);
    const result: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const date = new Date(year, monthVal - 1 - i, 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      result.push(`${y}-${m}`);
    }
    return result; // returns e.g. ["2026-04", "2026-05", "2026-06"]
  }, [month]);

  // Compute latest quote per supplier per month for the last 3 months
  const supplierHistoryData = useMemo(() => {
    if (!priceEntries || !suppliers) return [];

    // Filter price entries for this item and the last 3 months
    const filtered = priceEntries.filter(
      (pe) => pe.item_id === itemId && last3Months.includes(pe.month)
    );

    // Map to keep track of the latest quote per supplier+month
    const latestMap = new Map<string, number>();
    const activeSupplierIds = new Set<number>();

    for (const pe of filtered) {
      const key = `${pe.supplier_id}||${pe.month}`;
      latestMap.set(key, pe.price);
      activeSupplierIds.add(pe.supplier_id);
    }

    // Only include suppliers that have at least one quote in these 3 months
    const activeSuppliers = suppliers.filter((s) => activeSupplierIds.has(s.id));

    return activeSuppliers.map((s) => {
      const quotes = last3Months.map((m) => {
        return latestMap.get(`${s.id}||${m}`) ?? null;
      });
      return {
        supplierId: s.id,
        supplierName: s.name,
        quotes, // e.g. [42.00, 43.00, 45.00] corresponding to last3Months
      };
    });
  }, [priceEntries, suppliers, itemId, last3Months]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setErrorMsg(null);

    const sellMinVal = parseFloat(sellMinStr) || 0;
    const sellMaxVal = isTiered ? sellMinVal : (parseFloat(sellMaxStr) || 0);

    if (sellMinVal <= 0 || sellMaxVal <= 0) {
      setErrorMsg("Please enter valid positive selling prices.");
      setIsPending(false);
      return;
    }
    if (!isTiered && sellMaxVal < sellMinVal) {
      setErrorMsg("Max selling price must be greater than or equal to min selling price.");
      setIsPending(false);
      return;
    }

    const baseMin = sellMinVal - transportation - otherExpenses;
    const baseMax = sellMaxVal - transportation - otherExpenses;
    const calculatedMarkupMin = buyAvg > 0 ? ((baseMin / buyAvg) - 1) * 100 : 0;
    const calculatedMarkupMax = buyAvg > 0 ? ((baseMax / buyAvg) - 1) * 100 : 0;

    const formData = new FormData(e.currentTarget);
    formData.set("strategy", "avg");
    formData.set("markupType", "percent");
    formData.set("markupMin", String(Math.max(0, calculatedMarkupMin)));
    formData.set("markupMax", String(Math.max(0, calculatedMarkupMax)));
    formData.set("tierPricingEnabled", isTiered ? "on" : "off");
    formData.set("otherExpenses", String(otherExpenses));

    try {
      const res = await publishSellingPriceAction(formData);
      if (res?.ok) {
        setPublishSuccess(true);
        router.refresh();
      } else {
        if (res?.floorViolation) {
          setErrorMsg(`Floor violation! Selling price must respect the minimum margin floor of ${res.floorPct}%.`);
        } else {
          setErrorMsg(res?.error || "Server connection error. Please refresh the page.");
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to publish selling prices.");
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    // Load existing values when active item or quotes change
    const existingExpenses = existing?.other_expenses ?? 0;
    const baseSellMinVal = existing?.sell_min
      ? (existing.sell_min - transportation - existingExpenses)
      : buyAvg;

    const baseSellMaxVal = existing?.sell_max
      ? (existing.sell_max - transportation - existingExpenses)
      : (isTiered ? baseSellMinVal : (buyAvg * 1.1));

    setSellMinStr(String(parseFloat(baseSellMinVal.toFixed(2))));
    setSellMaxStr(String(parseFloat(baseSellMaxVal.toFixed(2))));
    setOtherExpenses(existingExpenses);
  }, [existing, buyMin, buyMax, buyAvg, transportation, isTiered]);

  // Reset success and confirmation state ONLY when the active itemId changes
  useEffect(() => {
    setPublishSuccess(false);
    setErrorMsg(null);
    setChangeReason("");
    setConfirmUpdate(false);
  }, [itemId]);

  const finalSellMin = (parseFloat(sellMinStr) || 0) + transportation + otherExpenses;
  const finalSellMax = isTiered ? finalSellMin : ((parseFloat(sellMaxStr) || 0) + transportation + otherExpenses);

  // Base values without transport/expenses (for display)
  const liveSellMin = parseFloat(sellMinStr) || 0;
  const liveSellMax = isTiered ? liveSellMin : (parseFloat(sellMaxStr) || 0);

  const calculatedBaseMin = liveSellMin;
  const calculatedMarkupMin = buyAvg > 0 ? ((calculatedBaseMin / buyAvg) - 1) * 100 : 0;
  const effectiveMarkupMinPct = calculatedMarkupMin;
  const floorViolated = floorPct !== null && calculatedMarkupMin < floorPct;
  const floorWarn = floorPct !== null && calculatedMarkupMin >= floorPct && calculatedMarkupMin < floorPct + 2;
  const maxViolated = !isTiered && (parseFloat(sellMaxStr) || 0) < (parseFloat(sellMinStr) || 0);

  const isUpdate = !!existing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {errorMsg && (
        <div className="restriction-info-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", margin: 0 }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "20px", alignItems: "start" }}>
        {/* LEFT COLUMN: Input Settings & Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {publishSuccess ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 16px",
              textAlign: "center",
              background: "var(--bg-elevated)",
              borderRadius: "12px",
              border: "1.5px solid var(--success)",
              boxShadow: "var(--shadow-sm)",
              animation: "scaleIn 0.3s ease-out-back"
            }}>
              {/* Animated Checkmark Circle */}
              <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "var(--success-light)",
                border: "2px solid var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
                boxShadow: "var(--glow-success)",
              }}>
                <span style={{ fontSize: "32px", color: "var(--success)", fontWeight: "bold" }}>✓</span>
              </div>

              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
                {locale === "ar" ? "تم نشر الأسعار بنجاح!" : "Selling Prices Published!"}
              </h3>
              
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", maxWidth: "340px", margin: "0 auto 20px", lineHeight: 1.6 }}>
                {locale === "ar" 
                  ? "تم تحديث أسعار البيع وتعميمها على جميع مندوبي المبيعات في النظام فوراً."
                  : "The new selling prices have been successfully published and are now live for all Sales Agents."
                }
              </p>

              {/* Price Summary Panel */}
              <div style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "12px 20px",
                width: "100%",
                maxWidth: "320px",
                marginBottom: "24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Min Price</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--success)", marginTop: "2px" }}>
                    {formatCurrency(finalSellMin)}
                  </div>
                </div>
                <div style={{ height: "32px", borderLeft: "1px solid var(--border-medium)", margin: "0 12px" }} />
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Max Price</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>
                    {formatCurrency(finalSellMax)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "320px" }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setPublishSuccess(false);
                    setChangeReason("");
                  }}
                  style={{ flex: 1, padding: "8px", fontSize: "12px", cursor: "pointer" }}
                >
                  {locale === "ar" ? "تعديل التسعير" : "Edit Pricing"}
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setPublishSuccess(false);
                    if (onSuccess) onSuccess();
                  }}
                  style={{ flex: 1, padding: "8px", fontSize: "12px", cursor: "pointer" }}
                >
                  {locale === "ar" ? "تم" : "Done"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* ── Selling Price Inputs ── */}
                {isTiered ? (
                  /* Tiered item: single Base Selling Price */
                  <label className="field">
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {locale === "ar" ? "سعر البيع الأساسي" : "Base Selling Price"}
                      <span style={{
                        fontSize: "9px", fontWeight: 800,
                        background: "var(--primary)", color: "#fff",
                        padding: "1px 7px", borderRadius: "4px", letterSpacing: "0.04em"
                      }}>
                        TIER BASE
                      </span>
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={sellMinStr}
                      onChange={(e) => setSellMinStr(e.target.value)}
                      placeholder="e.g. 120.00"
                      style={{
                        padding: "10px 14px", borderRadius: "8px", fontSize: "16px",
                        fontWeight: 800, border: "1.5px solid var(--primary)",
                        background: "var(--bg-elevated)", color: "var(--primary)"
                      }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {locale === "ar"
                        ? "السعر الأساسي الذي تُحسب منه خصومات الشرائح تلقائياً"
                        : "Base price — tier discounts are calculated automatically from this"}
                    </span>
                  </label>
                ) : (
                  /* Non-tiered item: Min + Max */
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <label className="field">
                      <span>{locale === "ar" ? "الحد الأدنى لسعر البيع" : "Min Selling Price"}</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={sellMinStr}
                        onChange={(e) => setSellMinStr(e.target.value)}
                        placeholder="e.g. 110.00"
                        style={{
                          padding: "10px 14px", borderRadius: "8px", fontSize: "15px",
                          fontWeight: 800, border: "1.5px solid var(--success)",
                          background: "var(--bg-elevated)", color: "var(--success)"
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>{locale === "ar" ? "الحد الأقصى لسعر البيع" : "Max Selling Price"}</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={sellMaxStr}
                        onChange={(e) => setSellMaxStr(e.target.value)}
                        placeholder="e.g. 130.00"
                        style={{
                          padding: "10px 14px", borderRadius: "8px", fontSize: "15px",
                          fontWeight: 800, border: "1.5px solid var(--primary)",
                          background: "var(--bg-elevated)", color: "var(--primary)"
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* Max < Min validation warning */}
                {maxViolated && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px", background: "var(--danger-light)",
                    border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px",
                    fontSize: "12px", color: "var(--danger)"
                  }}>
                    <span>🚫</span>
                    <span>{locale === "ar" ? "الحد الأقصى يجب أن يكون أكبر من أو يساوي الحد الأدنى" : "Max must be ≥ min selling price"}</span>
                  </div>
                )}

                {/* Transportation & Other Expenses Row */}

                <div style={{ display: "flex", gap: "12px", borderTop: "1px dashed var(--border-light)", paddingTop: "14px" }}>
                  <label className="field" style={{ flex: 1 }}>
                    <span>Fixed Transportation/Unit (Admin)</span>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(transportation)}
                      style={{
                        padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
                        border: "1px solid var(--border)", background: "var(--bg-subtle)",
                        color: "var(--text-secondary)", cursor: "not-allowed"
                      }}
                    />
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    <span>Other Expenses / Special Charges (EGP)</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={otherExpenses}
                      onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)}
                      style={{
                        padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
                        border: "1px solid var(--border)", background: "var(--bg-elevated)",
                        color: "var(--text-primary)"
                      }}
                    />
                  </label>
                </div>

                {/* MOQ Info Banner */}
                {moq > 0 && (
                  <div style={{
                    fontSize: "11px", color: "var(--text-muted)",
                    background: "var(--bg-subtle)", padding: "8px 12px",
                    borderRadius: "6px", border: "1px solid var(--border-light)"
                  }}>
                    ℹ️ Minimum Order Quantity (MOQ) for this item is <strong>{moq} units</strong>.
                  </div>
                )}

                {/* Final Price Summary Box */}
                <div style={{
                  padding: "12px 16px",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  borderRadius: "12px",
                  display: "flex", flexDirection: "column", gap: "8px"
                }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.05em" }}>
                    Total Price Published to Sales Agents
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Min Selling Price</div>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--success)" }}>
                        {formatCurrency(finalSellMin)}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        Base: {formatCurrency(liveSellMin)} + Trans: {formatCurrency(transportation)} + Exp: {formatCurrency(otherExpenses)}
                      </div>
                    </div>
                    <div style={{ borderLeft: "1px solid var(--border-medium)", height: "36px" }} />
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Max Selling Price</div>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--primary)" }}>
                        {formatCurrency(finalSellMax)}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        Base: {formatCurrency(liveSellMax)} + Trans: {formatCurrency(transportation)} + Exp: {formatCurrency(otherExpenses)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hidden inputs to pass otherExpenses */}
                <input type="hidden" name="otherExpenses" value={otherExpenses} />

                {/* Volume Tier Preview (when enabled) */}
                {isTiered && (
                  <div style={{
                    padding: "14px",
                    background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.08) 100%)",
                    border: "1.5px dashed rgba(16,185,129,0.3)",
                    borderRadius: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      ⚡ Live Volume Tier Calculation
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-light)", paddingBottom: "4px" }}>
                        <span>Base Tier (0 - {tier1Max} units):</span>
                        <strong style={{ color: "var(--success)", fontSize: "14px" }}>{formatCurrency(finalSellMin)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-light)", paddingBottom: "4px" }}>
                        <span>Tier 2 ({tier1Max + 1} - {tier2Max} units) — {tier2Discount}% discount:</span>
                        <strong style={{ color: "var(--primary)", fontSize: "14px" }}>{formatCurrency(finalSellMin * (1 - tier2Discount / 100))}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Tier 3 ({tier2Max + 1}+ units) — {tier3Discount}% discount:</span>
                        <strong style={{ color: "var(--primary)", fontSize: "14px" }}>{formatCurrency(finalSellMin * (1 - tier3Discount / 100))}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Change reason — required when updating an existing price */}
                {isUpdate && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    padding: "14px",
                    background: "rgba(245, 158, 11, 0.06)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: "12px",
                    marginTop: "8px"
                  }}>
                    <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: "6px" }}>
                      ⚠️ Price Update Confirmation Required
                    </div>
                    
                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>Change Reason</span>
                        <span style={{ color: "var(--danger)" }}>*</span>
                      </span>
                      <input
                        type="text"
                        name="changeReason"
                        required
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Required — e.g. Supplier raised prices, seasonal adjustment…"
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-elevated)",
                          color: "var(--text-primary)",
                          fontSize: "13px",
                          marginTop: "4px"
                        }}
                      />
                    </label>

                    <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", marginTop: "4px" }}>
                      <input
                        type="checkbox"
                        required
                        checked={confirmUpdate}
                        onChange={(e) => setConfirmUpdate(e.target.checked)}
                        style={{ width: "16px", height: "16px", marginTop: "2px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "11.5px", color: "var(--text-primary)", lineHeight: "1.4", userSelect: "none" }}>
                        I confirm that I want to overwrite the previously published selling prices for this month.
                      </span>
                    </label>
                  </div>
                )}

                {/* Submit */}
                <div style={{ marginTop: "4px" }}>
                  <button
                    type="submit"
                    disabled={floorViolated || maxViolated || isPending || (isUpdate && (!confirmUpdate || !changeReason.trim()))}
                    className="button button-primary button-block"
                    style={{
                      padding: "10px", fontSize: "13px", cursor: (floorViolated || maxViolated || isPending || (isUpdate && (!confirmUpdate || !changeReason.trim()))) ? "not-allowed" : "pointer",
                      opacity: (floorViolated || maxViolated || isPending || (isUpdate && (!confirmUpdate || !changeReason.trim()))) ? 0.5 : 1,
                    }}
                    title={floorViolated ? `Cannot save: below minimum margin floor of ${floorPct}%` : maxViolated ? "Cannot save: max markup is less than min markup" : undefined}
                  >
                    {isPending ? "Publishing..." : isUpdate ? "Update Selling Prices" : "Publish Selling Prices to Sales"}
                  </button>
                  {floorViolated && (
                    <p style={{ textAlign: "center", fontSize: "11px", color: "var(--danger)", marginTop: "6px", fontWeight: 600 }}>
                      ارفع الهامش الأدنى إلى {floorPct}% على الأقل لتتمكن من الحفظ
                    </p>
                  )}
                </div>
              </form>
          )}
        </div>

        {/* RIGHT COLUMN: Reference Information Panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "0" }}>
          {/* ── Base Price Card ─────────────────────────────────────────────────── */}
          <div className="summary-card accent-card" style={{ padding: "14px 16px" }}>
            <span className="eyebrow" style={{ fontSize: "10px" }}>
              {locale === "ar" ? "سعر التكلفة الأساسي (شامل جميع التكاليف)" : "Base Cost Price (Incl. all costs)"}
            </span>
            <div style={{ display: "flex", gap: "20px", marginTop: "8px", flexWrap: "wrap" }}>
              {[
                { label: locale === "ar" ? "أقل سعر" : "Min Cost", val: buyMin, color: "var(--success)" },
                { label: locale === "ar" ? "متوسط السعر" : "Avg Cost", val: buyAvg, color: "var(--primary)" },
                { label: locale === "ar" ? "أعلى سعر" : "Max Cost", val: buyMax, color: "var(--danger)" },
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
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {locale === "ar" ? "حد الهامش الأدنى المسموح:" : "Minimum Margin Floor:"}
                </span>
                <span style={{
                  fontSize: "12px", fontWeight: 800,
                  color: floorViolated ? "var(--danger)" : "var(--warning)",
                  background: floorViolated ? "var(--danger-light)" : "var(--warning-light)",
                  padding: "2px 8px", borderRadius: "6px",
                  border: `1px solid ${floorViolated ? "rgba(220,38,38,0.3)" : "rgba(217,119,6,0.3)"}`,
                }}>
                  {floorPct}% {locale === "ar" ? "هامش كحد أدنى" : "Min Margin"}
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
                  {locale === "ar" ? "انتهاك حد الهامش الأدنى" : "Margin Floor Violation"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--danger)", lineHeight: 1.5 }}>
                  {locale === "ar"
                    ? `الهامش المحدد (${effectiveMarkupMinPct.toFixed(1)}%) أقل من الحد الأدنى المسموح (${floorPct}%). يجب رفع هامش الربح الأدنى قبل الحفظ.`
                    : `The configured markup (${effectiveMarkupMinPct.toFixed(1)}%) is below the minimum margin floor of (${floorPct}%). Please increase the min markup before saving.`
                  }
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
              <span>
                {locale === "ar"
                  ? `الهامش قريب جداً من الحد الأدنى (${floorPct}%). تأكد أن هذا مقصود.`
                  : `Markup is close to the margin floor of (${floorPct}%). Make sure this is intentional.`
                }
              </span>
            </div>
          )}

          {/* ── Supplier Quote History (Last 3 Months) ────────────────────── */}
          {suppliers && priceEntries && (
            <div style={{
              padding: "14px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "15px" }}>📅</span>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {locale === "ar" ? "تاريخ أسعار الموردين (آخر ٣ أشهر)" : "Supplier Quotes (Last 3 Months)"}
                </span>
              </div>
              {supplierHistoryData.length === 0 ? (
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {locale === "ar" ? "لم يتم تسجيل أي أسعار في آخر ٣ أشهر." : "No quotes recorded in the last 3 months."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid var(--border-medium)", textAlign: "left" }}>
                        <th style={{ padding: "6px 4px", color: "var(--text-muted)", fontWeight: 600 }}>
                          {locale === "ar" ? "المورد" : "Supplier"}
                        </th>
                        {last3Months.map((m) => (
                          <th key={m} style={{ padding: "6px 4px", color: "var(--text-muted)", fontWeight: 600, textAlign: "right" }}>
                            {formatMonthLabel(m)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {supplierHistoryData.map((row) => (
                        <tr key={row.supplierId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                          <td style={{ padding: "8px 4px", fontWeight: 600, color: "var(--text-primary)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.supplierName}>
                            {row.supplierName}
                          </td>
                          {row.quotes.map((price, idx) => (
                            <td key={idx} style={{ padding: "8px 4px", textAlign: "right" }}>
                              {price !== null ? (
                                <strong style={{
                                  color: idx === 2 ? "var(--text-primary)" : "var(--text-secondary)",
                                  fontWeight: idx === 2 ? 700 : 500
                                }}>
                                  {formatCurrency(price)}
                                </strong>
                              ) : (
                                <span style={{ color: "var(--text-dim)" }}>—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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
                  {locale === "ar" ? "سجل تغييرات الأسعار" : "Price Change Audit Trail"}
                  <span style={{
                    fontSize: "10px", fontWeight: 800, background: "var(--bg-subtle)",
                    border: "1px solid var(--border)", borderRadius: "99px",
                    padding: "1px 7px", color: "var(--text-muted)",
                  }}>{history.length}</span>
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  {showHistory ? (locale === "ar" ? "▲ إخفاء" : "▲ Hide") : (locale === "ar" ? "▼ عرض" : "▼ Show")}
                </span>
              </button>

              {showHistory && (
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
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
                            {isFirstPublish ? (locale === "ar" ? "نشر أول" : "First Publish") : (locale === "ar" ? "تعديل" : "Updated")}
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
                              <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>{locale === "ar" ? "السابق" : "Previous"}</span>
                              <div style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                                {formatCurrency(h.prev_sell_min)} → {formatCurrency(h.prev_sell_max ?? 0)}
                              </div>
                              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                {h.prev_markup_min?.toFixed(1)}% – {h.prev_markup_max?.toFixed(1)}%
                                {h.prev_strategy ? ` · ${h.prev_strategy.toUpperCase()}` : ""}
                                {h.prev_transportation !== null && h.prev_transportation > 0 && ` · Trans: ${formatCurrency(h.prev_transportation)}`}
                                {h.prev_other_expenses !== null && h.prev_other_expenses > 0 && ` · Exp: ${formatCurrency(h.prev_other_expenses)}`}
                              </div>
                            </div>
                          )}
                          {h.prev_sell_min !== null && (
                            <div style={{ alignSelf: "center", color: "var(--text-dim)", fontSize: "16px" }}>→</div>
                          )}
                          <div>
                            <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                              {isFirstPublish ? (locale === "ar" ? "تم النشر" : "Published") : (locale === "ar" ? "الجديد" : "New")}
                            </span>
                            <div style={{ fontWeight: 800, color: isFirstPublish ? "var(--success)" : "var(--primary)" }}>
                              {formatCurrency(h.new_sell_min)} → {formatCurrency(h.new_sell_max)}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                              {h.new_markup_min.toFixed(1)}% – {h.new_markup_max.toFixed(1)}%
                              {" · "}{h.new_strategy.toUpperCase()}
                              {" · Avg buy "}{formatCurrency(h.new_buy_avg)}
                              {h.new_transportation !== null && h.new_transportation > 0 && ` · Trans: ${formatCurrency(h.new_transportation)}`}
                              {h.new_other_expenses !== null && h.new_other_expenses > 0 && ` · Exp: ${formatCurrency(h.new_other_expenses)}`}
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
      </div>
    </div>
  );
}
