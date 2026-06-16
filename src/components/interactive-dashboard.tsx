"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import PricingCalculator from "@/components/pricing-calculator";
import CategoryMarkupPanel from "@/components/category-markup-panel";
import { useI18n } from "@/lib/i18n-context";
import type { SellingPriceHistoryRow } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────
type Category  = { id: number; name: string; description: string | null };
type Item      = { id: number; category_id: number; name: string; unit: string; description: string | null; active: number; transportation_per_unit?: number; moq?: number; is_tiered?: number; tier1_max?: number; tier1_discount?: number; tier2_max?: number; tier2_discount?: number; tier3_max?: number; tier3_discount?: number; tier4_max?: number; tier4_discount?: number };
type Supplier  = { id: number; name: string; fame_name?: string | null; contact_person: string | null; phone: string | null };
type PriceEntry = {
  id: number; item_id: number; supplier_id: number; month: string; price: number;
  recorded_at: string; item_name: string; unit: string; supplier_name: string;
  category_name: string; category_id: number;
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
};

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

// ── Small helpers ─────────────────────────────────────────────────────────────
function color(supplierId: number, suppliers: Supplier[]) {
  const idx = suppliers.findIndex(s => s.id === supplierId);
  return COLORS[idx >= 0 ? idx % COLORS.length : 0];
}

