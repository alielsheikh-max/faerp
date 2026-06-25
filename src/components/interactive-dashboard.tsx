"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import PricingCalculator from "@/components/pricing-calculator";
import CategoryMarkupPanel from "@/components/category-markup-panel";
import { useI18n } from "@/lib/i18n-context";
import type { SellingPriceHistoryRow, ItemPublishedPrice } from "@/lib/db";
import { ItemCombobox } from "./item-combobox";

// ── Types ─────────────────────────────────────────────────────────────────────
type Category  = { id: number; name: string; description: string | null };
type Item      = { id: number; category_id: number; name: string; unit: string; description: string | null; active: number; transportation_per_unit?: number; moq?: number; is_tiered?: number; tier1_max?: number; tier1_discount?: number; tier2_max?: number; tier2_discount?: number; tier3_max?: number; tier3_discount?: number; tier4_max?: number; tier4_discount?: number; recommended_supplier_id?: number | null };
type Supplier  = { id: number; name: string; fame_name?: string | null; contact_person: string | null; phone: string | null };
type PriceEntry = {
  id: number; item_id: number; supplier_id: number; month: string; price: number;
  recorded_at: string; item_name: string; unit: string; supplier_name: string;
  category_name: string; category_id: number;
  status?: string;
  review_note?: string | null;
};
type Props = {
  categories: Category[];
  items: Item[];
  suppliers: Supplier[];
  priceEntries: PriceEntry[];
  role: string;
  month?: string;
  salesCatalog?: any[];
  username?: string;
  initialCategoryId?: number;
  initialItemId?: number;
  saved?: string;
  error?: string;
  /** Effective margin floor % for the currently selected item (null = no floor) */
  floorPct?: number | null;
  /** Audit history for the currently selected item+month */
  priceHistory?: SellingPriceHistoryRow[];
  /** T26: admin has allowed SC to override transport fee this month */
  scTransportOverrideEnabled?: boolean;
  /** Admin has enabled tier pricing for this month — SC can switch strategy per item */
  tierEnabled?: boolean;
  /** Last N months of published selling prices for the selected item */
  itemSellHistory?: ItemPublishedPrice[];
};

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

// ── Small helpers ─────────────────────────────────────────────────────────────
function color(supplierId: number, suppliers: Supplier[]) {
  const idx = suppliers.findIndex(s => s.id === supplierId);
  return COLORS[idx >= 0 ? idx % COLORS.length : 0];
}

