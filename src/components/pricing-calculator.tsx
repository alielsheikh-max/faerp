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
  fame_name?: string | null;
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
  tier3Max?: number;
  tier4Discount?: number;
  onSuccess?: () => void;
  priceEntries?: PriceEntry[];
  suppliers?: Supplier[];
  /** T26: admin-controlled — whether SC can override transport fee this month */
  scTransportOverrideEnabled?: boolean;
  /** Admin has enabled tier pricing for this month — SC can switch strategy per item */
  tierEnabled?: boolean;
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
  tier3Discount = 0,
  tier3Max = 800,
  tier4Discount = 0,
  onSuccess,
  priceEntries = [],
  suppliers = [],
  scTransportOverrideEnabled = false,
  tierEnabled = false,
}: PricingCalculatorProps) {
  const [sellMinStr, setSellMinStr] = useState<string>("");
  const [sellMaxStr, setSellMaxStr] = useState<string>("");
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [changeReason, setChangeReason] = useState("");
  // T17: dual note fields
  const [internalNote, setInternalNote] = useState("");
  const [saNote, setSaNote] = useState("");
  // T5: SC transport override per month
  const [transportOverrideEnabled, setTransportOverrideEnabled] = useState(false);
  const [transportOverrideAmount, setTransportOverrideAmount] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  // Strategy override: SC can switch per-item between Tier and Fixed when admin enables tierEnabled
  const [usesTierStrategy, setUsesTierStrategy] = useState(isTiered);
  // Reset when item changes
  useEffect(() => { setUsesTierStrategy(isTiered); }, [isTiered]);

  // ── Markup Assistant state ─────────────────────────────────────────
  const [useMarkup, setUseMarkup]       = useState(false);
  const [markupRef, setMarkupRef]       = useState<"min" | "avg" | "max">("max");
  const [markupType, setMarkupType]     = useState<"pct" | "fixed" | "div">("pct");
  const [markupMinVal, setMarkupMinVal] = useState<string>("");
  const [markupMaxVal, setMarkupMaxVal] = useState<string>("");

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
        supplierName: s.fame_name || s.name,
        quotes, // e.g. [42.00, 43.00, 45.00] corresponding to last3Months
      };
    });
  }, [priceEntries, suppliers, itemId, last3Months]);

  // Group history by month, latest record per month, up to 3 most recent months
  const publishedPriceHistory = useMemo(() => {
    const byMonth = new Map<string, typeof history[0]>();
    for (const h of history) {
      if (!byMonth.has(h.month)) byMonth.set(h.month, h); // ordered DESC, first = most recent
    }
    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 3);
  }, [history]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setErrorMsg(null);

    // Resolve effective selling prices (same logic as the derived-values block below)
    const _applyMu = (ref: number, val: string, type: "pct" | "fixed" | "div") => {
      const v = parseFloat(val) || 0;
      if (type === "div") return v > 0 ? ref / v : ref;
      return type === "pct" ? ref * (1 + v / 100) : ref + v;
    };
    const _muRef = markupRef === "min" ? buyMin : markupRef === "avg" ? buyAvg : buyMax;
    const sellMinVal = useMarkup
      ? _applyMu(_muRef, markupMinVal, markupType)
      : (parseFloat(sellMinStr) || 0);
    const sellMaxVal = usesTierStrategy ? sellMinVal
      : useMarkup ? _applyMu(_muRef, markupMaxVal, markupType)
      : (parseFloat(sellMaxStr) || 0);

    if (sellMinVal <= 0 || sellMaxVal <= 0) {
      setErrorMsg("Please enter valid positive selling prices.");
      setIsPending(false);
      return;
    }
    if (!usesTierStrategy && sellMaxVal < sellMinVal) {
      setErrorMsg("Max selling price must be greater than or equal to min selling price.");
      setIsPending(false);
      return;
    }

    const baseMin = sellMinVal - transportation - otherExpenses;
    const baseMax = sellMaxVal - transportation - otherExpenses;
    const calculatedMarkupMin = buyAvg > 0 ? ((baseMin / buyAvg) - 1) * 100 : 0;
    const calculatedMarkupMax = buyAvg > 0 ? ((baseMax / buyAvg) - 1) * 100 : 0;

    const formData = new FormData(e.currentTarget);
    // Inject required server-side fields from props (no hidden inputs needed)
    formData.set("itemId", String(itemId));
    formData.set("month", month);
    formData.set("createdBy", createdBy);
    if (redirectTo) formData.set("redirectTo", redirectTo);
    if (errorRedirect) formData.set("errorRedirect", errorRedirect);
    formData.set("strategy", "avg");
    formData.set("markupType", "percent");
    formData.set("markupMin", String(Math.max(0, calculatedMarkupMin)));
    formData.set("markupMax", String(Math.max(0, calculatedMarkupMax)));
    formData.set("tierPricingEnabled", usesTierStrategy ? "on" : "off");
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
      : (usesTierStrategy ? baseSellMinVal : (buyAvg * 1.1));

    setSellMinStr(String(parseFloat(baseSellMinVal.toFixed(2))));
    setSellMaxStr(String(parseFloat(baseSellMaxVal.toFixed(2))));
    setOtherExpenses(existingExpenses);
  }, [existing, buyMin, buyMax, buyAvg, transportation, usesTierStrategy]);

  // Reset success and confirmation state ONLY when the active itemId changes
  useEffect(() => {
    setPublishSuccess(false);
    setErrorMsg(null);
    setChangeReason("");
    setConfirmUpdate(false);
  }, [itemId]);

  // ── Markup assistant helpers ───────────────────────────────────────
  const applyMarkup = (ref: number, val: string, type: "pct" | "fixed" | "div"): number => {
    const v = parseFloat(val) || 0;
    if (type === "div") return v > 0 ? ref / v : ref;
    return type === "pct" ? ref * (1 + v / 100) : ref + v;
  };

  // ── T8: Round up to nearest 5 EGP ───────────────────────────────────
  const roundUp5 = (v: number) => v > 0 ? Math.ceil(v / 5) * 5 : v;

  const markupRefPrice = markupRef === "min" ? buyMin : markupRef === "avg" ? buyAvg : buyMax;

  // Effective base selling prices (WITHOUT transport/expenses) — rounded up to nearest 5 when markup assistant is active
  const effectiveSellMin = useMarkup
    ? roundUp5(applyMarkup(markupRefPrice, markupMinVal, markupType))
    : (parseFloat(sellMinStr) || 0);
  const effectiveSellMax = useMarkup
    ? (usesTierStrategy ? effectiveSellMin : roundUp5(applyMarkup(markupRefPrice, markupMaxVal, markupType)))
    : (usesTierStrategy ? effectiveSellMin : (parseFloat(sellMaxStr) || 0));

  // Published prices = base + transport + other expenses, rounded up to nearest 5 EGP
  const finalSellMin = roundUp5(effectiveSellMin + transportation + otherExpenses);
  const finalSellMax = usesTierStrategy ? finalSellMin : roundUp5(effectiveSellMax + transportation + otherExpenses);

  // Aliases kept for legacy display labels
  const liveSellMin = effectiveSellMin;
  const liveSellMax = effectiveSellMax;

  const calculatedBaseMin = liveSellMin;
  const calculatedMarkupMin = buyAvg > 0 ? ((calculatedBaseMin / buyAvg) - 1) * 100 : 0;
  const effectiveMarkupMinPct = calculatedMarkupMin;
  const floorViolated = floorPct !== null && calculatedMarkupMin < floorPct;
  const floorWarn = floorPct !== null && calculatedMarkupMin >= floorPct && calculatedMarkupMin < floorPct + 2;
  const maxViolated = !usesTierStrategy && effectiveSellMax < effectiveSellMin;

  const isUpdate = !!existing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {errorMsg && (
        <div className="restriction-info-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", margin: 0 }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* Strategy Switcher — only visible when admin has enabled tier pricing for this month */}
      {tierEnabled && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 14px",
          background: usesTierStrategy
            ? "linear-gradient(135deg,rgba(99,102,241,0.10) 0%,rgba(59,130,246,0.07) 100%)"
            : "linear-gradient(135deg,rgba(16,185,129,0.10) 0%,rgba(52,211,153,0.07) 100%)",
          border: `1.5px solid ${usesTierStrategy ? "rgba(99,102,241,0.35)" : "rgba(16,185,129,0.35)"}`,
          borderRadius: "10px",
        }}>
          <span style={{ fontSize: "18px" }}>{usesTierStrategy ? "⚡" : "📊"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Pricing Strategy — This Month</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>Applies to this item only. Does not change permanent settings.</div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button type="button"
              onClick={() => setUsesTierStrategy(true)}
              style={{
                padding: "6px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                border: "1.5px solid",
                borderColor: usesTierStrategy ? "var(--primary)" : "var(--border)",
                background: usesTierStrategy ? "var(--primary)" : "var(--bg-elevated)",
                color: usesTierStrategy ? "#fff" : "var(--text-secondary)",
                transition: "all 150ms",
              }}>
              ⚡ Tier
            </button>
            <button type="button"
              onClick={() => setUsesTierStrategy(false)}
              style={{
                padding: "6px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                border: "1.5px solid",
                borderColor: !usesTierStrategy ? "var(--success)" : "var(--border)",
                background: !usesTierStrategy ? "var(--success)" : "var(--bg-elevated)",
                color: !usesTierStrategy ? "#fff" : "var(--text-secondary)",
                transition: "all 150ms",
              }}>
              📊 Fixed
            </button>
          </div>
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

              {/* Price Summary Panel — show tier table when usesTierStrategy (T9) */}
              {usesTierStrategy ? (
                <div style={{
                  background: "var(--bg-subtle)", border: "1px solid var(--border)",
                  borderRadius: "10px", padding: "12px 16px", width: "100%",
                  maxWidth: "340px", marginBottom: "24px",
                }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Published Tier Prices</div>
                  {[
                    { label: `Tier 1  (1 – ${tier1Max} units)`, price: finalSellMin },
                    { label: `Tier 2  (${tier1Max + 1} – ${tier2Max} units)`, price: tier2Discount > 0 && tier2Discount < 1 ? roundUp5(buyAvg / tier2Discount + transportation + otherExpenses) : roundUp5(effectiveSellMin * (1 - tier2Discount / 100) + transportation + otherExpenses) },
                    { label: `Tier 3  (${tier2Max + 1} – ${tier3Max} units)`, price: tier3Discount > 0 && tier3Discount < 1 ? roundUp5(buyAvg / tier3Discount + transportation + otherExpenses) : roundUp5(effectiveSellMin * (1 - tier3Discount / 100) + transportation + otherExpenses) },
                    ...(tier4Discount > 0 ? [{ label: `Tier 4  (${tier3Max + 1}+ units)`, price: tier4Discount < 1 ? roundUp5(buyAvg / tier4Discount + transportation + otherExpenses) : roundUp5(effectiveSellMin * (1 - tier4Discount / 100) + transportation + otherExpenses) }] : []),
                  ].map(({ label, price }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px dashed var(--border-light)", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                      <strong style={{ color: "var(--success)" }}>{formatCurrency(price)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
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
              )}

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

                {/* ── Markup Assistant ─────────────────────────────────── */}
                <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                  <button type="button"
                    onClick={() => setUseMarkup(v => !v)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px",
                      background: useMarkup ? "rgba(99,102,241,0.08)" : "var(--bg-subtle)",
                      border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                      color: useMarkup ? "var(--primary)" : "var(--text-secondary)",
                    }}
                  >
                    <span>💡 {locale === "ar" ? "حساب تلقائي بالهامش" : "Markup Assistant"}</span>
                    <span style={{
                      width: "36px", height: "18px", borderRadius: "9px",
                      background: useMarkup ? "var(--primary)" : "var(--border-medium)",
                      position: "relative", display: "inline-flex", alignItems: "center", transition: "background 200ms",
                    }}>
                      <span style={{
                        width: "12px", height: "12px", borderRadius: "50%", background: "#fff",
                        position: "absolute", left: useMarkup ? "21px" : "3px",
                        transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }} />
                    </span>
                  </button>
                  {useMarkup && (
                    <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {/* Reference price selector */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {locale === "ar" ? "السعر المرجعي" : "Reference Buy Cost"}
                        </span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {(["min", "avg", "max"] as ("min" | "avg" | "max")[]).map(key => {
                            const val = key === "min" ? buyMin : key === "avg" ? buyAvg : buyMax;
                            const label = key === "min" ? "Min" : key === "avg" ? "Avg ⌀" : "Max ★";
                            return (
                              <button key={key} type="button"
                                onClick={() => setMarkupRef(key)}
                                style={{
                                  flex: 1, padding: "7px 4px", borderRadius: "7px",
                                  border: `1.5px solid ${markupRef === key ? "var(--primary)" : "var(--border)"}`,
                                  background: markupRef === key ? "var(--primary-light)" : "var(--bg-elevated)",
                                  color: markupRef === key ? "var(--primary)" : "var(--text-secondary)",
                                  fontSize: "11px", fontWeight: 700, cursor: "pointer", textAlign: "center",
                                }}
                              >
                                <div style={{ fontSize: "9px", opacity: 0.8, marginBottom: "2px" }}>{label}</div>
                                <div>{formatCurrency(val)}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Type toggle + markup inputs */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {locale === "ar" ? "النوع" : "Type"}
                          </span>
                          <div style={{ display: "flex", borderRadius: "7px", border: "1.5px solid var(--border)", overflow: "hidden" }}>
                            {(["pct", "fixed", "div"] as const).map(t => (
                              <button key={t} type="button"
                                onClick={() => setMarkupType(t)}
                                style={{
                                  padding: "6px 10px", border: "none", cursor: "pointer",
                                  fontSize: "11px", fontWeight: 700,
                                  background: markupType === t ? "var(--primary)" : "transparent",
                                  color: markupType === t ? "#fff" : "var(--text-muted)",
                                }}
                              >{t === "pct" ? "% Markup" : t === "fixed" ? "EGP +" : "÷ Divisor"}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {usesTierStrategy ? (locale === "ar" ? "الهامش" : "Markup") : (locale === "ar" ? "هامش الأدنى" : "Min Markup")}
                          </span>
                          <input
                            type="number" step="any" min="0"
                            value={markupMinVal}
                            onChange={e => setMarkupMinVal(e.target.value)}
                            placeholder={markupType === "pct" ? "e.g. 10" : markupType === "div" ? "e.g. 0.77" : "e.g. 5.00"}
                            style={{ padding: "7px 10px", borderRadius: "7px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)", fontSize: "13px", fontWeight: 700 }}
                          />
                        </div>
                        {!usesTierStrategy && (
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              {locale === "ar" ? "هامش الأقصى" : "Max Markup"}
                            </span>
                            <input
                              type="number" step="any" min="0"
                              value={markupMaxVal}
                              onChange={e => setMarkupMaxVal(e.target.value)}
                              placeholder={markupType === "pct" ? "e.g. 15" : "e.g. 10.00"}
                              style={{ padding: "7px 10px", borderRadius: "7px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)", fontSize: "13px", fontWeight: 700 }}
                            />
                          </div>
                        )}
                      </div>
                      {/* Live preview */}
                      {effectiveSellMin > 0 && (
                        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "7px", padding: "8px 12px", fontSize: "11.5px", color: "var(--primary)", fontWeight: 600 }}>
                          {usesTierStrategy ? (
                            <span>→ Base (Tier 1): <strong>{formatCurrency(effectiveSellMin)}</strong>{" "}
                              {markupType === "div"
                                ? `(${formatCurrency(markupRefPrice)} ÷ ${markupMinVal || "?"})`
                                : `(${formatCurrency(markupRefPrice)}${markupType === "pct" ? ` + ${markupMinVal || 0}%` : ` + EGP ${markupMinVal || 0}`})`
                              }
                            </span>
                          ) : (
                            <span>→ Min: <strong>{formatCurrency(effectiveSellMin)}</strong>{" · "}Max: <strong>{formatCurrency(effectiveSellMax)}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Selling Price Inputs ── */}
                {usesTierStrategy ? (
                  /* Tiered item: single Base Selling Price */
                  <label className="field">
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {locale === "ar" ? "سعر البيع الأساسي" : "Base Selling Price"}
                      <span style={{ fontSize: "9px", fontWeight: 800, background: "var(--primary)", color: "#fff", padding: "1px 7px", borderRadius: "4px", letterSpacing: "0.04em" }}>
                        TIER BASE
                      </span>
                    </span>
                    {useMarkup ? (
                      <input type="text" readOnly
                        value={effectiveSellMin > 0 ? (effectiveSellMin % 1 === 0 ? String(effectiveSellMin) : effectiveSellMin.toFixed(2)) : "—"}
                        style={{ padding: "10px 14px", borderRadius: "8px", fontSize: "16px", fontWeight: 800, border: "1.5px solid var(--primary)", background: "rgba(99,102,241,0.06)", color: "var(--primary)", cursor: "not-allowed" }}
                      />
                    ) : (
                      <input type="number" step="any" min="0" required
                        value={sellMinStr} onChange={e => setSellMinStr(e.target.value)}
                        placeholder="e.g. 120.00"
                        style={{ padding: "10px 14px", borderRadius: "8px", fontSize: "16px", fontWeight: 800, border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)" }}
                      />
                    )}
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {locale === "ar" ? "السعر الأساسي — خصومات الشرائح تُحسب منه تلقائياً (النقل يُضاف بعد الخصم)" : "Base price — tier discounts are applied to this, then transport is added back"}
                    </span>
                  </label>
                ) : (
                  /* Non-tiered item: Min + Max */
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <label className="field">
                      <span>{locale === "ar" ? "الحد الأدنى لسعر البيع" : "Min Selling Price"}</span>
                      {useMarkup ? (
                        <input type="text" readOnly
                          value={effectiveSellMin > 0 ? (effectiveSellMin % 1 === 0 ? String(effectiveSellMin) : effectiveSellMin.toFixed(2)) : "—"}
                          style={{ padding: "10px 14px", borderRadius: "8px", fontSize: "15px", fontWeight: 800, border: "1.5px solid var(--success)", background: "rgba(16,185,129,0.06)", color: "var(--success)", cursor: "not-allowed" }}
                        />
                      ) : (
                        <input type="number" step="any" min="0" required
                          value={sellMinStr} onChange={e => setSellMinStr(e.target.value)}
                          placeholder="e.g. 110.00"
                          style={{ padding: "10px 14px", borderRadius: "8px", fontSize: "15px", fontWeight: 800, border: "1.5px solid var(--success)", background: "var(--bg-elevated)", color: "var(--success)" }}
                        />
                      )}
                    </label>
                    <label className="field">
                      <span>{locale === "ar" ? "الحد الأقصى لسعر البيع" : "Max Selling Price"}</span>
                      {useMarkup ? (
                        <input type="text" readOnly
                          value={effectiveSellMax > 0 ? effectiveSellMax.toFixed(2) : "—"}
                          style={{ padding: "10px 14px", borderRadius: "8px", fontSize: "15px", fontWeight: 800, border: "1.5px solid var(--primary)", background: "rgba(99,102,241,0.06)", color: "var(--primary)", cursor: "not-allowed" }}
                        />
                      ) : (
                        <input type="number" step="any" min="0" required
                          value={sellMaxStr} onChange={e => setSellMaxStr(e.target.value)}
                          placeholder="e.g. 130.00"
                          style={{ padding: "10px 14px", borderRadius: "8px", fontSize: "15px", fontWeight: 800, border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)" }}
                        />
                      )}
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

                {/* ── Transportation & Other Expenses ────────────────────────── */}
                <div style={{ borderTop: "1px dashed var(--border-light)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Fixed transport fee card */}
                  {transportation > 0 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 14px",
                      background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(251,191,36,0.07) 100%)",
                      border: "1.5px solid rgba(245,158,11,0.35)",
                      borderRadius: "10px",
                    }}>
                      <span style={{ fontSize: "20px", lineHeight: 1 }}>🚚</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                          {locale === "ar" ? "تكلفة النقل الثابتة / وحدة" : "Fixed Transportation / Unit"}
                        </div>
                        <div style={{ fontSize: "9.5px", color: "#92400e", marginTop: "1px" }}>
                          {locale === "ar" ? "محددة من الإدارة — تُضاف بعد الخصم" : "Set by Admin — added after discount, not subject to tiers"}
                        </div>
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 900, color: "#d97706", whiteSpace: "nowrap" }}>
                        {formatCurrency(transportation)}
                      </div>
                    </div>
                  )}
                  {/* T5 + T26: Transport override toggle — directly under transport card */}
                  {scTransportOverrideEnabled && (
                    <div style={{
                      padding: "10px 14px",
                      background: transportOverrideEnabled
                        ? "linear-gradient(135deg,rgba(245,158,11,0.12) 0%,rgba(239,68,68,0.07) 100%)"
                        : "var(--bg-elevated)",
                      border: `1.5px solid ${transportOverrideEnabled ? "var(--warning)" : "var(--border)"}`,
                      borderRadius: "10px", display: "flex", flexDirection: "column", gap: "8px"
                    }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={transportOverrideEnabled}
                          onChange={e => { setTransportOverrideEnabled(e.target.checked); if (!e.target.checked) setTransportOverrideAmount(""); }}
                          style={{ accentColor: "var(--warning)", width: "15px", height: "15px" }} />
                        <span style={{ fontSize: "11px", fontWeight: 800, color: transportOverrideEnabled ? "var(--warning)" : "var(--text-secondary)" }}>
                          Override transport fee this month only
                        </span>
                      </label>
                      {transportOverrideEnabled && (
                        <input type="number" min="0" step="any"
                          placeholder={`Default: ${transportation} EGP/unit`}
                          value={transportOverrideAmount}
                          onChange={e => setTransportOverrideAmount(e.target.value)}
                          style={{
                            padding: "7px 10px", borderRadius: "8px", fontSize: "13px",
                            border: "1px solid var(--warning)", background: "var(--bg-surface)",
                            color: "var(--text-primary)", width: "100%"
                          }} />
                      )}
                    </div>
                  )}
                  {/* Hint when SC transport override is not enabled by admin */}
                  {!scTransportOverrideEnabled && transportation > 0 && (
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic", padding: "2px 2px" }}>
                      💡 To override this transport fee, ask Admin to enable <strong>SC Transport Override</strong> in Monthly Policy.
                    </div>
                  )}
                  <label className="field">
                    <span style={{ fontSize: "11px" }}>Other Expenses / Special Charges (EGP)</span>
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

                {/* ── MOQ highlighted card ─────────────────────────────── */}
                {moq > 0 && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "10px 14px",
                    background: "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(99,102,241,0.07) 100%)",
                    border: "1.5px solid rgba(59,130,246,0.35)",
                    borderRadius: "10px",
                  }}>
                    <span style={{ fontSize: "20px", lineHeight: 1 }}>📦</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {locale === "ar" ? "الحد الأدنى لكمية الطلب (MOQ)" : "Minimum Order Quantity (MOQ)"}
                      </div>
                      <div style={{ fontSize: "9.5px", color: "#1e40af", marginTop: "1px" }}>
                        {locale === "ar" ? "لا يمكن الطلب بأقل من هذه الكمية من هذا المورد" : "Clients must order at least this many units per order"}
                      </div>
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--primary)", whiteSpace: "nowrap" }}>
                      {moq.toLocaleString()} <span style={{ fontSize: "11px", fontWeight: 600 }}>units</span>
                    </div>
                  </div>
                )}

                {/* T7: Final Price Summary Box — hidden when tiered (shown separately in tier preview) */}
                {!usesTierStrategy && (
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
                )}

                {/* Hidden inputs to pass otherExpenses + T5 transport override */}
                <input type="hidden" name="otherExpenses" value={otherExpenses} />
                <input type="hidden" name="transportOverrideEnabled" value={transportOverrideEnabled ? "1" : "0"} />
                {transportOverrideEnabled && (
                  <input type="hidden" name="transportOverride" value={transportOverrideAmount} />
                )}

                {/* Volume Tier Preview — T6: divisor formula (value < 1), fallback to % for legacy */}
                {usesTierStrategy && (
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
                      ⚡ Live Volume Tier Prices (rounded to 5 EGP)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                      {/* Tier 1 */}
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-light)", paddingBottom: "4px" }}>
                        <span>Tier 1 (1 – {tier1Max} units):</span>
                        <strong style={{ color: "var(--success)", fontSize: "14px" }}>{formatCurrency(finalSellMin)}</strong>
                      </div>
                      {/* Tier 2 */}
                      {tier2Discount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-light)", paddingBottom: "4px" }}>
                          <span>Tier 2 ({tier1Max + 1} – {tier2Max} units){tier2Discount < 1 ? ` ÷ ${tier2Discount}` : ` ${tier2Discount}% off`}:</span>
                          <strong style={{ color: "var(--primary)", fontSize: "14px" }}>
                            {formatCurrency(tier2Discount < 1
                              ? roundUp5(buyAvg / tier2Discount + transportation + otherExpenses)
                              : roundUp5(effectiveSellMin * (1 - tier2Discount / 100) + transportation + otherExpenses)
                            )}
                          </strong>
                        </div>
                      )}
                      {/* Tier 3 */}
                      {tier3Discount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: tier4Discount > 0 ? "1px dashed var(--border-light)" : "none", paddingBottom: "4px" }}>
                          <span>Tier 3 ({tier2Max + 1} – {tier3Max} units){tier3Discount < 1 ? ` ÷ ${tier3Discount}` : ` ${tier3Discount}% off`}:</span>
                          <strong style={{ color: "var(--primary)", fontSize: "14px" }}>
                            {formatCurrency(tier3Discount < 1
                              ? roundUp5(buyAvg / tier3Discount + transportation + otherExpenses)
                              : roundUp5(effectiveSellMin * (1 - tier3Discount / 100) + transportation + otherExpenses)
                            )}
                          </strong>
                        </div>
                      )}
                      {/* Tier 4 */}
                      {tier4Discount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Tier 4 ({tier3Max + 1}+ units){tier4Discount < 1 ? ` ÷ ${tier4Discount}` : ` ${tier4Discount}% off`}:</span>
                          <strong style={{ color: "var(--primary)", fontSize: "14px" }}>
                            {formatCurrency(tier4Discount < 1
                              ? roundUp5(buyAvg / tier4Discount + transportation + otherExpenses)
                              : roundUp5(effectiveSellMin * (1 - tier4Discount / 100) + transportation + otherExpenses)
                            )}
                          </strong>
                        </div>
                      )}
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

                    {/* T17: SA notification note */}
                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--primary)" }}>📢</span>
                        <span>SA Notification Message</span>
                        <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--primary)", background: "rgba(59,130,246,0.1)", padding: "1px 6px", borderRadius: "4px" }}>Visible to Sales Agent</span>
                      </span>
                      <textarea
                        name="saNote"
                        rows={2}
                        value={saNote}
                        onChange={e => setSaNote(e.target.value)}
                        placeholder="Optional — message shown in SA price update alert, e.g. 'USD rate change — prices effective immediately'"
                        style={{
                          padding: "8px 12px", borderRadius: "8px", fontSize: "12px", resize: "vertical",
                          border: "1.5px solid rgba(59,130,246,0.4)", background: "var(--bg-elevated)",
                          color: "var(--text-primary)", marginTop: "4px", width: "100%"
                        }}
                      />
                    </label>

                    {/* T17: Internal SC-only note */}
                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>🔒</span>
                        <span>Internal Note</span>
                        <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "1px 6px", borderRadius: "4px" }}>SC / Admin only</span>
                      </span>
                      <textarea
                        name="internalNote"
                        rows={2}
                        value={internalNote}
                        onChange={e => setInternalNote(e.target.value)}
                        placeholder="Optional — private note not shown to SA, e.g. 'awaiting confirmation from supplier'"
                        style={{
                          padding: "8px 12px", borderRadius: "8px", fontSize: "12px", resize: "vertical",
                          border: "1px solid var(--border)", background: "var(--bg-elevated)",
                          color: "var(--text-primary)", marginTop: "4px", width: "100%"
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

          {/* ── Published Price History (Last 3 Months) ───────────────────────── */}
          {publishedPriceHistory.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "16px" }}>📋</span>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {locale === "ar" ? "سجل الأسعار المنشورة" : "Published Price History"}
                </span>
                <span style={{
                  fontSize: "10px", fontWeight: 700, background: "var(--bg-subtle)",
                  border: "1px solid var(--border)", borderRadius: "99px",
                  padding: "1px 7px", color: "var(--text-muted)",
                }}>
                  {locale === "ar" ? `آخر ${publishedPriceHistory.length} أشهر` : `Last ${publishedPriceHistory.length} month${publishedPriceHistory.length > 1 ? "s" : ""}`}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "540px", overflowY: "auto", paddingRight: "4px" }}>
                {publishedPriceHistory.map(([m, h]) => {
                  const isTierRecord  = h.new_tier_pricing_enabled === 1;
                  const isFirstPub    = h.is_update === 0;
                  const histTransport = h.new_transportation ?? 0;
                  const histOther     = h.new_other_expenses ?? 0;
                  const hasOverride   = h.new_transport_override_enabled === 1;
                  const overrideAmt   = h.new_transport_override_amount ?? 0;
                  const accentColor   = isFirstPub ? "var(--success)" : "var(--primary)";

                  // Helper: compute tier price from buy_avg + divisor + hist transport
                  const histTierPrice = (divisor: number | undefined): number | null => {
                    if (!divisor || !h.new_buy_avg) return null;
                    const raw = divisor < 1
                      ? h.new_buy_avg / divisor + histTransport + histOther
                      : h.new_buy_avg * (1 + divisor / 100) + histTransport + histOther;
                    return Math.ceil(raw / 5) * 5;
                  };

                  return (
                    <div key={m} style={{
                      borderRadius: "10px",
                      border: `1.5px solid ${isFirstPub ? "rgba(16,185,129,0.25)" : "var(--border-light)"}`,
                      background: isFirstPub ? "rgba(16,185,129,0.03)" : "var(--bg-elevated)",
                      overflow: "hidden",
                    }}>
                      {/* Card header */}
                      <div style={{
                        padding: "7px 12px",
                        background: isFirstPub ? "rgba(16,185,129,0.07)" : "var(--bg-subtle)",
                        borderBottom: `1px solid ${isFirstPub ? "rgba(16,185,129,0.2)" : "var(--border-light)"}`,
                        display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-primary)" }}>
                          {formatMonthLabel(m)}
                        </span>
                        <span style={{
                          fontSize: "9px", fontWeight: 800, textTransform: "uppercase",
                          padding: "2px 6px", borderRadius: "4px",
                          background: accentColor, color: "#fff",
                        }}>
                          {isFirstPub ? (locale === "ar" ? "أول نشر" : "First Publish") : (locale === "ar" ? "تحديث" : "Updated")}
                        </span>
                        <span style={{
                          fontSize: "9px", fontWeight: 800,
                          padding: "2px 7px", borderRadius: "4px",
                          background: isTierRecord ? "rgba(99,102,241,0.10)" : "rgba(59,130,246,0.08)",
                          color: isTierRecord ? "var(--primary)" : "#0369a1",
                          border: `1px solid ${isTierRecord ? "rgba(99,102,241,0.25)" : "rgba(59,130,246,0.2)"}`,
                        }}>
                          {isTierRecord ? "⚡ TIER" : `📊 ${(h.new_strategy || "").toUpperCase()}`}
                        </span>
                        <span style={{ marginInlineStart: "auto", fontSize: "9.5px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDateTime(h.changed_at)} · {h.changed_by}
                        </span>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "7px" }}>

                        {/* Prices */}
                        {isTierRecord ? (
                          <div>
                            <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
                              {locale === "ar" ? "أسعار الشرائح" : "Tier Selling Prices"}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                              {([
                                { label: `T1 (1–${tier1Max})`, price: h.new_sell_min },
                                { label: `T2 (${tier1Max + 1}–${tier2Max})`, price: histTierPrice(tier2Discount) },
                                { label: `T3 (${tier2Max + 1}–${tier3Max})`, price: histTierPrice(tier3Discount) },
                                ...(tier4Discount > 0 ? [{ label: `T4 (${tier3Max + 1}+)`, price: histTierPrice(tier4Discount) }] : []),
                              ] as { label: string; price: number | null }[]).map((t, i) => (
                                <div key={i} style={{
                                  padding: "5px 8px",
                                  background: i === 0 ? "rgba(99,102,241,0.07)" : "var(--bg-surface)",
                                  borderRadius: "6px",
                                  border: `1px solid ${i === 0 ? "rgba(99,102,241,0.2)" : "var(--border-light)"}`,
                                }}>
                                  <div style={{ fontSize: "9px", color: "var(--text-muted)", marginBottom: "2px" }}>{t.label}</div>
                                  <div style={{ fontSize: "13px", fontWeight: 800, color: i === 0 ? "var(--primary)" : "var(--text-primary)" }}>
                                    {t.price !== null ? formatCurrency(t.price) : "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
                              {locale === "ar" ? "نطاق سعر البيع" : "Selling Price Range"}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <div style={{ padding: "6px 10px", background: "rgba(16,185,129,0.07)", borderRadius: "6px", border: "1px solid rgba(16,185,129,0.2)" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", marginBottom: "2px" }}>{locale === "ar" ? "الحد الأدنى" : "Min Price"}</div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--success)" }}>{formatCurrency(h.new_sell_min)}</div>
                              </div>
                              <span style={{ color: "var(--text-dim)", fontSize: "16px" }}>→</span>
                              <div style={{ padding: "6px 10px", background: "rgba(59,130,246,0.07)", borderRadius: "6px", border: "1px solid rgba(59,130,246,0.2)" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", marginBottom: "2px" }}>{locale === "ar" ? "الحد الأقصى" : "Max Price"}</div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>{formatCurrency(h.new_sell_max)}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Cost breakdown */}
                        <div style={{
                          display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "10.5px",
                          padding: "5px 8px", background: "var(--bg-subtle)", borderRadius: "6px",
                        }}>
                          <span style={{ color: "var(--text-muted)" }}>💰</span>
                          <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "متوسط التكلفة:" : "Buy avg:"}</span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(h.new_buy_avg)}</span>
                          <span style={{ color: "var(--border-medium)" }}>·</span>
                          <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "الهامش:" : "Markup:"}</span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            {h.new_markup_min.toFixed(1)}%{!isTierRecord && h.new_markup_min !== h.new_markup_max ? ` – ${h.new_markup_max.toFixed(1)}%` : ""}
                          </span>
                          {histOther > 0 && (
                            <>
                              <span style={{ color: "var(--border-medium)" }}>·</span>
                              <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "مصاريف:" : "Exp:"}</span>
                              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(histOther)}</span>
                            </>
                          )}
                        </div>

                        {/* Transport row */}
                        {histTransport > 0 && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: "6px", fontSize: "10.5px",
                            padding: "5px 8px", borderRadius: "6px",
                            background: hasOverride ? "rgba(245,158,11,0.07)" : "var(--bg-subtle)",
                            border: hasOverride ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border-light)",
                          }}>
                            <span>🚚</span>
                            <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "نقل:" : "Transport:"}</span>
                            <span style={{ fontWeight: 700, color: hasOverride ? "#b45309" : "var(--text-primary)" }}>
                              {formatCurrency(hasOverride ? overrideAmt : histTransport)}/unit
                            </span>
                            {hasOverride && (
                              <>
                                <span style={{ color: "var(--text-dim)", fontSize: "9px" }}>(default: {formatCurrency(histTransport)})</span>
                                <span style={{
                                  fontSize: "9px", fontWeight: 800, padding: "1px 5px",
                                  background: "rgba(245,158,11,0.15)", borderRadius: "4px",
                                  color: "#92400e", border: "1px solid rgba(245,158,11,0.3)",
                                }}>⚠️ OVERRIDDEN</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Change reason */}
                        {h.change_reason && (
                          <div style={{
                            padding: "5px 10px",
                            background: "var(--bg-subtle)", borderRadius: "6px",
                            fontSize: "10.5px", color: "var(--text-secondary)",
                            borderInlineStart: "3px solid var(--primary)",
                          }}>
                            💬 {h.change_reason}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