export default function InteractiveDashboard({
  categories, items, suppliers, priceEntries,
  role, month, salesCatalog, username,
  initialCategoryId, initialItemId, saved, error,
  floorPct = null,
  priceHistory = [],
}: Props) {
  const { t } = useI18n();
  const router = useRouter();

  // ── Selection state ──────────────────────────────────────────────
  const [catId, setCatId] = useState<number | "">(
    initialCategoryId ?? (categories[0]?.id ?? "")
  );
  const [itemId, setItemId] = useState<number>(initialItemId ?? 0);
  const [window, setWindow] = useState<3|6|12>(6);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [pricingTab, setPricingTab] = useState<"item" | "category">("item");
  const [hoveredDot, setHoveredDot] = useState<{x:number;y:number;price:number;month:string;supplier:string}|null>(null);

  const filteredItems = useMemo(
    () => catId === "" ? items : items.filter(i => i.category_id === catId),
    [catId, items]
  );

  // Auto-select first item when category changes or on init
  useEffect(() => {
    if (filteredItems.length === 0) return;
    const valid = filteredItems.some(i => i.id === itemId);
    if (!valid || itemId === 0) setItemId(filteredItems[0].id);
  }, [catId, filteredItems]);

  useEffect(() => { if (error === "pricing") { setPricingTab("item"); setIsPricingOpen(true); } }, [error]);

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
    return {
      quotes: quotes.length,
      buyMin: Math.min(...prices),
      buyMax: Math.max(...prices),
      buyAvg: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
  }, [latestBySupplierMonth, suppliers, month, latestMonth]);

  const existingSell = useMemo(() => {
    if (!salesCatalog) return null;
    const rec = salesCatalog.find(r => r.item_id === itemId);
    if (!rec || rec.sell_min === null) return null;
    return { strategy: rec.strategy || "avg", markup_type: rec.markup_type || "percent",
      markup_min: rec.markup_min || 0, markup_max: rec.markup_max || 0,
      sell_min: rec.sell_min, sell_max: rec.sell_max, created_at: rec.created_at || "",
      transportation: rec.transportation || 0, other_expenses: rec.other_expenses || 0 };
  }, [salesCatalog, itemId]);

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

  const redirectTo = `/dashboard?categoryId=${catId}&itemId=${itemId}&saved=1`;
  const errorRedirect = `/dashboard?categoryId=${catId}&itemId=${itemId}&error=pricing`;

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
            onChange={e => setCatId(e.target.value === "" ? "" : Number(e.target.value))}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Item */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "3 1 200px", minWidth: "160px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{t("idash.item")}</span>
          <select
            value={itemId}
            onChange={e => setItemId(Number(e.target.value))}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            {filteredItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
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
                }}>{w}M</button>
            ))}
          </div>
        </div>

        {/* SC: Pricing Engine */}
        {role === "SC" && (
          <button type="button" onClick={() => { setPricingTab("item"); setIsPricingOpen(true); }}
            className="button button-primary"
            style={{ padding: "9px 18px", fontSize: "13px", gap: "6px", marginLeft: "auto", whiteSpace: "nowrap" }}>
            ⚙️ Pricing Engine
          </button>
        )}
      </div>

      {/* ═══ SECTION 2: CURRENT MONTH SNAPSHOT ═══════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Left: supplier price cards for current month */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div>
              <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", marginBottom: "2px" }}>
                {formatMonthLabel(month ?? latestMonth)} · {t("idash.currentPrices")}
              </p>
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                {selectedItem?.name ?? "Select an item"}
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
              No prices recorded for {formatMonthLabel(month ?? latestMonth)} yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[...latestSupplierPrices].sort((a, b) => a.price - b.price).map((row, i) => {
                const isBest = row.price === cheapestPrice;
                const diffPct = avgCurrentPrice ? ((row.price - avgCurrentPrice) / avgCurrentPrice * 100) : 0;
                return (
                  <div key={row.supplier.id} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "10px 14px", borderRadius: "var(--radius)",
                    background: isBest ? "var(--info-light)" : "var(--bg-elevated)",
                    border: `1.5px solid ${isBest ? "rgba(2,132,199,0.35)" : "var(--border-light)"}`,
                    transition: "all 150ms",
                  }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: row.colorVal, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.supplier.fame_name || row.supplier.name}
                    </span>
                    {isBest && (
                      <span style={{ fontSize: "9px", fontWeight: 800, background: "var(--info)", color: "#fff", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 }}>{t("idash.best")}</span>
                    )}
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

          {/* SC selling price status */}
          {role === "SC" && (
            <div style={{
              marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-light)",
              display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
            }}>
              {existingSell ? (
                <>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t("idash.publishedSell")}</span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--success)" }}>{formatCurrency(existingSell.sell_min)}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>–</span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)" }}>{formatCurrency(existingSell.sell_max)}</span>
                  <span className="badge badge-success" style={{ fontSize: "10px" }}>✓ Published</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t("idash.noSellSet")}</span>
                  <button type="button" onClick={() => setIsPricingOpen(true)}
                    className="button button-primary"
                    style={{ padding: "5px 12px", fontSize: "11px", marginLeft: "auto" }}>
                    {t("idash.setNow")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: price trend chart */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)",
        }}>
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
                  {l.sup.name}
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
                {/* Y grid */}
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
                {/* X labels */}
                {visibleMonths.map((m, i) => (
                  <text key={i} x={gX(i)} y={H-6} fill="var(--text-secondary)" fontSize="10" textAnchor="middle" fontWeight="700">
                    {m.slice(5)}
                  </text>
                ))}
                {/* Lines */}
                {supplierLines.map(l => (
                  <g key={l.sup.id}>
                    {l.pts.length > 1 && <path d={l.pathD} fill="none" stroke={l.c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
                    {l.pts.map((pt, pi) => (
                      <circle key={pi} cx={pt.x} cy={pt.y} r={4.5} fill={l.c} stroke="var(--bg-surface)" strokeWidth={2}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoveredDot({ x: pt.x, y: pt.y, price: pt.price, month: pt.month, supplier: l.sup.name })}
                        onMouseLeave={() => setHoveredDot(null)}
                      />
                    ))}
                  </g>
                ))}
              </svg>
              {hoveredDot && (
                <div style={{
                  position: "absolute",
                  left: `calc(${(hoveredDot.x / W) * 100}% - 80px)`,
                  top: `calc(${(hoveredDot.y / H) * 100}% - 80px)`,
                  padding: "8px 12px", background: "var(--bg-surface)",
                  border: "1px solid var(--border-medium)", borderRadius: "8px",
                  boxShadow: "var(--shadow-md)", pointerEvents: "none", zIndex: 10,
                  display: "flex", flexDirection: "column", gap: "2px",
                }}>
                  <strong style={{ fontSize: "14px", color: "var(--primary)" }}>{formatCurrency(hoveredDot.price)}</strong>
                  <span style={{ fontSize: "11px", fontWeight: 700 }}>{hoveredDot.supplier}</span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{formatMonthLabel(hoveredDot.month)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SECTION 3: COMPARISON MATRIX ════════════════════════════ */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2px", flexWrap: "wrap" }}>
              <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", margin: 0 }}>
                {t("idash.comparison")}
              </p>
              {selectedItem && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  padding: "3px 10px", borderRadius: "20px",
                  background: "var(--primary-light)",
                  border: "1px solid var(--border-accent)",
                  fontSize: "11px", fontWeight: 700, color: "var(--primary)",
                  maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)", flexShrink: 0, display: "inline-block" }} />
                  {selectedItem.name}
                </span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              {t("idash.comparisonDesc")}
            </p>
          </div>
          <span className="badge badge-strong">{matrixMonths.length} months</span>
        </div>

        <div style={{ overflowX: "auto", maxHeight: "380px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", position: "sticky", top: 0, left: 0, background: "var(--bg-elevated)", zIndex: 3, whiteSpace: "nowrap", boxShadow: "1px 0 0 var(--border-light), 0 1px 0 var(--border)" }}>
                  Supplier
                </th>
                {matrixMonths.map((m, i) => (
                  <th key={m} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: "11px", color: i === 0 ? "var(--primary)" : "var(--text-muted)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>
                    {formatMonthLabel(m)}
                    {i === 0 && <span style={{ display: "block", fontSize: "8px", color: "var(--primary)", fontWeight: 800 }}>LATEST</span>}
                  </th>
                ))}
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>
                  Avg
                </th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((sup, si) => {
                const supColor = COLORS[si % COLORS.length];
                // Prices in chronological order for trend
                const chronoPrices = visibleMonths
                  .map(m => latestBySupplierMonth.get(`${sup.id}||${m}`)?.price)
                  .filter((p): p is number => p !== undefined);
                const avg = chronoPrices.length > 0 ? chronoPrices.reduce((a, b) => a + b, 0) / chronoPrices.length : null;
                const first = chronoPrices[0], last = chronoPrices[chronoPrices.length - 1];
                const trendPct = first && last && chronoPrices.length >= 2 ? ((last - first) / first) * 100 : null;

                // Skip suppliers with no data for this item
                if (chronoPrices.length === 0) return null;

                return (
                  <tr key={sup.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 16px", position: "sticky", left: 0, background: "var(--bg-surface)", zIndex: 1, boxShadow: "1px 0 0 var(--border-light)", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: supColor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: "13px" }}>{sup.name}</span>
                      </div>
                    </td>
                    {matrixMonths.map((m, mi) => {
                      const entry = latestBySupplierMonth.get(`${sup.id}||${m}`);
                      const isBest = entry && entry.price === minByMonth.get(m);
                      return (
                        <td key={m} style={{
                          padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap",
                          fontWeight: isBest ? 800 : 400,
                          color: isBest ? "var(--info)" : entry ? "var(--text-primary)" : "var(--text-dim)",
                          background: isBest ? "rgba(2,132,199,0.08)" : mi === 0 ? "rgba(99,102,241,0.03)" : "transparent",
                        }}>
                          {entry ? formatCurrency(entry.price) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                      {avg !== null ? formatCurrency(avg) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, fontSize: "12px",
                      color: trendPct === null ? "var(--text-dim)" : trendPct > 1 ? "var(--danger)" : trendPct < -1 ? "var(--success)" : "var(--text-muted)" }}>
                      {trendPct === null ? "—" : trendPct > 1 ? `↑ ${trendPct.toFixed(1)}%` : trendPct < -1 ? `↓ ${Math.abs(trendPct).toFixed(1)}%` : "≈ stable"}
                    </td>
                  </tr>
                );
              })}

              {/* Market avg footer */}
              <tr style={{ background: "var(--bg-elevated)", borderTop: "2px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", position: "sticky", left: 0, background: "var(--bg-elevated)", zIndex: 1, fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", boxShadow: "1px 0 0 var(--border-light)" }}>
                  Market Avg
                </td>
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
                  <td style={{ padding: "10px 16px", position: "sticky", left: 0, background: "rgba(245,158,11,0.05)", zIndex: 1, fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--warning)", boxShadow: "1px 0 0 var(--border-light)" }}>
                    Sell Range
                  </td>
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

      {/* ═══ PRICING ENGINE MODAL (SC only) ══════════════════════════ */}
      {role === "SC" && isPricingOpen && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: "900px", width: "95%" }}>
            <div className="modal-header" style={{ paddingBottom: "12px" }}>
              <div style={{ width: "100%" }}>
                <p className="eyebrow" style={{ margin: 0, fontSize: "10px" }}>Pricing Engine</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: "4px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                    {pricingTab === "item" ? `Configure Item Pricing` : `Bulk Category Pricing`}
                  </h3>
                  <div style={{ display: "flex", gap: "4px", background: "var(--bg-elevated)", padding: "2px", borderRadius: "8px", border: "1px solid var(--border)", marginInlineEnd: "16px" }}>
                    <button
                      type="button"
                      onClick={() => setPricingTab("item")}
                      style={{
                        padding: "6px 12px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", border: "none", cursor: "pointer",
                        background: pricingTab === "item" ? "var(--primary)" : "transparent",
                        color: pricingTab === "item" ? "#fff" : "var(--text-muted)",
                        transition: "all 150ms",
                      }}
                    >
                      📦 Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingTab("category")}
                      style={{
                        padding: "6px 12px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", border: "none", cursor: "pointer",
                        background: pricingTab === "category" ? "var(--primary)" : "transparent",
                        color: pricingTab === "category" ? "#fff" : "var(--text-muted)",
                        transition: "all 150ms",
                      }}
                    >
                      📁 Category
                    </button>
                  </div>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setIsPricingOpen(false)} style={{ alignSelf: "center" }}>×</button>
            </div>
            <div className="modal-body">
              {pricingTab === "item" ? (
                <>
                  {error === "pricing" && (
                    <div className="restriction-info-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)", marginBottom: "16px" }}>
                      <strong>Error:</strong> Max markup must be ≥ min markup.
                    </div>
                  )}
                  <div style={{ marginBottom: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    Configure pricing details for item: <strong style={{ color: "var(--text-primary)" }}>{selectedItem?.name}</strong>
                  </div>
                  {currentMonthQuotes ? (
                    <PricingCalculator
                      month={month ?? ""}
                      itemId={itemId}
                      createdBy={username ?? "SC Manager"}
                      buyMin={currentMonthQuotes.buyMin}
                      buyMax={currentMonthQuotes.buyMax}
                      buyAvg={currentMonthQuotes.buyAvg}
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
                      onSuccess={() => {
                        setIsPricingOpen(false);
                        router.refresh();
                      }}
                      priceEntries={priceEntries}
                      suppliers={suppliers}
                    />
                  ) : (
                    <div className="restriction-info-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)" }}>
                      No supplier quotes exist for {selectedItem?.name} in {formatMonthLabel(month ?? latestMonth)}. Ask WH to record prices first.
                    </div>
                  )}
                  {existingSell && (
                    <div style={{ marginTop: "14px", padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "12px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ color: "var(--text-muted)" }}>Current:</span>
                      <span style={{ fontWeight: 700, color: "var(--success)" }}>{formatCurrency(existingSell.sell_min)}</span>
                      <span style={{ color: "var(--text-muted)" }}>–</span>
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>{formatCurrency(existingSell.sell_max)}</span>
                      <span className="badge badge-strong" style={{ fontSize: "10px" }}>{existingSell.strategy.toUpperCase()}</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Apply a bulk markup to all active items in the category.
                  </div>
                  <CategoryMarkupPanel
                    categories={categories.map(c => ({ id: c.id, name: c.name }))}
                    items={items}
                    month={month ?? ""}
                    username={username ?? "SC Manager"}
                    defaultCategoryId={catId ? String(catId) : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
