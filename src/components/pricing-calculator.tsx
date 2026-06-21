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
  negotiated_price?: number | null;
  negotiated_notes?: string | null;
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
  const [useMarkup, setUseMarkup]       = useState(true);
  const [markupRef, setMarkupRef]       = useState<"min" | "avg" | "max">("max");
  const [markupType, setMarkupType]     = useState<"pct" | "fixed" | "div">("pct");
  const [markupMinVal, setMarkupMinVal] = useState<string>("");
  const [markupMaxVal, setMarkupMaxVal] = useState<string>("");

  // Custom Tiers Overwrites state
  const [t1Max, setT1Max] = useState<string>("");
  const [t1Disc, setT1Disc] = useState<string>("");
  const [t2Max, setT2Max] = useState<string>("");
  const [t2Disc, setT2Disc] = useState<string>("");
  const [t3Max, setT3Max] = useState<string>("");
  const [t3Disc, setT3Disc] = useState<string>("");
  const [t4Disc, setT4Disc] = useState<string>("");

  // Numeric equivalents of custom tier configurations
  const numT1Max = isNaN(parseInt(t1Max)) ? 100 : parseInt(t1Max);
  const numT1Disc = isNaN(parseFloat(t1Disc)) ? 0.0 : parseFloat(t1Disc);
  const numT2Max = isNaN(parseInt(t2Max)) ? 200 : parseInt(t2Max);
  const numT2Disc = isNaN(parseFloat(t2Disc)) ? 0.0 : parseFloat(t2Disc);
  const numT3Max = isNaN(parseInt(t3Max)) ? 800 : parseInt(t3Max);
  const numT3Disc = isNaN(parseFloat(t3Disc)) ? 0.0 : parseFloat(t3Disc);
  const numT4Disc = isNaN(parseFloat(t4Disc)) ? 0.0 : parseFloat(t4Disc);

  const [showRecommendationModal, setShowRecommendationModal] = useState(false);

  // ── Egypt B2B Pricing Recommendation Engine ───────────────────────
  const recommendationData = useMemo(() => {
    // 1. Find negotiated prices for this month
    const currentMonthNegotiations = priceEntries.filter(
      pe => pe.item_id === itemId && pe.month === month && pe.negotiated_price !== null && pe.negotiated_price !== undefined && pe.negotiated_price > 0
    );
    const minNegotiatedPrice = currentMonthNegotiations.length > 0 
      ? Math.min(...currentMonthNegotiations.map(pe => pe.negotiated_price!)) 
      : null;

    // 2. Base Cost is the cheapest supplier quote or negotiated price
    const baseCost = minNegotiatedPrice !== null ? Math.min(buyMin, minNegotiatedPrice) : buyMin;

    // 3. Recommended Strategy
    const recStrategy = (tierEnabled && isTiered) ? "tier" : "fixed";

    // 4. Recommended Markup / Price
    const minFloor = floorPct ?? 5;
    
    let recMarkup = Math.max(minFloor + 5, 10); // Start at floor + 5% or 10%

    // In Egypt, B2B wholesale pricing operates on lean margins but must respect the floor.
    // If it's Tiered, we must check that after discounts are applied, net markup does not violate minFloor.
    if (recStrategy === "tier") {
      const checkViolations = (m: number) => {
        const baseSell = baseCost * (1 + m / 100);
        // Tier 1 net markup
        if (m < minFloor) return true;
        // Tier 2
        if (tier2Discount > 0) {
          const t2Price = baseSell * (1 - tier2Discount / 100);
          const t2Markup = ((t2Price / baseCost) - 1) * 100;
          if (t2Markup < minFloor) return true;
        }
        // Tier 3
        if (tier3Discount > 0) {
          const t3Price = baseSell * (1 - tier3Discount / 100);
          const t3Markup = ((t3Price / baseCost) - 1) * 100;
          if (t3Markup < minFloor) return true;
        }
        // Tier 4
        if (tier4Discount > 0) {
          const t4Price = baseSell * (1 - tier4Discount / 100);
          const t4Markup = ((t4Price / baseCost) - 1) * 100;
          if (t4Markup < minFloor) return true;
        }
        return false;
      };

      while (checkViolations(recMarkup) && recMarkup < 100) {
        recMarkup += 1;
      }
    }

    const finalTransport = transportOverrideEnabled ? (parseFloat(transportOverrideAmount) || transportation) : transportation;

    // Calculate final recommended prices rounded up to nearest 5 EGP
    const recBaseSell = Math.ceil((baseCost * (1 + recMarkup / 100)) / 5) * 5;
    const recMinMarkup = Math.max(minFloor + 2, 7);
    const recMinSell = Math.ceil((baseCost * (1 + recMinMarkup / 100)) / 5) * 5;
    const recMaxMarkup = Math.max(minFloor + 12, 15);
    const recMaxSell = Math.ceil((baseCost * (1 + recMaxMarkup / 100)) / 5) * 5;

    return {
      minNegotiatedPrice,
      currentMonthNegotiations,
      baseCost,
      recStrategy,
      recMarkup,
      recBaseSell,
      recMinMarkup,
      recMinSell,
      recMaxMarkup,
      recMaxSell,
      finalTransport,
      minFloor
    };
  }, [priceEntries, itemId, month, buyMin, tierEnabled, isTiered, floorPct, tier2Discount, tier3Discount, tier4Discount, transportOverrideEnabled, transportOverrideAmount, transportation, otherExpenses]);

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
    formData.set("strategy", useMarkup ? markupRef : "avg");
    formData.set("markupType", useMarkup ? (markupType === "div" ? "divisor" : markupType === "fixed" ? "amount" : "percent") : "percent");
    formData.set("markupMin", useMarkup ? markupMinVal : String(Math.max(0, calculatedMarkupMin)));
    formData.set("markupMax", useMarkup ? (usesTierStrategy ? markupMinVal : markupMaxVal) : String(Math.max(0, calculatedMarkupMax)));
    formData.set("tierPricingEnabled", usesTierStrategy ? "on" : "off");
    formData.set("otherExpenses", String(otherExpenses));
    formData.set("changeReason", internalNote);
    formData.set("tier1Max", t1Max);
    formData.set("tier1Discount", t1Disc);
    formData.set("tier2Max", t2Max);
    formData.set("tier2Discount", t2Disc);
    formData.set("tier3Max", t3Max);
    formData.set("tier3Discount", t3Disc);
    formData.set("tier4Discount", t4Disc);

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

    // Load custom tiers first to extract default T1 divisor
    const getValidDivisor = (val: any, fallback: number): number => {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0 && num < 1) {
        return num;
      }
      return fallback;
    };

    const ext = existing as any;
    const resolvedT1Max = ext?.tier1_max ?? (tier1Max && tier1Max > 0 ? tier1Max : 100);
    const resolvedT2Max = ext?.tier2_max ?? (tier2Max && tier2Max > 0 ? tier2Max : 200);
    const resolvedT3Max = ext?.tier3_max ?? (tier3Max && tier3Max > 0 ? tier3Max : 800);

    // Resolve divisors using the helper
    const resolvedT1Disc = getValidDivisor(ext?.tier1_discount ?? tier1Discount, 0.77);
    const resolvedT2Disc = getValidDivisor(ext?.tier2_discount ?? tier2Discount, 0.83);
    const resolvedT3Disc = getValidDivisor(ext?.tier3_discount ?? tier3Discount, 0.85);
    const resolvedT4Disc = getValidDivisor(ext?.tier4_discount ?? tier4Discount, 0.89);

    setT1Max(String(resolvedT1Max));
    setT1Disc(resolvedT1Disc.toFixed(2));
    setT2Max(String(resolvedT2Max));
    setT2Disc(resolvedT2Disc.toFixed(2));
    setT3Max(String(resolvedT3Max));
    setT3Disc(resolvedT3Disc.toFixed(2));
    setT4Disc(resolvedT4Disc.toFixed(2));

    // Initialize/Reset Markup Assistant (always default to Max + Divisor)
    setUseMarkup(true);
    setMarkupRef("max"); // Always default Reference Cost to Max buy price
    setMarkupType("div"); // Always default Type to ÷ Divisor

    const defaultDivMin = resolvedT1Disc;
    const defaultDivMax = resolvedT2Disc;

    if (existing && existing.markup_type === "divisor") {
      setMarkupMinVal(getValidDivisor(existing.markup_min, defaultDivMin).toFixed(2));
    } else {
      setMarkupMinVal(defaultDivMin.toFixed(2));
    }

    if (existing && existing.markup_type === "divisor" && existing.markup_max) {
      setMarkupMaxVal(getValidDivisor(existing.markup_max, defaultDivMax).toFixed(2));
    } else {
      setMarkupMaxVal(defaultDivMax.toFixed(2));
    }
  }, [itemId, existing, buyMin, buyMax, buyAvg, transportation, usesTierStrategy, recommendationData.recMarkup, recommendationData.recMaxMarkup, tier1Max, tier1Discount, tier2Max, tier2Discount, tier3Max, tier3Discount, tier4Discount]);

  // Reset success and confirmation state ONLY when the active itemId changes
  useEffect(() => {
    setPublishSuccess(false);
    setErrorMsg(null);
    setInternalNote("");
    setSaNote("");
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

  const convertMarkupValue = (currentValStr: string, fromType: "pct" | "fixed" | "div", toType: "pct" | "fixed" | "div"): string => {
    const val = parseFloat(currentValStr) || 0;
    if (val <= 0 || markupRefPrice <= 0) return "";
    
    // 1. Calculate implied selling price (S) from fromType
    let S = markupRefPrice;
    if (fromType === "pct") {
      S = markupRefPrice * (1 + val / 100);
    } else if (fromType === "fixed") {
      S = markupRefPrice + val;
    } else if (fromType === "div") {
      S = val > 0 ? markupRefPrice / val : markupRefPrice;
    }
    
    // 2. Convert implied selling price (S) to toType
    let newVal = 0;
    if (toType === "pct") {
      newVal = ((S / markupRefPrice) - 1) * 100;
    } else if (toType === "fixed") {
      newVal = S - markupRefPrice;
    } else if (toType === "div") {
      newVal = S > 0 ? markupRefPrice / S : 1.0;
    }
    
    return newVal.toFixed(2);
  };

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

  // Reusable full-width panels for Supplier Quotes and Published Price History
  const historyAndQuotes = (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                        <span
                          onClick={() => window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: row.supplierId } }))}
                          className="clickable-detail-trigger"
                        >
                          {row.supplierName}
                        </span>
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
              const histTierPrice = (divisor: number) => {
                if (!divisor || !h.new_buy_avg) return null;
                const raw = divisor < 1
                  ? h.new_buy_avg / divisor + histTransport + histOther
                  : h.new_buy_avg * (1 + divisor / 100) + histTransport + histOther;
                return Math.ceil(raw / 5) * 5;
              };

              // Find negotiated prices for this item in month `m`
              const monthNegotiated = priceEntries.filter(
                pe => pe.item_id === itemId && pe.month === m && pe.negotiated_price != null && pe.negotiated_price > 0
              );

              return (
                <div key={m} style={{
                  borderRadius: "10px",
                  border: `1.5px solid ${isFirstPub ? "rgba(16,185,129,0.2)" : "var(--border-light)"}`,
                  background: isFirstPub ? "rgba(16,185,129,0.02)" : "var(--bg-elevated)",
                  overflow: "hidden",
                  fontSize: "12px"
                }}>
                  {/* Card header */}
                  <div style={{
                    padding: "6px 12px",
                    background: isFirstPub ? "rgba(16,185,129,0.05)" : "var(--bg-subtle)",
                    borderBottom: `1px solid ${isFirstPub ? "rgba(16,185,129,0.15)" : "var(--border-light)"}`,
                    display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--text-primary)" }}>
                      {formatMonthLabel(m)}
                    </span>
                    <span style={{
                      fontSize: "8.5px", fontWeight: 800, textTransform: "uppercase",
                      padding: "1px 5px", borderRadius: "3px",
                      background: accentColor, color: "#fff",
                    }}>
                      {isFirstPub ? (locale === "ar" ? "أول نشر" : "First Publish") : (locale === "ar" ? "تحديث" : "Updated")}
                    </span>
                    <span style={{
                      fontSize: "8.5px", fontWeight: 800,
                      padding: "1px 5px", borderRadius: "3px",
                      background: isTierRecord ? "rgba(99,102,241,0.10)" : "rgba(59,130,246,0.08)",
                      color: isTierRecord ? "var(--primary)" : "#0369a1",
                      border: `1px solid ${isTierRecord ? "rgba(99,102,241,0.25)" : "rgba(59,130,246,0.2)"}`,
                    }}>
                      {isTierRecord ? "⚡ TIER" : `📊 ${(h.new_strategy || "").toUpperCase()}`}
                    </span>
                    <span style={{ marginInlineStart: "auto", fontSize: "9px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {formatDateTime(h.changed_at)} · {h.changed_by}
                    </span>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>

                    {/* Prices */}
                    {isTierRecord ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {[
                          { label: `T1`, price: h.new_sell_min },
                          { label: `T2`, price: histTierPrice(tier2Discount) },
                          { label: `T3`, price: histTierPrice(tier3Discount) },
                          ...(tier4Discount > 0 ? [{ label: `T4`, price: histTierPrice(tier4Discount) }] : []),
                        ].map((t, i) => (
                          <div key={i} style={{
                            flex: 1, minWidth: "60px", textAlign: "center",
                            padding: "4px 6px",
                            background: i === 0 ? "rgba(99,102,241,0.05)" : "var(--bg-surface)",
                            borderRadius: "6px",
                            border: `1px solid ${i === 0 ? "rgba(99,102,241,0.15)" : "var(--border-light)"}`,
                          }}>
                            <span style={{ fontSize: "8.5px", color: "var(--text-muted)" }}>{t.label}:</span>{" "}
                            <strong style={{ fontSize: "11px", fontWeight: 800, color: i === 0 ? "var(--primary)" : "var(--text-primary)" }}>
                              {t.price !== null ? formatCurrency(t.price) : "—"}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: "4px 8px", background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "6px",
                        fontSize: "11px", display: "flex", gap: "6px", alignItems: "center"
                      }}>
                        <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "نطاق البيع:" : "Selling Range:"}</span>
                        <strong style={{ color: "var(--success)" }}>{formatCurrency(h.new_sell_min)}</strong>
                        <span style={{ color: "var(--text-dim)" }}>→</span>
                        <strong style={{ color: "var(--primary)" }}>{formatCurrency(h.new_sell_max)}</strong>
                      </div>
                    )}

                    {/* Combined Cost details */}
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "10px",
                      padding: "4px 8px", background: "var(--bg-subtle)", borderRadius: "6px",
                      alignItems: "center"
                    }}>
                      <span>💰</span>
                      <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "التكلفة:" : "Buy avg:"}</span>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(h.new_buy_avg)}</span>
                      
                      <span style={{ color: "var(--border-medium)" }}>·</span>
                      <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "الهامش:" : "Markup:"}</span>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                        {h.new_markup_min.toFixed(1)}%{!isTierRecord && h.new_markup_min !== h.new_markup_max ? `–${h.new_markup_max.toFixed(1)}%` : ""}
                      </span>

                      {histTransport > 0 && (
                        <>
                          <span style={{ color: "var(--border-medium)" }}>·</span>
                          <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "نقل:" : "Transport:"}</span>
                          <span style={{ fontWeight: 700, color: hasOverride ? "#b45309" : "var(--text-primary)" }}>
                            {formatCurrency(hasOverride ? overrideAmt : histTransport)}
                          </span>
                          {hasOverride && <span style={{ fontSize: "7.5px", fontWeight: 800, color: "#b45309", background: "rgba(245,158,11,0.15)", padding: "0px 3px", borderRadius: "2px" }}>O</span>}
                        </>
                      )}

                      {histOther > 0 && (
                        <>
                          <span style={{ color: "var(--border-medium)" }}>·</span>
                          <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "مصاريف:" : "Exp:"}</span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(histOther)}</span>
                        </>
                      )}
                    </div>

                    {/* Negotiated Prices */}
                    {monthNegotiated.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                        <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          🤝 {locale === "ar" ? "الأسعار المتفق عليها:" : "Negotiated:"}
                        </span>
                        {monthNegotiated.map((np) => (
                          <span key={np.id} style={{
                            fontSize: "9px", fontWeight: 700, padding: "1px 5px",
                            background: "rgba(139,92,246,0.08)", color: "#7c3aed",
                            border: "1px solid rgba(139,92,246,0.2)", borderRadius: "4px"
                          }} title={np.negotiated_notes || undefined}>
                            {np.supplier_name}: {formatCurrency(np.negotiated_price!)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Change reason */}
                    {h.change_reason && (
                      <div style={{
                        padding: "4px 8px",
                        background: "var(--bg-subtle)", borderRadius: "6px",
                        fontSize: "10px", color: "var(--text-secondary)",
                        borderInlineStart: "2.5px solid var(--primary)",
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
  );


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {errorMsg && (
        <div className="restriction-info-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", margin: 0 }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {publishSuccess ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Animated Success Banner */}
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
            {usesTierStrategy ? (
              <div style={{
                background: "var(--bg-subtle)", border: "1px solid var(--border)",
                borderRadius: "10px", padding: "12px 16px", width: "100%",
                maxWidth: "340px", marginBottom: "24px",
              }}>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Published Tier Prices</div>
                {[
                  { label: `Tier 1  (1 – ${numT1Max} units)`, price: finalSellMin },
                  { label: `Tier 2  (${numT1Max + 1} – ${numT2Max} units)`, price: numT2Disc > 0 && numT2Disc < 1 ? roundUp5(markupRefPrice / numT2Disc + transportation + otherExpenses) : roundUp5(effectiveSellMin * (1 - numT2Disc / 100) + transportation + otherExpenses) },
                  { label: `Tier 3  (${numT2Max + 1} – ${numT3Max} units)`, price: numT3Disc > 0 && numT3Disc < 1 ? roundUp5(markupRefPrice / numT3Disc + transportation + otherExpenses) : roundUp5(effectiveSellMin * (1 - numT3Disc / 100) + transportation + otherExpenses) },
                  ...(numT4Disc > 0 ? [{ label: `Tier 4  (${numT3Max + 1}+ units)`, price: numT4Disc < 1 ? roundUp5(markupRefPrice / numT4Disc + transportation + otherExpenses) : roundUp5(effectiveSellMin * (1 - numT4Disc / 100) + transportation + otherExpenses) }] : []),
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

            {/* Success Actions */}
            <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "320px" }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setPublishSuccess(false);
                  setInternalNote("");
                  setSaNote("");
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

          {/* Full Card Width Reference details in success view */}
          {historyAndQuotes}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
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

          {/* TOP SECTION: Side-by-Side (Inputs & Cost stats) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px", alignItems: "start" }}>
            
            {/* Top Left: Input fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              {/* ── Markup Assistant ─────────────────────────────────── */}
              <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                <button type="button"
                  onClick={() => setUseMarkup(v => {
                    const next = !v;
                    if (next) setMarkupRef("max");
                    return next;
                  })}
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
                        {(["min", "avg", "max"] as const).map(key => {
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
                              onClick={() => {
                                setMarkupMinVal(prev => convertMarkupValue(prev, markupType, t));
                                if (!usesTierStrategy) {
                                  setMarkupMaxVal(prev => convertMarkupValue(prev, markupType, t));
                                }
                                setMarkupType(t);
                              }}
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

              {/* ── B2B Recommendation Trigger ── */}
              <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowRecommendationModal(true)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "10px 14px", borderRadius: "10px", fontSize: "12.5px", fontWeight: 800,
                    background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                    color: "#fff", border: "none", cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(99,102,241,0.25)",
                    transition: "all 150ms",
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(99,102,241,0.35)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(99,102,241,0.25)"; }}
                >
                  <span>✨</span>
                  <span>{locale === "ar" ? "توصية تسعير B2B الذكي" : "Get B2B Price Recommendation"}</span>
                </button>
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

              {/* ── MOQ highlighted card ── */}
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
                    {moq.toLocaleString()} <span style={{ fontSize: "11px", fontWeight: 600 }}>{locale === "ar" ? "وحدة" : "units"}</span>
                  </div>
                </div>
              )}

              {/* Hidden inputs */}
              <input type="hidden" name="otherExpenses" value={otherExpenses} />
              <input type="hidden" name="transportOverrideEnabled" value={transportOverrideEnabled ? "1" : "0"} />
              {transportOverrideEnabled && (
                <input type="hidden" name="transportOverride" value={transportOverrideAmount} />
              )}
            </div>

            {/* Top Right: Cost references & Warnings */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "0" }}>
              {/* ── Base Price Card ─────────────────────────────────── */}
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

              {/* ── Floor Violation Banner ── */}
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

              {/* ── Floor Near-Warning ── */}
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

              {/* Final Price Summary Box */}
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

              {/* Volume Tier Preview */}
              {usesTierStrategy && (
                <div style={{
                  padding: "16px",
                  background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.08) 100%)",
                  border: "1.5px dashed rgba(16,185,129,0.3)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    ⚡ Live Volume Tier Editor (rounded to 5 EGP)
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                    {/* Table Header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1fr", gap: "8px", fontWeight: 700, color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", paddingBottom: "4px", borderBottom: "1.5px solid var(--border)" }}>
                      <span>Tier Range</span>
                      <span style={{ textAlign: "center" }}>Max Unit</span>
                      <span style={{ textAlign: "center" }}>Disc% / Div</span>
                      <span style={{ textAlign: "right" }}>Price</span>
                    </div>

                    {/* Tier 1 Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1fr", gap: "8px", alignItems: "center", borderBottom: "1px dashed var(--border-light)", paddingBottom: "6px" }}>
                      <span style={{ fontWeight: 600 }}>T1 (1 – {numT1Max} units)</span>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          min="1"
                          value={t1Max}
                          onChange={(e) => setT1Max(e.target.value)}
                          style={{ width: "70px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--bg-elevated)", color: "var(--text-primary)", textAlign: "center" }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={t1Disc}
                          onChange={(e) => setT1Disc(e.target.value)}
                          style={{ width: "70px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--bg-elevated)", color: "var(--text-primary)", textAlign: "center" }}
                          placeholder="0.0"
                        />
                      </div>
                      <strong style={{ color: "var(--success)", fontSize: "13.5px", textAlign: "right" }}>
                        {formatCurrency(finalSellMin)}
                      </strong>
                    </div>

                    {/* Tier 2 Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1fr", gap: "8px", alignItems: "center", borderBottom: "1px dashed var(--border-light)", paddingBottom: "6px" }}>
                      <span style={{ fontWeight: 600 }}>T2 ({numT1Max + 1} – {numT2Max} U)</span>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          min={numT1Max + 1}
                          value={t2Max}
                          onChange={(e) => setT2Max(e.target.value)}
                          style={{ width: "70px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--bg-elevated)", color: "var(--text-primary)", textAlign: "center" }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={t2Disc}
                          onChange={(e) => setT2Disc(e.target.value)}
                          style={{ width: "70px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--bg-elevated)", color: "var(--text-primary)", textAlign: "center" }}
                          placeholder="5.0"
                        />
                      </div>
                      <strong style={{ color: "var(--primary)", fontSize: "13.5px", textAlign: "right" }}>
                        {formatCurrency(
                          numT2Disc > 0 && numT2Disc < 1
                            ? roundUp5(markupRefPrice / numT2Disc + transportation + otherExpenses)
                            : roundUp5(effectiveSellMin * (1 - numT2Disc / 100) + transportation + otherExpenses)
                        )}
                      </strong>
                    </div>

                    {/* Tier 3 Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1fr", gap: "8px", alignItems: "center", borderBottom: "1px dashed var(--border-light)", paddingBottom: "6px" }}>
                      <span style={{ fontWeight: 600 }}>T3 ({numT2Max + 1} – {numT3Max} U)</span>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          min={numT2Max + 1}
                          value={t3Max}
                          onChange={(e) => setT3Max(e.target.value)}
                          style={{ width: "70px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--bg-elevated)", color: "var(--text-primary)", textAlign: "center" }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={t3Disc}
                          onChange={(e) => setT3Disc(e.target.value)}
                          style={{ width: "70px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--bg-elevated)", color: "var(--text-primary)", textAlign: "center" }}
                          placeholder="10.0"
                        />
                      </div>
                      <strong style={{ color: "var(--primary)", fontSize: "13.5px", textAlign: "right" }}>
                        {formatCurrency(
                          numT3Disc > 0 && numT3Disc < 1
                            ? roundUp5(markupRefPrice / numT3Disc + transportation + otherExpenses)
                            : roundUp5(effectiveSellMin * (1 - numT3Disc / 100) + transportation + otherExpenses)
                        )}
                      </strong>
                    </div>

                    {/* Tier 4 Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1fr", gap: "8px", alignItems: "center", paddingBottom: "4px" }}>
                      <span style={{ fontWeight: 600 }}>T4 ({numT3Max + 1}+ U)</span>
                      <div style={{ display: "flex", justifyContent: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                        ∞
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={t4Disc}
                          onChange={(e) => setT4Disc(e.target.value)}
                          style={{ width: "70px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--bg-elevated)", color: "var(--text-primary)", textAlign: "center" }}
                          placeholder="0.0"
                        />
                      </div>
                      <strong style={{ color: "var(--primary)", fontSize: "13.5px", textAlign: "right" }}>
                        {formatCurrency(
                          numT4Disc > 0 && numT4Disc < 1
                            ? roundUp5(markupRefPrice / numT4Disc + transportation + otherExpenses)
                            : roundUp5(effectiveSellMin * (1 - numT4Disc / 100) + transportation + otherExpenses)
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM SECTION: Full width reference panels & Confirmation Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Horizontal quotes table and compact history cards */}
            {historyAndQuotes}

            {/* Price Update Confirmation Required box */}
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

                {/* T17: Internal SC-only note & Change Reason */}
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🔒</span>
                    <span>Internal Note & Change Reason</span>
                    <span style={{ color: "var(--danger)" }}>*</span>
                    <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "1px 6px", borderRadius: "4px" }}>SC / Admin only</span>
                  </span>
                  <textarea
                    name="internalNote"
                    rows={2}
                    required
                    value={internalNote}
                    onChange={e => setInternalNote(e.target.value)}
                    placeholder="Required — e.g. Supplier raised prices, USD rate change. Private audit note."
                    style={{
                      padding: "8px 12px", borderRadius: "8px", fontSize: "12px", resize: "vertical",
                      border: "1.5px solid rgba(245,158,11,0.5)", background: "var(--bg-elevated)",
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

            {/* Submit Action Button */}
            <div style={{ marginTop: "4px" }}>
              <button
                type="submit"
                disabled={floorViolated || maxViolated || isPending || (isUpdate && (!confirmUpdate || !internalNote.trim()))}
                className="button button-primary button-block"
                style={{
                  padding: "10px", fontSize: "13px", cursor: (floorViolated || maxViolated || isPending || (isUpdate && (!confirmUpdate || !internalNote.trim()))) ? "not-allowed" : "pointer",
                  opacity: (floorViolated || maxViolated || isPending || (isUpdate && (!confirmUpdate || !internalNote.trim()))) ? 0.5 : 1,
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
          </div>
        </form>
      )}

      {/* Floating B2B Recommendation Modal */}
      {showRecommendationModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 3000,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-medium)",
            borderRadius: "16px", boxShadow: "var(--shadow-xl)",
            width: "100%", maxWidth: "560px", padding: "24px",
            display: "flex", flexDirection: "column", gap: "16px",
            animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
            textAlign: locale === "ar" ? "right" : "left",
          }}>
            <div>
              <p style={{ fontSize: "10.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary)", marginBottom: "4px" }}>
                ✨ {locale === "ar" ? "توصية تسعير B2B الذكي" : "B2B Price Recommendation"}
              </p>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                {locale === "ar" ? "تحليل تسعير السوق المصري" : "Egypt B2B Market Pricing Strategy"}
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
              {/* Cost & Floor section */}
              <div style={{
                background: "var(--bg-subtle)", padding: "12px", borderRadius: "10px",
                border: "1px solid var(--border-light)", fontSize: "12px", display: "flex", flexDirection: "column", gap: "8px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "التكلفة الأساسية المفضلة:" : "Preferred Cost Base:"}</span>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(recommendationData.baseCost)}{" "}
                    {recommendationData.minNegotiatedPrice !== null && (
                      <span style={{ fontSize: "9.5px", color: "var(--success)", background: "var(--success-light)", padding: "1px 5px", borderRadius: "4px", marginInlineStart: "5px" }}>
                        {locale === "ar" ? "سعر متفاوض عليه" : "Negotiated"}
                      </span>
                    )}
                  </strong>
                </div>
                {recommendationData.currentMonthNegotiations.length > 0 && (
                  <div style={{ padding: "6px 10px", background: "var(--bg-elevated)", borderRadius: "6px", fontSize: "11px" }}>
                    <div style={{ color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>
                      {locale === "ar" ? "الأسعار المتفاوض عليها المكتشفة:" : "Discovered Negotiations:"}
                    </div>
                    {recommendationData.currentMonthNegotiations.map((np, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span>• {np.supplier_name}</span>
                        <strong>{formatCurrency(np.negotiated_price!)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-light)", paddingTop: "6px" }}>
                  <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "تكلفة النقل الفعالة:" : "Effective Transport fee:"}</span>
                  <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(recommendationData.finalTransport)} / {locale === "ar" ? "وحدة" : "unit"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>{locale === "ar" ? "الحد الأدنى لهامش الربح:" : "Admin Min Margin Floor:"}</span>
                  <strong style={{ color: "var(--danger)" }}>{recommendationData.minFloor}%</strong>
                </div>
              </div>

              {/* Egypt Market Context */}
              <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                💡 <strong>{locale === "ar" ? "سياق السوق المصري:" : "Egypt Market Context:"}</strong>{" "}
                {locale === "ar" 
                  ? "السوق المصري يتميز بحساسية شديدة للأسعار وتضخم متقلب. المشترون B2B يقارنون أسعار الشرائح للكميات الكبيرة بدقة. نوصي باستعمال تسعير الشرائح لتقديم خصومات مغرية للكميات الكبيرة مع حماية هامش الربح الأساسي للكميات الصغيرة."
                  : "The Egyptian B2B market is highly price-sensitive and inflation-driven. Wholesale clients heavily analyze unit prices at higher volume tiers. We recommend leveraging the Tier Pricing strategy to structure attractive volume discounts while keeping baseline margins secure."
                }
              </div>

              {/* Recommended Action */}
              <div style={{
                background: recommendationData.recStrategy === "tier" ? "rgba(99,102,241,0.06)" : "rgba(16,185,129,0.06)",
                border: `1.5px solid ${recommendationData.recStrategy === "tier" ? "rgba(99,102,241,0.25)" : "rgba(16,185,129,0.25)"}`,
                padding: "12px", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "16px" }}>{recommendationData.recStrategy === "tier" ? "⚡" : "📊"}</span>
                  <span style={{ fontWeight: 800, color: recommendationData.recStrategy === "tier" ? "var(--primary)" : "var(--success)" }}>
                    {recommendationData.recStrategy === "tier" 
                      ? (locale === "ar" ? "الإستراتيجية الموصى بها: نظام الشرائح" : "Recommended Strategy: VOLUME TIERS")
                      : (locale === "ar" ? "الإستراتيجية الموصى بها: السعر الثابت" : "Recommended Strategy: FIXED RANGE")
                    }
                  </span>
                </div>

                {recommendationData.recStrategy === "tier" ? (
                  <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div>
                      {locale === "ar" ? "الهامش الأساسي المقترح:" : "Recommended Base Markup:"} <strong>{recommendationData.recMarkup}%</strong>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {locale === "ar" 
                        ? `تم حساب الهامش ليكون متوافقاً مع حد الإدارة (${recommendationData.minFloor}%) حتى بعد تطبيق الخصم الأقصى للكميات الكبيرة.`
                        : `This base markup ensures that net margins remain fully compliant with the admin floor (${recommendationData.minFloor}%) even after volume tier discounts are applied.`
                      }
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px", padding: "8px", background: "var(--bg-surface)", borderRadius: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>{locale === "ar" ? "سعر الأساس للبيانات (T1):" : "Recommended Tier Base (T1):"}</span>
                        <span style={{ color: "var(--success)" }}>{formatCurrency(recommendationData.recBaseSell)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                        <span>Tier 2 (${tier1Max + 1}–${tier2Max} units):</span>
                        <span>{formatCurrency(tier2Discount < 1 ? Math.ceil((markupRefPrice / tier2Discount + recommendationData.finalTransport + otherExpenses) / 5) * 5 : Math.ceil((recommendationData.recBaseSell * (1 - tier2Discount / 100) + recommendationData.finalTransport + otherExpenses) / 5) * 5)}</span>
                      </div>
                      {tier3Discount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                          <span>Tier 3 (${tier2Max + 1}–${tier3Max} units):</span>
                          <span>{formatCurrency(tier3Discount < 1 ? Math.ceil((markupRefPrice / tier3Discount + recommendationData.finalTransport + otherExpenses) / 5) * 5 : Math.ceil((recommendationData.recBaseSell * (1 - tier3Discount / 100) + recommendationData.finalTransport + otherExpenses) / 5) * 5)}</span>
                        </div>
                      )}
                      {tier4Discount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                          <span>Tier 4 (${tier3Max + 1}+ units):</span>
                          <span>{formatCurrency(tier4Discount < 1 ? Math.ceil((markupRefPrice / tier4Discount + recommendationData.finalTransport + otherExpenses) / 5) * 5 : Math.ceil((recommendationData.recBaseSell * (1 - tier4Discount / 100) + recommendationData.finalTransport + otherExpenses) / 5) * 5)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{locale === "ar" ? "الحد الأدنى المقترح:" : "Recommended Min Price:"}</span>
                      <strong>{formatCurrency(recommendationData.recMinSell)} <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>({recommendationData.recMinMarkup}% markup)</span></strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{locale === "ar" ? "الحد الأقصى المقترح:" : "Recommended Max Price:"}</span>
                      <strong>{formatCurrency(recommendationData.recMaxSell)} <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>({recommendationData.recMaxMarkup}% markup)</span></strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                className="button button-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowRecommendationModal(false)}
              >
                {locale === "ar" ? "إغلاق" : "Cancel"}
              </button>
              <button
                type="button"
                className="button button-primary"
                style={{ flex: 2, background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)", borderColor: "#6366f1", color: "#fff" }}
                onClick={() => {
                  setUsesTierStrategy(recommendationData.recStrategy === "tier");
                  setUseMarkup(false); // Apply direct prices to form
                  if (recommendationData.recStrategy === "tier") {
                    setSellMinStr(recommendationData.recBaseSell.toString());
                  } else {
                    setSellMinStr(recommendationData.recMinSell.toString());
                    setSellMaxStr(recommendationData.recMaxSell.toString());
                  }
                  setInternalNote(
                    recommendationData.minNegotiatedPrice !== null
                      ? `Applied Egypt B2B recommendation based on negotiated supplier price of ${formatCurrency(recommendationData.minNegotiatedPrice)}.`
                      : `Applied standard Egypt B2B recommendation.`
                  );
                  setShowRecommendationModal(false);
                }}
              >
                {locale === "ar" ? "تطبيق التوصية" : "Apply Recommendation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
