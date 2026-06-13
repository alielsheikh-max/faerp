import { requireRole } from "@/lib/auth";
import {
  getCategories,
  getItems,
  getSuppliers,
  getAnalyticsData
} from "@/lib/db";
import {
  currentMonth,
  shiftMonth,
  formatCurrency,
  formatMonthLabel
} from "@/lib/format";
import { SectionIntro, StatCard } from "@/components/app-shell";
import AnalyticsChart from "@/components/analytics-chart";
import AnalyticsFilters from "@/components/analytics-filters";
import Link from "next/link";

type SearchParams = {
  viewMode?: string;
  startMonth?: string;
  endMonth?: string;
  categoryId?: string;
  itemId?: string;
  supplierIds?: string | string[];
};

function toNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toArray(value?: string | string[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function calculateMean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number) {
  if (values.length <= 1) return 0;
  const sumSqDiff = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
  return Math.sqrt(sumSqDiff / values.length);
}

const SUPPLIER_COLORS = [
  "#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16"
];

export default function AnalyticsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = requireRole(["SC"]);

  const viewMode = searchParams?.viewMode === "category" ? "category" : "single";

  const defaultEndMonth = currentMonth();
  const defaultStartMonth = shiftMonth(defaultEndMonth, -2);

  const startMonth = searchParams?.startMonth || defaultStartMonth;
  const endMonth = searchParams?.endMonth || defaultEndMonth;

  const monthsInRange: string[] = [];
  let tempMonth = startMonth;
  while (tempMonth <= endMonth) {
    monthsInRange.push(tempMonth);
    tempMonth = shiftMonth(tempMonth, 1);
  }

  const categories = getCategories();
  const categoryId = toNumber(searchParams?.categoryId);
  const allItems = getItems(); // Fetch all items for the independent product list
  const items = categoryId ? getItems(categoryId) : allItems; // Filtered items for Category View only
  const suppliers = getSuppliers();

  const selectedItemId = toNumber(searchParams?.itemId);
  // Ensure selectedItem belongs to the current list of items (handles category transition)
  const isItemValid = selectedItemId !== undefined && allItems.some((item) => item.id === selectedItemId);
  const activeItemId = isItemValid ? selectedItemId : (allItems[0]?.id || 0);
  const selectedItem = allItems.find((item) => item.id === activeItemId);

  const querySupplierIds = toArray(searchParams?.supplierIds).map(Number).filter(Boolean);
  const selectedSupplierIds = querySupplierIds.length > 0
    ? querySupplierIds
    : suppliers.map((s) => s.id);

  const activeItemIds = viewMode === "category" ? items.map((i) => i.id) : [activeItemId];

  const analyticsData = getAnalyticsData({
    startMonth,
    endMonth,
    itemIds: activeItemIds,
    supplierIds: selectedSupplierIds
  });

  const prices = analyticsData.map((d) => d.price);
  const totalQuotes = analyticsData.length;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const avgPrice = calculateMean(prices);
  const stdDev = calculateStdDev(prices, avgPrice);
  const fluctuationPct = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

  let volatilityLevel = "Low";
  let volatilityAccent = "cyan";
  if (fluctuationPct > 15) { volatilityLevel = "High"; volatilityAccent = "red"; }
  else if (fluctuationPct > 5) { volatilityLevel = "Moderate"; volatilityAccent = "amber"; }

  // Item stats (category mode)
  const itemsStats = items.map((item) => {
    const itemData = analyticsData.filter((d) => d.item_id === item.id);
    const itemPrices = itemData.map((d) => d.price);
    const iMin = itemPrices.length > 0 ? Math.min(...itemPrices) : 0;
    const iMax = itemPrices.length > 0 ? Math.max(...itemPrices) : 0;
    const iAvg = calculateMean(itemPrices);
    const iSpreadPct = iMin > 0 ? ((iMax - iMin) / iMin) * 100 : 0;
    let iVol = "Low";
    if (iSpreadPct > 15) iVol = "High";
    else if (iSpreadPct > 5) iVol = "Moderate";
    return { itemId: item.id, itemName: item.name, unit: item.unit, quotesCount: itemData.length, min: iMin, avg: iAvg, max: iMax, spreadPct: iSpreadPct, volatility: iVol };
  }).filter((stat) => stat.quotesCount > 0);

  const sortedByVolatility = [...itemsStats].sort((a, b) => b.spreadPct - a.spreadPct);
  const mostVolatileItem = sortedByVolatility[0];
  const mostStableItem = [...itemsStats].sort((a, b) => a.spreadPct - b.spreadPct)[0];

  // Supplier scorecard
  const supplierAverages = selectedSupplierIds.map((sid) => {
    const sQuotes = analyticsData.filter((d) => d.supplier_id === sid);
    const deviations = sQuotes.map((q) => {
      const monthQuotes = analyticsData.filter((d) => d.item_id === q.item_id && d.month === q.month);
      const mAvg = calculateMean(monthQuotes.map((mq) => mq.price));
      return mAvg > 0 ? (q.price - mAvg) / mAvg : 0;
    });
    const avgDeviation = deviations.length > 0 ? calculateMean(deviations) * 100 : 0;
    const sPrices = sQuotes.map((q) => q.price);
    const monthsQuoted = Array.from(new Set(sQuotes.map((q) => q.month))).length;
    const participationRate = monthsInRange.length > 0 ? (monthsQuoted / monthsInRange.length) * 100 : 0;
    return {
      id: sid,
      name: suppliers.find((s) => s.id === sid)?.name || `Supplier ${sid}`,
      avgPrice: sPrices.length > 0 ? calculateMean(sPrices) : 0,
      avgDeviation,
      participationRate,
      quotesCount: sQuotes.length
    };
  }).filter((s) => s.quotesCount > 0).sort((a, b) => a.avgDeviation - b.avgDeviation);

  const costLeader = supplierAverages[0];

  // MoM stats
  const monthlyStats = monthsInRange.map((m) => {
    const monthData = analyticsData.filter((d) => d.month === m);
    const mPrices = monthData.map((d) => d.price);
    const mMin = mPrices.length > 0 ? Math.min(...mPrices) : null;
    const mMax = mPrices.length > 0 ? Math.max(...mPrices) : null;
    const mAvg = mPrices.length > 0 ? calculateMean(mPrices) : null;
    return { month: m, count: monthData.length, min: mMin, max: mMax, avg: mAvg };
  });

  // Strategy recommendation
  const activeVolatility = viewMode === "category" ? (mostVolatileItem?.spreadPct || 0) : fluctuationPct;
  let strategyTitle = "Tight Competitive Strategy";
  let strategyMarkup = "5% – 8%";
  let strategyBadgeClass = "badge-success";
  if (activeVolatility > 15) {
    strategyTitle = "Hedged High-Margin Strategy";
    strategyMarkup = "15% – 25%";
    strategyBadgeClass = "badge-danger";
  } else if (activeVolatility > 5) {
    strategyTitle = "Standard Resilient Margin";
    strategyMarkup = "10% – 15%";
    strategyBadgeClass = "badge-warning";
  }

  // Compact insights (max 3, short)
  const insights: { icon: string; label: string; text: string }[] = [];
  const activeMonthlyStats = monthlyStats.filter((m) => m.avg !== null);
  if (activeMonthlyStats.length > 1 && selectedItem) {
    const first = activeMonthlyStats[0];
    const last = activeMonthlyStats[activeMonthlyStats.length - 1];
    if (first.avg && last.avg) {
      const chg = ((last.avg - first.avg) / first.avg) * 100;
      insights.push({
        icon: chg > 0 ? "📈" : "📉",
        label: "Price Trend",
        text: `${selectedItem.name} ${chg > 0 ? "up" : "down"} ${Math.abs(chg).toFixed(1)}% since ${formatMonthLabel(first.month)}`
      });
    }
  }
  if (costLeader) {
    insights.push({
      icon: "🏆",
      label: "Cost Leader",
      text: `${costLeader.name} quotes ${Math.abs(costLeader.avgDeviation).toFixed(1)}% ${costLeader.avgDeviation < 0 ? "below" : "above"} market avg`
    });
  }
  if (fluctuationPct > 0) {
    insights.push({
      icon: fluctuationPct > 15 ? "⚠️" : fluctuationPct > 5 ? "🔔" : "✅",
      label: "Volatility",
      text: `${volatilityLevel} market volatility (${fluctuationPct.toFixed(1)}% spread). Recommended markup: ${strategyMarkup}`
    });
  }
  if (insights.length === 0) {
    insights.push({ icon: "ℹ️", label: "Info", text: "Adjust filters and select a product to generate insights." });
  }

  // Find max deviation for bar scaling
  const maxAbsDev = Math.max(...supplierAverages.map(s => Math.abs(s.avgDeviation)), 1);

  const getFilterUrl = (params: Partial<SearchParams>) => {
    const urlParams = new URLSearchParams();
    urlParams.set("viewMode", params.viewMode || viewMode);
    urlParams.set("startMonth", params.startMonth || startMonth);
    urlParams.set("endMonth", params.endMonth || endMonth);
    if (params.categoryId !== undefined) {
      if (params.categoryId) urlParams.set("categoryId", String(params.categoryId));
    } else if (categoryId) {
      urlParams.set("categoryId", String(categoryId));
    }
    urlParams.set("itemId", params.itemId !== undefined ? String(params.itemId) : String(activeItemId));
    const sIds = params.supplierIds !== undefined ? toArray(params.supplierIds) : selectedSupplierIds.map(String);
    sIds.forEach((sid) => urlParams.append("supplierIds", sid));
    return `?${urlParams.toString()}`;
  };

  // MoM bar chart helpers
  const momWithData = monthlyStats.filter(m => m.avg !== null);
  const momMax = momWithData.length > 0 ? Math.max(...momWithData.map(m => m.max || 0)) : 1;
  const momMin = momWithData.length > 0 ? Math.min(...momWithData.map(m => m.min || 0)) : 0;
  const momRange = momMax - momMin || 1;

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Market Intelligence"
        title="Insights & Analytics"
        description="Track supplier competitiveness, price trends, and market volatility to make smarter purchasing decisions."
        actions={<span className="badge">{session.displayName}</span>}
      />

      {/* ─── View Mode Toggle ─── */}
      <div style={{ display: "flex", gap: "6px", background: "var(--bg-subtle)", padding: "5px", borderRadius: "10px", border: "1px solid var(--border)", alignSelf: "flex-start" }}>
        <Link
          href={getFilterUrl({ viewMode: "single" })}
          className={`button ${viewMode === "single" ? "button-primary" : "button-secondary"}`}
          style={{ padding: "9px 18px", borderRadius: "7px", fontSize: "13px" }}
        >
          🔍 Single Item
        </Link>
        <Link
          href={getFilterUrl({ viewMode: "category" })}
          className={`button ${viewMode === "category" ? "button-primary" : "button-secondary"}`}
          style={{ padding: "9px 18px", borderRadius: "7px", fontSize: "13px" }}
        >
          📊 Category View
        </Link>
      </div>

      {/* ─── Compact Horizontal Filter Bar ─── */}
      <AnalyticsFilters
        categories={categories}
        allItems={allItems}
        suppliers={suppliers}
        startMonth={startMonth}
        endMonth={endMonth}
        categoryId={categoryId ? String(categoryId) : ""}
        itemId={String(activeItemId)}
        selectedSupplierIds={selectedSupplierIds}
        viewMode={viewMode}
      />

      {/* ─── Stat Cards ─── */}
      <section className="stat-grid">
        <StatCard
          label={viewMode === "single" ? "Avg Market Price" : "Category Avg Price"}
          value={formatCurrency(avgPrice)}
          note={`${totalQuotes} quotes captured`}
          accent="indigo"
        />
        <StatCard
          label="Price Spread"
          value={minPrice > 0 ? `${formatCurrency(minPrice)} → ${formatCurrency(maxPrice)}` : "—"}
          note="Lowest vs Highest quotes"
          accent="cyan"
        />
        <StatCard
          label="Market Volatility"
          value={totalQuotes > 0 ? `${fluctuationPct.toFixed(1)}%` : "—"}
          note={viewMode === "single" ? `${volatilityLevel} risk level` : `Most volatile: ${mostVolatileItem?.itemName || "—"}`}
          accent={volatilityAccent as any}
        />
        <StatCard
          label="Std Deviation"
          value={totalQuotes > 0 ? `± ${formatCurrency(stdDev)}` : "—"}
          note={viewMode === "single" ? "Statistical quote variation" : `Most stable: ${mostStableItem?.itemName || "—"}`}
          accent="amber"
        />
      </section>

      {/* ─── Chart ─── */}
      {selectedItem && (
        <AnalyticsChart
          history={analyticsData}
          months={monthsInRange}
          groupMode={viewMode === "category" ? "item" : "supplier"}
        />
      )}

      {/* ─── Three-column: Insights | MoM Bars | Strategy ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>

        {/* Insights Pills */}
        <section className="panel">
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Auto-Generated</p>
              <h2>Market Insights</h2>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {insights.map((ins, idx) => (
              <div key={idx} style={{
                display: "flex", gap: "10px", alignItems: "flex-start",
                padding: "12px 14px", borderRadius: "10px",
                background: "var(--bg-subtle)", border: "1px solid var(--border-light)"
              }}>
                <span style={{ fontSize: "20px", lineHeight: 1, flexShrink: 0 }}>{ins.icon}</span>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "3px" }}>{ins.label}</div>
                  <div style={{ fontSize: "12.5px", lineHeight: "1.4", color: "var(--text-primary)" }}>{ins.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MoM Mini Bar Chart */}
        <section className="panel">
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Month-over-Month</p>
              <h2>Price Breakdown</h2>
            </div>
            <span className="badge">{momWithData.length} months</span>
          </div>
          {momWithData.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No data in range.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {momWithData.map((ms) => {
                const avgBarW = ms.avg ? Math.max(4, ((ms.avg - momMin) / momRange) * 100) : 0;
                const minBarW = ms.min ? Math.max(2, ((ms.min - momMin) / momRange) * 80) : 0;
                const maxBarW = ms.max ? Math.max(4, ((ms.max - momMin) / momRange) * 100) : 0;
                return (
                  <div key={ms.month} style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700 }}>{formatMonthLabel(ms.month)}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{ms.count} quotes</span>
                    </div>
                    {/* Avg bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ width: "24px", fontSize: "9.5px", color: "var(--text-muted)", flexShrink: 0 }}>Avg</span>
                      <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "var(--bg-muted)", overflow: "hidden" }}>
                        <div style={{ width: `${avgBarW}%`, height: "100%", borderRadius: "4px", background: "var(--primary)", transition: "width 400ms" }} />
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary)", minWidth: "52px", textAlign: "right" }}>{formatCurrency(ms.avg)}</span>
                    </div>
                    {/* Range row */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", paddingLeft: "32px" }}>
                      <span style={{ color: "var(--success)" }}>↓ {formatCurrency(ms.min)}</span>
                      <span style={{ color: "var(--danger)" }}>↑ {formatCurrency(ms.max)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Strategy Advisor */}
        <section className="panel">
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Markup Advisor</p>
              <h2>Pricing Strategy</h2>
            </div>
            <span className={`badge ${strategyBadgeClass}`}>{strategyMarkup}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Volatility gauge */}
            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Volatility Gauge</div>
              <div style={{ height: "10px", borderRadius: "5px", background: "var(--bg-muted)", overflow: "hidden", marginBottom: "6px" }}>
                <div style={{
                  width: `${Math.min(100, activeVolatility * 4)}%`,
                  height: "100%", borderRadius: "5px",
                  background: activeVolatility > 15 ? "var(--danger)" : activeVolatility > 5 ? "var(--warning)" : "var(--success)",
                  transition: "width 600ms"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)" }}>
                <span>Stable</span>
                <span style={{ fontWeight: 700, color: activeVolatility > 15 ? "var(--danger)" : activeVolatility > 5 ? "var(--warning)" : "var(--success)" }}>
                  {activeVolatility.toFixed(1)}% — {volatilityLevel}
                </span>
                <span>Volatile</span>
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}>
              <div style={{ fontWeight: 800, fontSize: "13.5px", marginBottom: "6px" }}>{strategyTitle}</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Suggested markup:</span>
                <span className={`badge ${strategyBadgeClass}`} style={{ fontSize: "11px" }}>{strategyMarkup}</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
                {activeVolatility > 15
                  ? "High volatility detected. Use a wide buffer to protect against supplier price spikes."
                  : activeVolatility > 5
                  ? "Moderate variation. A standard margin ensures healthy profits while staying competitive."
                  : "Stable market. Keep margins lean and competitive to secure high-volume agreements."}
              </p>
            </div>

            <a
              href="/dashboard"
              className="button button-primary"
              style={{ textAlign: "center", fontSize: "12px", padding: "10px 16px" }}
            >
              Price an Item in Overview →
            </a>
          </div>
        </section>

      </div>

      {/* ─── Supplier Scorecard — Visual Cards ─── */}
      <section className="panel">
        <div className="panel-header" style={{ marginBottom: "16px" }}>
          <div>
            <p className="eyebrow">Competitiveness Ranking</p>
            <h2>Supplier Scorecard</h2>
          </div>
          <span className="badge">{supplierAverages.length} vendors</span>
        </div>

        {supplierAverages.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px 0", fontSize: "13px" }}>No supplier data for current filters.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
            {supplierAverages.map((sup, idx) => {
              const color = SUPPLIER_COLORS[suppliers.findIndex(s => s.id === sup.id) % SUPPLIER_COLORS.length] || "#3b82f6";
              const isLeader = idx === 0;
              const devPct = Math.min(100, (Math.abs(sup.avgDeviation) / maxAbsDev) * 100);
              const devColor = sup.avgDeviation < 0 ? "var(--success)" : "var(--danger)";
              return (
                <div key={sup.id} style={{
                  padding: "16px", borderRadius: "12px", border: `2px solid ${isLeader ? color : "var(--border-light)"}`,
                  background: isLeader ? `${color}0d` : "var(--bg-subtle)",
                  position: "relative", display: "flex", flexDirection: "column", gap: "10px"
                }}>
                  {isLeader && (
                    <span style={{ position: "absolute", top: "10px", right: "10px", fontSize: "9px", fontWeight: 800, background: color, color: "#fff", padding: "2px 7px", borderRadius: "10px", textTransform: "uppercase" }}>
                      Cost Leader
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: "13px" }}>#{idx + 1} {sup.name}</span>
                  </div>

                  {/* Deviation bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginBottom: "5px" }}>
                      <span>vs. Market Avg</span>
                      <span style={{ fontWeight: 800, color: devColor }}>{sup.avgDeviation < 0 ? "" : "+"}{sup.avgDeviation.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: "7px", borderRadius: "4px", background: "var(--bg-muted)", overflow: "hidden" }}>
                      <div style={{ width: `${devPct}%`, height: "100%", borderRadius: "4px", background: devColor }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ background: "var(--bg-elevated)", borderRadius: "8px", padding: "8px 10px" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>Avg Price</div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--text-primary)" }}>{formatCurrency(sup.avgPrice)}</div>
                    </div>
                    <div style={{ background: "var(--bg-elevated)", borderRadius: "8px", padding: "8px 10px" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>Coverage</div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: sup.participationRate < 100 ? "var(--warning)" : "var(--success)" }}>
                        {sup.participationRate.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>{sup.quotesCount} quotes logged</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Category Matrix Table (Category mode only) ─── */}
      {viewMode === "category" && itemsStats.length > 0 && (
        <section className="panel">
          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <div>
              <p className="eyebrow">Category Matrix</p>
              <h2>Products Volatility & Pricing Spread</h2>
            </div>
            <span className="badge">{itemsStats.length} items</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {itemsStats.map((row) => {
              const isMostVolatile = mostVolatileItem && row.itemId === mostVolatileItem.itemId;
              const isMostStable = mostStableItem && row.itemId === mostStableItem.itemId;
              const riskColor = row.spreadPct > 15 ? "var(--danger)" : row.spreadPct > 5 ? "var(--warning)" : "var(--success)";
              const barW = Math.max(2, Math.min(100, row.spreadPct * 3));
              return (
                <div key={row.itemId} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto auto",
                  gap: "12px", alignItems: "center",
                  padding: "12px 16px", borderRadius: "10px",
                  background: "var(--bg-subtle)", border: "1px solid var(--border-light)"
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{row.itemName}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
                      <div style={{ height: "5px", borderRadius: "3px", background: "var(--bg-muted)", overflow: "hidden", width: "80px", display: "inline-block" }}>
                        <div style={{ width: `${barW}%`, height: "100%", borderRadius: "3px", background: riskColor }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text-muted)" }}>{row.unit}</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase" }}>Min → Max</div>
                    <div style={{ fontSize: "12px", fontWeight: 700 }}>
                      <span style={{ color: "var(--success)" }}>{formatCurrency(row.min)}</span>
                      <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>→</span>
                      <span style={{ color: "var(--danger)" }}>{formatCurrency(row.max)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase" }}>Spread</div>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: riskColor }}>{row.spreadPct.toFixed(1)}%</div>
                  </div>
                  <div>
                    {isMostVolatile ? (
                      <span className="badge badge-danger" style={{ fontSize: "9px" }}>Most Volatile</span>
                    ) : isMostStable ? (
                      <span className="badge badge-success" style={{ fontSize: "9px" }}>Most Stable</span>
                    ) : (
                      <span className="badge" style={{ fontSize: "9px" }}>{row.volatility}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
