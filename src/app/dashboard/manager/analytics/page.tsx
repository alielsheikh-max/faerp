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
import { SectionIntro } from "@/components/app-shell";
import AnalyticsChart from "@/components/analytics-chart";
import AnalyticsFilters from "@/components/analytics-filters";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import Link from "next/link";
import { getServerT, getServerLocale } from "@/lib/locale-server";

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
  const t = getServerT();
  const locale = getServerLocale();
  const isAr = locale === "ar";

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

  let volatilityLevel = isAr ? "منخفض" : "Low";
  let volatilityAccent = "cyan";
  if (fluctuationPct > 15) { volatilityLevel = isAr ? "مرتفع" : "High"; volatilityAccent = "red"; }
  else if (fluctuationPct > 5) { volatilityLevel = isAr ? "متوسط" : "Moderate"; volatilityAccent = "amber"; }

  // Item stats (category mode)
  const itemsStats = items.map((item) => {
    const itemData = analyticsData.filter((d) => d.item_id === item.id);
    const itemPrices = itemData.map((d) => d.price);
    const iMin = itemPrices.length > 0 ? Math.min(...itemPrices) : 0;
    const iMax = itemPrices.length > 0 ? Math.max(...itemPrices) : 0;
    const iAvg = calculateMean(itemPrices);
    const iSpreadPct = iMin > 0 ? ((iMax - iMin) / iMin) * 100 : 0;
    let iVol = isAr ? "منخفض" : "Low";
    if (iSpreadPct > 15) iVol = isAr ? "مرتفع" : "High";
    else if (iSpreadPct > 5) iVol = isAr ? "متوسط" : "Moderate";
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
      name: (() => {
        const s = suppliers.find((x) => x.id === sid);
        return s?.fame_name || s?.name || `Supplier ${sid}`;
      })(),
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
  let strategyTitle = isAr ? "استراتيجية تنافسية ضيقة" : "Tight Competitive Strategy";
  let strategyMarkup = "5% – 8%";
  let strategyBadgeClass = "badge-success";
  if (activeVolatility > 15) {
    strategyTitle = isAr ? "استراتيجية التحوط بهامش مرتفع" : "Hedged High-Margin Strategy";
    strategyMarkup = "15% – 25%";
    strategyBadgeClass = "badge-danger";
  } else if (activeVolatility > 5) {
    strategyTitle = isAr ? "هامش مرن قياسي" : "Standard Resilient Margin";
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
        label: isAr ? "اتجاه السعر" : "Price Trend",
        text: isAr
          ? `${selectedItem.name} ${chg > 0 ? "ارتفع" : "انخفض"} بنسبة ${Math.abs(chg).toFixed(1)}% منذ ${formatMonthLabel(first.month)}`
          : `${selectedItem.name} ${chg > 0 ? "up" : "down"} ${Math.abs(chg).toFixed(1)}% since ${formatMonthLabel(first.month)}`
      });
    }
  }
  if (costLeader) {
    insights.push({
      icon: "🏆",
      label: isAr ? "قائد التكلفة" : "Cost Leader",
      text: isAr
        ? `عروض ${costLeader.name} تقل بنسبة ${Math.abs(costLeader.avgDeviation).toFixed(1)}% ${costLeader.avgDeviation < 0 ? "أقل من" : "أعلى من"} متوسط السوق`
        : `${costLeader.name} quotes ${Math.abs(costLeader.avgDeviation).toFixed(1)}% ${costLeader.avgDeviation < 0 ? "below" : "above"} market avg`
    });
  }
  if (fluctuationPct > 0) {
    insights.push({
      icon: fluctuationPct > 15 ? "⚠️" : fluctuationPct > 5 ? "🔔" : "✅",
      label: isAr ? "التقلب" : "Volatility",
      text: isAr
        ? `تقلبات السوق ${volatilityLevel} (الفارق ${fluctuationPct.toFixed(1)}%). الهامش المقترح: ${strategyMarkup}`
        : `${volatilityLevel} market volatility (${fluctuationPct.toFixed(1)}% spread). Recommended markup: ${strategyMarkup}`
    });
  }
  if (insights.length === 0) {
    insights.push({ 
      icon: "ℹ️", 
      label: isAr ? "معلومات" : "Info", 
      text: isAr ? "اضبط الفلاتر وحدد منتجًا لإنشاء رؤى." : "Adjust filters and select a product to generate insights." 
    });
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
        eyebrow={t("an.eyebrow")}
        title={t("an.title")}
        description={t("an.desc")}
        actions={<span className="badge">{session.displayName}</span>}
      />

      {/* View Mode Toggle */}
      <div style={{ display: "flex", gap: "6px", background: "var(--bg-subtle)", padding: "5px", borderRadius: "10px", border: "1px solid var(--border)", alignSelf: "flex-start" }}>
        <Link
          href={getFilterUrl({ viewMode: "single" })}
          className={`button ${viewMode === "single" ? "button-primary" : "button-secondary"}`}
          style={{ padding: "9px 18px", borderRadius: "7px", fontSize: "13px" }}
        >
          {t("an.singleItem")}
        </Link>
        <Link
          href={getFilterUrl({ viewMode: "category" })}
          className={`button ${viewMode === "category" ? "button-primary" : "button-secondary"}`}
          style={{ padding: "9px 18px", borderRadius: "7px", fontSize: "13px" }}
        >
          {t("an.categoryView")}
        </Link>
      </div>

      {/* Filter Bar */}
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

      {/* Premium Analytics Dashboard (client component) */}
      <AnalyticsDashboard
        viewMode={viewMode}
        selectedItemName={selectedItem?.name}
        avgPrice={avgPrice}
        minPrice={minPrice}
        maxPrice={maxPrice}
        stdDev={stdDev}
        fluctuationPct={fluctuationPct}
        totalQuotes={totalQuotes}
        volatilityLevel={volatilityLevel}
        volatilityAccent={volatilityAccent}
        activeVolatility={activeVolatility}
        strategyTitle={strategyTitle}
        strategyMarkup={strategyMarkup}
        strategyBadgeClass={strategyBadgeClass}
        insights={insights}
        momWithData={momWithData}
        momMax={momMax}
        momMin={momMin}
        momRange={momRange}
        supplierAverages={supplierAverages}
        maxAbsDev={maxAbsDev}
        itemsStats={viewMode === "category" ? itemsStats : []}
        mostVolatileItemId={mostVolatileItem?.itemId}
        mostStableItemId={mostStableItem?.itemId}
        dashboardHref="/dashboard"
        chart={
          selectedItem && (
            <AnalyticsChart
              history={analyticsData}
              months={monthsInRange}
              groupMode={viewMode === "category" ? "item" : "supplier"}
            />
          )
        }
      />

    </div>
  );
}