export default function InteractiveDashboard({
  categories, items, suppliers, priceEntries,
  role, month, salesCatalog = [], username,
  initialCategoryId, initialItemId, saved, error,
  floorPct = null,
  priceHistory = [],
  scTransportOverrideEnabled = false,
  tierEnabled = false,
  itemSellHistory = [],
}: Props) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";
  const router = useRouter();

  // ── Selection state ──────────────────────────────────────────────
  const [catId, setCatId] = useState<number | "">(
    initialCategoryId ?? (categories[0]?.id ?? "")
  );
  const [itemId, setItemId] = useState<number>(initialItemId ?? 0);
  const [window, setWindow] = useState<3|6|12>(6);
  const [hoveredDot, setHoveredDot] = useState<{x:number;y:number;price:number;month:string;supplier:string}|null>(null);

  const filteredItems = useMemo(
    () => catId === "" ? items : items.filter(i => i.category_id === catId),
    [catId, items]
  );

  // Keep states in sync with URL props from Server Component
  useEffect(() => {
    if (initialItemId && initialItemId !== itemId) {
      setItemId(initialItemId);
    }
  }, [initialItemId]);

  useEffect(() => {
    if (initialCategoryId !== undefined && initialCategoryId !== catId) {
      setCatId(initialCategoryId);
    }
  }, [initialCategoryId]);

  // WH role should stay on /dashboard; SC/AD navigate to /dashboard/pricing
  const basePath = role === "WH" ? "/dashboard" : "/dashboard/pricing";

  const handleItemChange = (newItemId: string) => {
    const idNum = Number(newItemId);
    setItemId(idNum);
    if (!idNum) return;
    const params = new URLSearchParams(globalThis.window?.location.search || "");
    if (catId) params.set("categoryId", String(catId));
    params.set("itemId", String(idNum));
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  };

  const handleCategoryChange = (newCatId: number | "") => {
    setCatId(newCatId);
    const params = new URLSearchParams(globalThis.window?.location.search || "");
    if (newCatId) params.set("categoryId", String(newCatId));
    else params.delete("categoryId");
    
    const itemsInCat = newCatId === "" ? items : items.filter(i => i.category_id === newCatId);
    const firstItemId = itemsInCat[0]?.id ?? 0;
    setItemId(firstItemId);
    if (firstItemId) params.set("itemId", String(firstItemId));
    else params.delete("itemId");
    
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  };



  const selectedItem = items.find(i => i.id === itemId);

  // ── All months in data ───────────────────────────────────────────
  const allMonths = useMemo(
    () => Array.from(new Set(priceEntries.map(pe => pe.month))).sort(),
    [priceEntries]
  );
  const visibleMonths = useMemo(() => allMonths.slice(-window), [allMonths, window]);
  const latestMonth = allMonths[allMonths.length - 1] ?? month ?? "";

  // ── Entries for selected item ────────────────────────────────────
  const itemEntries = useMemo(
    () => priceEntries.filter(pe => pe.item_id === itemId && visibleMonths.includes(pe.month)),
    [priceEntries, itemId, visibleMonths]
  );

  // Latest quote per supplier per month (dedup revisions)
  const latestBySupplierMonth = useMemo(() => {
    const map = new Map<string, PriceEntry>();
    for (const pe of priceEntries.filter(pe => pe.item_id === itemId)) {
      const key = `${pe.supplier_id}||${pe.month}`;
      const ex = map.get(key);
      if (!ex || pe.recorded_at > ex.recorded_at) map.set(key, pe);
    }
    return map;
  }, [priceEntries, itemId]);

  // Current month quotes (for pricing engine)
  const currentMonthQuotes = useMemo(() => {
    const m = month ?? latestMonth;
    const quotes = suppliers.map(s => {
      const entry = latestBySupplierMonth.get(`${s.id}||${m}`);
      return entry ? { supplierId: s.id, price: entry.price } : null;
    }).filter(Boolean) as { supplierId: number; price: number }[];
    if (quotes.length === 0) return null;
    const prices = quotes.map(q => q.price);

    const recomSupplierId = selectedItem?.recommended_supplier_id ?? null;
    const favQuote = recomSupplierId ? quotes.find(q => q.supplierId === recomSupplierId) : null;
    const buyFav = favQuote ? favQuote.price : null;

    return {
      quotes: quotes.length,
      buyMin: Math.min(...prices),
      buyMax: Math.max(...prices),
      buyAvg: prices.reduce((a, b) => a + b, 0) / prices.length,
      buyFav,
      recommendedSupplierId: recomSupplierId,
    };
  }, [latestBySupplierMonth, suppliers, month, latestMonth, selectedItem]);

  const existingSell = useMemo(() => {
    // First try salesCatalog (used when component is embedded in overview dashboard)
    if (salesCatalog && salesCatalog.length > 0) {
      const rec = salesCatalog.find(r => r.item_id === itemId);
      if (rec && rec.sell_min !== null) {
        return { strategy: rec.strategy || "avg", markup_type: rec.markup_type || "percent",
          markup_min: rec.markup_min || 0, markup_max: rec.markup_max || 0,
          sell_min: rec.sell_min, sell_max: rec.sell_max, created_at: rec.created_at || "",
          transportation: rec.transportation || 0, other_expenses: rec.other_expenses || 0,
          tier1_max: (rec as any).tier1_max, tier1_discount: (rec as any).tier1_discount,
          tier2_max: (rec as any).tier2_max, tier2_discount: (rec as any).tier2_discount,
          tier3_max: (rec as any).tier3_max, tier3_discount: (rec as any).tier3_discount,
          tier4_max: (rec as any).tier4_max, tier4_discount: (rec as any).tier4_discount };
      }
    }
    // Fallback: use itemSellHistory for the current month (pricing page path)
    const currentM = month ?? latestMonth;
    const hist = itemSellHistory.find(h => h.month === currentM);
    if (hist) {
      return { strategy: hist.strategy, markup_type: hist.markup_type,
        markup_min: hist.markup_min, markup_max: hist.markup_max,
        sell_min: hist.sell_min, sell_max: hist.sell_max, created_at: hist.created_at,
        transportation: hist.transport_override_enabled ? hist.transport_override_amount : 0,
        other_expenses: 0,
        tier1_max: hist.tier1_max, tier1_discount: hist.tier1_discount,
        tier2_max: hist.tier2_max, tier2_discount: hist.tier2_discount,
        tier3_max: hist.tier3_max, tier3_discount: hist.tier3_discount,
        tier4_max: hist.tier4_max, tier4_discount: hist.tier4_discount };
    }
    return null;
  }, [salesCatalog, itemSellHistory, itemId, month, latestMonth]);

  // ── Supplier stats for current latest month ──────────────────────
  const latestSupplierPrices = useMemo(() => {
    const m = month ?? latestMonth;
    return suppliers.map((s, si) => {
      const entry = latestBySupplierMonth.get(`${s.id}||${m}`);
      return { supplier: s, price: entry?.price ?? null, recordedAt: entry?.recorded_at ?? null, colorVal: COLORS[si % COLORS.length] };
    }).filter(r => r.price !== null) as { supplier: Supplier; price: number; recordedAt: string; colorVal: string }[];
  }, [latestBySupplierMonth, suppliers, month, latestMonth]);

  const cheapestPrice = latestSupplierPrices.length > 0 ? Math.min(...latestSupplierPrices.map(r => r.price)) : null;
  const avgCurrentPrice = latestSupplierPrices.length > 0 ? latestSupplierPrices.reduce((a, r) => a + r.price, 0) / latestSupplierPrices.length : null;

  // ── Matrix: suppliers × months (latest price per cell) ───────────
  const matrixMonths = useMemo(() => visibleMonths.slice().reverse(), [visibleMonths]); // newest first
  const minByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matrixMonths) {
      const prices = suppliers.map(s => latestBySupplierMonth.get(`${s.id}||${m}`)?.price).filter((p): p is number => p !== undefined);
      if (prices.length) map.set(m, Math.min(...prices));
    }
    return map;
  }, [matrixMonths, suppliers, latestBySupplierMonth]);

  // ── Chart (SVG price trend) ──────────────────────────────────────
  const W=560, H=200, PL=52, PR=16, PT=16, PB=32;
  const plotW = W-PL-PR, plotH = H-PT-PB;
  const chartPrices = itemEntries.map(e => e.price);
  const rawMin = chartPrices.length > 0 ? Math.min(...chartPrices) : 0;
  const rawMax = chartPrices.length > 0 ? Math.max(...chartPrices) : 100;
  const pad = (rawMax - rawMin) * 0.18 || 5;
  const yMin = Math.max(0, rawMin - pad), yMax = rawMax + pad, yRange = yMax - yMin || 1;
  const gX = (i: number) => visibleMonths.length <= 1 ? PL + plotW/2 : PL + (i / (visibleMonths.length - 1)) * plotW;
  const gY = (p: number) => PT + plotH - ((p - yMin) / yRange) * plotH;

  const supplierLines = useMemo(() => suppliers.map((sup, si) => {
    const c = COLORS[si % COLORS.length];
    const pts = visibleMonths.map((m, idx) => {
      const e = latestBySupplierMonth.get(`${sup.id}||${m}`);
      return e ? { x: gX(idx), y: gY(e.price), price: e.price, month: m, recordedAt: e.recorded_at } : null;
    }).filter(Boolean) as {x:number;y:number;price:number;month:string;recordedAt:string}[];
    const pathD = pts.length > 1 ? `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map(p => ` L ${p.x} ${p.y}`).join("") : "";
    return { sup, c, pts, pathD };
  }).filter(l => l.pts.length > 0), [suppliers, visibleMonths, latestBySupplierMonth]);

  const redirectTo    = `/dashboard/pricing?categoryId=${catId}&itemId=${itemId}&saved=1`;
  const errorRedirect = `/dashboard/pricing?categoryId=${catId}&itemId=${itemId}&error=pricing`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ═══ SECTION 1: SELECTOR BAR ══════════════════════════════════ */}
      <div style={{
        display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap",
        padding: "16px 20px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
      }}>
        {/* Category */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 160px", minWidth: "140px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{t("idash.category")}</span>
          <select
            value={catId}
            onChange={e => handleCategoryChange(e.target.value === "" ? "" : Number(e.target.value))}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Item */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "3 1 200px", minWidth: "160px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{t("idash.item")}</span>
          <ItemCombobox
            items={filteredItems.map((item) => {
              const targetMonth = month ?? latestMonth;
              const hasWH = priceEntries.some(pe => pe.item_id === item.id && pe.month === targetMonth && pe.status !== 'rejected');
              const isPub = salesCatalog.some(row => row.item_id === item.id && row.sell_min !== null);
              const isRej = priceEntries.some(pe => pe.item_id === item.id && pe.month === targetMonth && pe.status === 'rejected');

              let isPublishedOption = true;
              let badge: string | undefined = undefined;
              let badgeVariant: "empty" | "partial" | "complete" | "rejected" | undefined = undefined;

              if (isPub) {
                badge = isAr ? "منشور" : "Published";
                badgeVariant = "complete";
              } else if (hasWH) {
                badge = isAr ? "مستلم من WH" : "WH Submitted";
                badgeVariant = "partial";
              } else if (isRej) {
                badge = isAr ? "مرفوض" : "Rejected";
                badgeVariant = "rejected";
                isPublishedOption = false;
              } else {
                isPublishedOption = false;
              }

              return {
                id: item.id,
                label: item.name,
                unit: item.unit,
                category: categories.find(c => c.id === item.category_id)?.name,
                isPublished: isPublishedOption,
                badge,
                badgeVariant,
              };
            })}
            value={String(itemId)}
            onChange={handleItemChange}
            placeholder={isAr ? "— اختر الصنف —" : "— Select an item —"}
            disabled={filteredItems.length === 0}
          />
        </div>

        {/* Window */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{t("idash.history")}</span>
          <div style={{ display: "flex", gap: "3px", background: "var(--bg-elevated)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
            {([3, 6, 12] as const).map(w => (
              <button key={w} type="button" onClick={() => setWindow(w)}
                style={{
                  padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "6px",
                  border: "none", cursor: "pointer",
                  background: window === w ? "var(--primary)" : "transparent",
                  color: window === w ? "#fff" : "var(--text-muted)",
                  transition: "all 150ms",
                }}>{isAr ? `${w} أشهر` : `${w}M`}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SECTION 2: SC TWO-COLUMN WORKSTATION / NON-SC GRID ══════ */}
      {itemId === 0 ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
          background: "var(--bg-surface)",
          border: "1.5px dashed var(--border-medium)",
          borderRadius: "var(--radius-lg)",
          textAlign: "center",
          gap: "16px",
          boxShadow: "var(--shadow-sm)",
          marginTop: "8px",
        }}>
          <div style={{ fontSize: "48px" }}>📊</div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>
            {isAr ? "الرجاء اختيار صنف للبدء" : "Please Select an Item"}
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", maxWidth: "420px", lineHeight: 1.6 }}>
            {isAr 
              ? "اختر صنفًا من القائمة المنسدلة أعلاه لمشاهدة سجل أسعار البيع، وعروض الأسعار الحالية للموردين، وتعديل استراتيجيات التسعير."
              : "Choose an item from the dropdown above to inspect sell price history, current supplier quotes, and configure pricing strategies."}
          </p>
        </div>
      ) : (
        <>
          {role === "SC" ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(380px, 1.5fr)",
          gap: "16px",
          alignItems: "start",
        }}>

          {/* ── LEFT: history → buy prices → trend chart ────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── Sell Price History (last 3 months) ─────────────────── */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 18px", boxShadow: "var(--shadow-sm)" }}>
              <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", margin: "0 0 12px" }}>
                📋 {isAr ? "سجل أسعار البيع" : "Sell Price History"}
              </p>
              {itemSellHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                  {isAr ? "لم يتم نشر أسعار بيع لهذا الصنف بعد." : "No selling prices published yet for this item."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {itemSellHistory.map((h) => {
                    const isCurrentMonth = h.month === (month ?? latestMonth);
                    const strategyColor = h.strategy === "min" ? "var(--success)" : h.strategy === "max" ? "var(--danger)" : "var(--primary)";
                    const fmtMu = (v: number) => parseFloat(v.toFixed(2));
                    const markupLabel = h.markup_type === "divisor"
                      ? (h.markup_min === h.markup_max ? `÷ ${fmtMu(h.markup_min)}` : `÷ ${fmtMu(h.markup_min)}–${fmtMu(h.markup_max)}`)
                      : (h.markup_min === h.markup_max ? `+${fmtMu(h.markup_min)}%` : `+${fmtMu(h.markup_min)}–${fmtMu(h.markup_max)}%`);
                    return (
                      <div key={h.month} style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto auto",
                        alignItems: "center",
                        gap: "10px",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        background: isCurrentMonth ? "rgba(99,102,241,0.07)" : "var(--bg-elevated)",
                        border: `1.5px solid ${isCurrentMonth ? "rgba(99,102,241,0.28)" : "var(--border-light)"}`,
                      }}>
                        {/* Month */}
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 800, color: isCurrentMonth ? "var(--primary)" : "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {formatMonthLabel(h.month)}
                            {isCurrentMonth && <span style={{ marginInlineStart: "5px", fontSize: "8px", fontWeight: 900, background: "var(--primary)", color: "#fff", padding: "1px 5px", borderRadius: "4px", verticalAlign: "middle" }}>{isAr ? "الآن" : "NOW"}</span>}
                          </div>
                        </div>
                        {/* Markup */}
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {markupLabel}
                        </div>
                        {/* Strategy */}
                        <div style={{
                          fontSize: "10px", fontWeight: 900, padding: "2px 7px", borderRadius: "5px",
                          background: `color-mix(in srgb, ${strategyColor} 12%, transparent)`,
                          color: strategyColor,
                          border: `1px solid color-mix(in srgb, ${strategyColor} 30%, transparent)`,
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}>
                          {h.strategy}
                        </div>
                        {/* Sell range */}
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--success)" }}>{formatCurrency(h.sell_min)}</span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", margin: "0 3px" }}>–</span>
                          <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--primary)" }}>{formatCurrency(h.sell_max)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Current month supplier price cards ─────────────────── */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", marginBottom: "2px" }}>
                    {formatMonthLabel(month ?? latestMonth)} · {t("idash.currentPrices")}
                  </p>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                    {selectedItem ? (
                      <span
                        onClick={() => globalThis.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: selectedItem.id } }))}
                        className="clickable-detail-trigger"
                      >
                        {selectedItem.name}
                      </span>
                    ) : (isAr ? "اختر صنفًا" : "Select an item")}
                  </h2>
                </div>
                {cheapestPrice !== null && avgCurrentPrice !== null && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{t("idash.marketAvg")}</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--primary)" }}>{formatCurrency(avgCurrentPrice)}</div>
                  </div>
                )}
              </div>

              {latestSupplierPrices.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                  {isAr ? `لم يتم تسجيل أي أسعار لشهر ${formatMonthLabel(month ?? latestMonth)} بعد.` : `No prices recorded for ${formatMonthLabel(month ?? latestMonth)} yet.`}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[...latestSupplierPrices].sort((a, b) => a.price - b.price).map((row) => {
                    const isBest = row.price === cheapestPrice;
                    const isRecommended = selectedItem?.recommended_supplier_id === row.supplier.id;
                    const diffPct = avgCurrentPrice ? ((row.price - avgCurrentPrice) / avgCurrentPrice * 100) : 0;
                    return (
                      <div key={row.supplier.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "var(--radius)", background: isBest ? "var(--info-light)" : isRecommended ? "rgba(234,179,8,0.06)" : "var(--bg-elevated)", border: `1.5px solid ${isBest ? "rgba(2,132,199,0.35)" : isRecommended ? "rgba(234,179,8,0.35)" : "var(--border-light)"}`, transition: "all 150ms" }}>
                        <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: row.colorVal, flexShrink: 0 }} />
                        <span
                          onClick={() => globalThis.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: row.supplier.id } }))}
                          className="clickable-detail-trigger"
                          style={{ flex: 1, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {row.supplier.fame_name || row.supplier.name}
                        </span>
                        {isRecommended && <span style={{ color: "var(--warning)", cursor: "help", flexShrink: 0 }} title={isAr ? "المورد الموصى به" : "Recommended Supplier"}>⭐</span>}
                        {isBest && <span style={{ fontSize: "9px", fontWeight: 800, background: "var(--info)", color: "#fff", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 }}>{t("idash.best")}</span>}
                        <span style={{ fontSize: "10px", fontWeight: 700, color: diffPct < -0.5 ? "var(--success)" : diffPct > 0.5 ? "var(--danger)" : "var(--text-muted)", flexShrink: 0 }}>
                          {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                        </span>
                        <strong style={{ fontSize: "15px", fontWeight: 800, color: isBest ? "var(--info)" : "var(--text-primary)", flexShrink: 0 }}>
                          {formatCurrency(row.price)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Warning: no recommended supplier */}
              {selectedItem && !selectedItem.recommended_supplier_id && latestSupplierPrices.length > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 14px", borderRadius: "8px", marginTop: "10px",
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                  fontSize: "11.5px", color: "#92400e", fontWeight: 600,
                }}>
                  <span style={{ fontSize: "14px" }}>⚠️</span>
                  <span>{isAr ? "لم يتم تحديد مورد موصى به لهذا الصنف. يرجى تعيينه من الإدارة ← الأصناف." : "No recommended supplier set for this item. Please set one via Admin → Items & Categories."}</span>
                </div>
              )}

              {/* Published sell price status */}
              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {existingSell ? (
                  <>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t("idash.publishedSell")}</span>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--success)" }}>{formatCurrency(existingSell.sell_min)}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>–</span>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)" }}>{formatCurrency(existingSell.sell_max)}</span>
                    <span className="badge badge-success" style={{ fontSize: "10px" }}>✓ {isAr ? "منشور" : "Published"}</span>
                    <span className="badge badge-strong" style={{ fontSize: "10px" }}>{existingSell.strategy.toUpperCase()}</span>
                  </>
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    {t("idash.noSellSet")}
                  </span>
                )}
              </div>
            </div>

            {/* Price trend chart */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", margin: 0 }}>
                    {t("idash.priceTrend")} · {window} {t("idash.months")}
                  </p>
                  {selectedItem && (
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                      {selectedItem.name}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {supplierLines.map(l => (
                    <span key={l.sup.id} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: l.c, display: "inline-block" }} />
                      {l.sup.fame_name || l.sup.name}
                    </span>
                  ))}
                </div>
              </div>

              {supplierLines.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "180px", border: "1px dashed var(--border-light)", borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: "12px" }}>
                  No data for this period
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
                    {[0, 0.5, 1].map((r, i) => {
                      const y = PT + plotH - r * plotH;
                      return (
                        <g key={i}>
                          <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--border-light)" strokeDasharray="4 3" strokeWidth={1} />
                          <text x={PL-6} y={y+4} fill="var(--text-muted)" fontSize="9.5" textAnchor="end" fontWeight="600">
                            {formatCurrency(yMin + r * yRange)}
                          </text>
                        </g>
                      );
                    })}
                    {visibleMonths.map((m, i) => (
                      <text key={m} x={gX(i)} y={H-6} fill="var(--text-muted)" fontSize="9" textAnchor="middle" fontWeight="600">
                        {m.slice(2).replace("-", "/")}
                      </text>
                    ))}
                    {supplierLines.map(l => (
                      <g key={l.sup.id}>
                        {l.pathD && <path d={l.pathD} fill="none" stroke={l.c} strokeWidth={2} strokeLinejoin="round" opacity={0.85} />}
                        {l.pts.map((pt, pi) => (
                          <circle key={pi} cx={pt.x} cy={pt.y} r={4} fill={l.c} stroke="var(--bg-surface)" strokeWidth={1.5}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHoveredDot({ x: pt.x, y: pt.y, price: pt.price, month: pt.month, supplier: l.sup.fame_name || l.sup.name })}
                            onMouseLeave={() => setHoveredDot(null)}
                          />
                        ))}
                      </g>
                    ))}
                  </svg>
                  {hoveredDot && (
                    <div style={{ position: "absolute", left: `${(hoveredDot.x / W) * 100}%`, top: `${(hoveredDot.y / H) * 100}%`, transform: "translate(-50%, -120%)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: 700, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "var(--shadow-md)", zIndex: 10 }}>
                      <div style={{ color: "var(--text-muted)", fontWeight: 500 }}>{hoveredDot.supplier} · {hoveredDot.month}</div>
                      <div style={{ color: "var(--primary)", fontSize: "13px" }}>{formatCurrency(hoveredDot.price)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Pricing Engine ─────── */}
          <div style={{
            background: "var(--bg-surface)",
            border: "1.5px solid rgba(99,102,241,0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "20px",
            boxShadow: "0 4px 24px rgba(99,102,241,0.10), var(--shadow-sm)",
            position: "sticky" as const,
            top: "16px",
            maxHeight: "calc(100vh - 100px)",
            overflowY: "auto" as const,
          }}>
            <div style={{ marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ minWidth: 0 }}>
                <p className="eyebrow" style={{ margin: 0, fontSize: "9px" }}>⚙️ Pricing Engine</p>
                <h3 style={{ margin: "4px 0 2px", fontSize: "15px", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedItem?.name ?? "Select an item"}
                </h3>
              </div>
            </div>

            {error === "pricing" && (
              <div className="restriction-info-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)", marginBottom: "16px" }}>
                <strong>Error:</strong> Max markup must be ≥ min markup.
              </div>
            )}

            {currentMonthQuotes ? (
              <PricingCalculator
                month={month ?? ""}
                itemId={itemId}
                createdBy={username ?? "SC Manager"}
                buyMin={currentMonthQuotes.buyMin}
                buyMax={currentMonthQuotes.buyMax}
                buyAvg={currentMonthQuotes.buyAvg}
                buyFav={currentMonthQuotes.buyFav ?? undefined}
                recommendedSupplierId={currentMonthQuotes.recommendedSupplierId}
                floorPct={floorPct}
                history={priceHistory}
                existing={existingSell}
                redirectTo={redirectTo}
                errorRedirect={errorRedirect}
                transportation={selectedItem?.transportation_per_unit ?? 0}
                moq={selectedItem?.moq ?? 0}
                isTiered={selectedItem?.is_tiered === 1}
                tier1Max={selectedItem?.tier1_max}
                tier1Discount={selectedItem?.tier1_discount}
                tier2Max={selectedItem?.tier2_max}
                tier2Discount={selectedItem?.tier2_discount}
                tier3Discount={selectedItem?.tier3_discount}
                tier3Max={selectedItem?.tier3_max}
                tier4Discount={selectedItem?.tier4_discount}
                scTransportOverrideEnabled={scTransportOverrideEnabled}
                tierEnabled={tierEnabled}
                onSuccess={() => router.refresh()}
                priceEntries={priceEntries}
                suppliers={suppliers}
              />
            ) : (
              <div className="restriction-info-banner" style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.35)", color: "#b45309" }}>
                <strong>{isAr ? "لا توجد عروض أسعار من الموردين بعد." : "No supplier quotes yet."}</strong> {isAr ? `يجب على المشتريات تسجيل أسعار لـ` : `WH needs to record prices for `} <em>{selectedItem?.name}</em> {isAr ? `في شهر ${formatMonthLabel(month ?? latestMonth)} قبل أن يتمكن من تحديد سعر البيع.` : `in ${formatMonthLabel(month ?? latestMonth)} before a selling price can be set.`}
              </div>
            )}
          </div>
        </div>

      ) : (

        /* ── Non-SC: original 2-column grid ──────── */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", marginBottom: "2px" }}>
                  {formatMonthLabel(month ?? latestMonth)} · {t("idash.currentPrices")}
                </p>
                <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                  {selectedItem?.name ?? (isAr ? "اختر صنفًا" : "Select an item")}
                </h2>
              </div>
              {cheapestPrice !== null && avgCurrentPrice !== null && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{t("idash.marketAvg")}</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--primary)" }}>{formatCurrency(avgCurrentPrice)}</div>
                </div>
              )}
            </div>
            {latestSupplierPrices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                {isAr ? `لم يتم تسجيل أسعار لشهر ${formatMonthLabel(month ?? latestMonth)} بعد.` : `No prices recorded for ${formatMonthLabel(month ?? latestMonth)} yet.`}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[...latestSupplierPrices].sort((a, b) => a.price - b.price).map((row) => {
                  const isBest = row.price === cheapestPrice;
                  const isRecommended = selectedItem?.recommended_supplier_id === row.supplier.id;
                  const diffPct = avgCurrentPrice ? ((row.price - avgCurrentPrice) / avgCurrentPrice * 100) : 0;
                  return (
                    <div key={row.supplier.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "var(--radius)", background: isBest ? "var(--info-light)" : isRecommended ? "rgba(234,179,8,0.06)" : "var(--bg-elevated)", border: `1.5px solid ${isBest ? "rgba(2,132,199,0.35)" : isRecommended ? "rgba(234,179,8,0.35)" : "var(--border-light)"}`, transition: "all 150ms" }}>
                      <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: row.colorVal, flexShrink: 0 }} />
                      <span
                        onClick={() => globalThis.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: row.supplier.id } }))}
                        className="clickable-detail-trigger"
                        style={{ flex: 1, fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {row.supplier.fame_name || row.supplier.name}
                      </span>
                      {isRecommended && <span style={{ color: "var(--warning)", cursor: "help", flexShrink: 0 }} title={isAr ? "المورد الموصى به" : "Recommended Supplier"}>⭐</span>}
                      {isBest && <span style={{ fontSize: "9px", fontWeight: 800, background: "var(--info)", color: "#fff", padding: "2px 6px", borderRadius: "4px" }}>{t("idash.best")}</span>}
                      <span style={{ fontSize: "10px", fontWeight: 700, color: diffPct < -0.5 ? "var(--success)" : diffPct > 0.5 ? "var(--danger)" : "var(--text-muted)" }}>
                        {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                      </span>
                      <strong style={{ fontSize: "15px", fontWeight: 800, color: isBest ? "var(--info)" : "var(--text-primary)" }}>{formatCurrency(row.price)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", margin: 0 }}>
                  {t("idash.priceTrend")} · {window} {t("idash.months")}
                </p>
                {selectedItem && (
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                    {selectedItem.name}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {supplierLines.map(l => (
                  <span key={l.sup.id} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: l.c, display: "inline-block" }} />
                    {l.sup.fame_name || l.sup.name}
                  </span>
                ))}
              </div>
            </div>
            {supplierLines.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "180px", border: "1px dashed var(--border-light)", borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: "12px" }}>
                No data for this period
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
                  {[0, 0.5, 1].map((r, i) => {
                    const y = PT + plotH - r * plotH;
                    return (
                      <g key={i}>
                        <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--border-light)" strokeDasharray="4 3" strokeWidth={1} />
                        <text x={PL-6} y={y+4} fill="var(--text-muted)" fontSize="9.5" textAnchor="end" fontWeight="600">{formatCurrency(yMin + r * yRange)}</text>
                      </g>
                    );
                  })}
                  {visibleMonths.map((m, i) => (
                    <text key={m} x={gX(i)} y={H-6} fill="var(--text-muted)" fontSize="9" textAnchor="middle" fontWeight="600">{m.slice(2).replace("-", "/")}</text>
                  ))}
                  {supplierLines.map(l => (
                    <g key={l.sup.id}>
                      {l.pathD && <path d={l.pathD} fill="none" stroke={l.c} strokeWidth={2} strokeLinejoin="round" opacity={0.85} />}
                      {l.pts.map((pt, pi) => (
                        <circle key={pi} cx={pt.x} cy={pt.y} r={4} fill={l.c} stroke="var(--bg-surface)" strokeWidth={1.5}
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setHoveredDot({ x: pt.x, y: pt.y, price: pt.price, month: pt.month, supplier: l.sup.fame_name || l.sup.name })}
                          onMouseLeave={() => setHoveredDot(null)}
                        />
                      ))}
                    </g>
                  ))}
                </svg>
                {hoveredDot && (
                  <div style={{ position: "absolute", left: `${(hoveredDot.x / W) * 100}%`, top: `${(hoveredDot.y / H) * 100}%`, transform: "translate(-50%, -120%)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: 700, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "var(--shadow-md)", zIndex: 10 }}>
                    <div style={{ color: "var(--text-muted)", fontWeight: 500 }}>{hoveredDot.supplier} · {hoveredDot.month}</div>
                    <div style={{ color: "var(--primary)", fontSize: "13px" }}>{formatCurrency(hoveredDot.price)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
          )}

      {/* ═══ SECTION 3: SUPPLIER × MONTH COMPARISON ══════════════════ */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", margin: 0 }}>
                {t("idash.comparison")}
              </p>
              {selectedItem && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", background: "var(--primary-light)", border: "1px solid var(--border-accent)", fontSize: "11px", fontWeight: 700, color: "var(--primary)", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)", flexShrink: 0, display: "inline-block" }} />
                  {selectedItem.name}
                </span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{t("idash.comparisonDesc")}</p>
          </div>
          <span className="badge badge-strong">{isAr ? `${matrixMonths.length} أشهر` : `${matrixMonths.length} months`}</span>
        </div>

        <div style={{ overflowX: "auto", maxHeight: "380px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                <th style={{ padding: "10px 16px", textAlign: isAr ? "right" : "left", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", position: "sticky", top: 0, [isAr ? "right" : "left"]: 0, background: "var(--bg-elevated)", zIndex: 3, whiteSpace: "nowrap", boxShadow: `${isAr ? "-1px" : "1px"} 0 0 var(--border-light), 0 1px 0 var(--border)` }}>{isAr ? "المورد" : "Supplier"}</th>
                {matrixMonths.map((m, i) => (
                  <th key={m} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: "11px", color: i === 0 ? "var(--primary)" : "var(--text-muted)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>
                    {formatMonthLabel(m)}
                    {i === 0 && <span style={{ display: "block", fontSize: "8px", color: "var(--primary)", fontWeight: 800 }}>{isAr ? "الأحدث" : "LATEST"}</span>}
                  </th>
                ))}
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>{isAr ? "المتوسط" : "Avg"}</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>{isAr ? "الاتجاه" : "Trend"}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((sup, si) => {
                const supColor = COLORS[si % COLORS.length];
                const chronoPrices = visibleMonths.map(m => latestBySupplierMonth.get(`${sup.id}||${m}`)?.price).filter((p): p is number => p !== undefined);
                const avg = chronoPrices.length > 0 ? chronoPrices.reduce((a, b) => a + b, 0) / chronoPrices.length : null;
                const first = chronoPrices[0], last = chronoPrices[chronoPrices.length - 1];
                const trendPct = first && last && chronoPrices.length >= 2 ? ((last - first) / first) * 100 : null;
                if (chronoPrices.length === 0) return null;
                return (
                  <tr key={sup.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 16px", position: "sticky", [isAr ? "right" : "left"]: 0, background: "var(--bg-surface)", zIndex: 1, boxShadow: `${isAr ? "-1px" : "1px"} 0 0 var(--border-light)`, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: supColor, flexShrink: 0 }} />
                        <span
                          onClick={() => globalThis.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: sup.id } }))}
                          className="clickable-detail-trigger"
                          style={{ fontWeight: 700, fontSize: "13px" }}
                        >
                          {sup.fame_name || sup.name}
                        </span>
                        {selectedItem?.recommended_supplier_id === sup.id && <span style={{ color: "#eab308", fontSize: "12px", cursor: "help", flexShrink: 0 }} title={isAr ? "المورد الموصى به" : "Recommended Supplier"}>⭐</span>}
                      </div>
                    </td>
                    {matrixMonths.map((m, mi) => {
                      const entry = latestBySupplierMonth.get(`${sup.id}||${m}`);
                      const isBest = entry && entry.price === minByMonth.get(m);
                      return (
                        <td key={m} style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap", fontWeight: isBest ? 800 : 400, color: isBest ? "var(--info)" : entry ? "var(--text-primary)" : "var(--text-dim)", background: isBest ? "rgba(2,132,199,0.08)" : mi === 0 ? "rgba(99,102,241,0.03)" : "transparent" }}>
                          {entry ? formatCurrency(entry.price) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                      {avg !== null ? formatCurrency(avg) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, fontSize: "12px", color: trendPct === null ? "var(--text-dim)" : trendPct > 1 ? "var(--danger)" : trendPct < -1 ? "var(--success)" : "var(--text-muted)" }}>
                      {trendPct === null ? "—" : trendPct > 1 ? `↑ ${trendPct.toFixed(1)}%` : trendPct < -1 ? `↓ ${Math.abs(trendPct).toFixed(1)}%` : (isAr ? "≈ مستقر" : "≈ stable")}
                    </td>
                  </tr>
                );
              })}

              {/* Market avg footer */}
              <tr style={{ background: "var(--bg-elevated)", borderTop: "2px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", position: "sticky", [isAr ? "right" : "left"]: 0, background: "var(--bg-elevated)", zIndex: 1, fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", boxShadow: `${isAr ? "-1px" : "1px"} 0 0 var(--border-light)` }}>{isAr ? "متوسط السوق" : "Market Avg"}</td>
                {matrixMonths.map((m) => {
                  const prices = suppliers.map(s => latestBySupplierMonth.get(`${s.id}||${m}`)?.price).filter((p): p is number => p !== undefined);
                  const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
                  return (
                    <td key={m} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: "12px", color: "var(--primary)" }}>
                      {avg !== null ? formatCurrency(avg) : "—"}
                    </td>
                  );
                })}
                <td colSpan={2} />
              </tr>

              {/* SC: selling price row */}
              {role === "SC" && salesCatalog && (
                <tr style={{ background: "rgba(245,158,11,0.05)", borderTop: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 16px", position: "sticky", [isAr ? "right" : "left"]: 0, background: "rgba(245,158,11,0.05)", zIndex: 1, fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--warning)", boxShadow: `${isAr ? "-1px" : "1px"} 0 0 var(--border-light)` }}>{isAr ? "نطاق البيع" : "Sell Range"}</td>
                  {matrixMonths.map((m) => {
                    const sell = salesCatalog.find(r => r.item_id === itemId && r.month === m);
                    return (
                      <td key={m} style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {sell && sell.sell_min !== null ? (
                          <span style={{ fontSize: "11px" }}>
                            <span style={{ fontWeight: 700, color: "var(--success)" }}>{formatCurrency(sell.sell_min)}</span>
                            <span style={{ color: "var(--text-muted)", margin: "0 3px" }}>–</span>
                            <span style={{ fontWeight: 700, color: "var(--primary)" }}>{formatCurrency(sell.sell_max)}</span>
                          </span>
                        ) : <span style={{ color: "var(--text-dim)", fontSize: "11px" }}>—</span>}
                      </td>
                    );
                  })}
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}


    </div>
  );
}
