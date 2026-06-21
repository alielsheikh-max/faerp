import { requireRole } from "@/lib/auth";
import {
  getCategories, getItems, getSuppliers, getAllPriceEntries,
  getMonthlyReviewData, getEffectiveFloorForItem, getSellingPriceHistoryForMonths,
  isTierPricingEnabled, isScTransportOverrideEnabled,
  getItemPublishedPriceHistory, getSalesCatalog,
} from "@/lib/db";
import { currentMonth, formatMonthLabel } from "@/lib/format";
import { SectionIntro } from "@/components/app-shell";
import InteractiveDashboard from "@/components/interactive-dashboard";
import MonthlyReviewModal from "@/components/monthly-review-modal";
import UsdRateCompact from "@/components/usd-rate-compact";
import UsdPricePanel from "@/components/usd-price-panel";

type SearchParams = { month?: string; categoryId?: string; itemId?: string; saved?: string; error?: string };

export default function ItemPricingPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = requireRole(["SC", "AD"]);
  const month = searchParams?.month || currentMonth();

  const categories   = getCategories();
  const items        = getItems();
  const suppliers    = getSuppliers();
  const priceEntries = getAllPriceEntries().filter(pe => pe.status === 'approved');
  const reviewData   = getMonthlyReviewData(month);
  const tierEnabled  = isTierPricingEnabled(month);
  const scTransportOverrideEnabled = isScTransportOverrideEnabled(month);
  const salesCatalog = getSalesCatalog(month);

  const initialCategoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const initialItemId     = searchParams?.itemId     ? Number(searchParams.itemId)     : undefined;

  const resolvedItemId =
    initialItemId ?? (initialCategoryId
      ? items.find(i => i.category_id === initialCategoryId)?.id
      : items[0]?.id);

  // Get last 3 months in chronological order descending relative to selected month
  const last3Months = (() => {
    const [year, monthVal] = month.split("-").map(Number);
    const result: string[] = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(year, monthVal - 1 - i, 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      result.push(`${y}-${m}`);
    }
    return result;
  })();

  const floorPct      = resolvedItemId ? getEffectiveFloorForItem(resolvedItemId) : null;
  const priceHistory  = resolvedItemId ? getSellingPriceHistoryForMonths(resolvedItemId, last3Months) : [];
  const itemSellHistory = resolvedItemId ? getItemPublishedPriceHistory(resolvedItemId, 3) : [];

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={formatMonthLabel(month)}
        title="Item Pricing"
        description="Set selling prices per item using the divisor-based formula. Select a category and item, review supplier quotes, then publish."
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge badge-strong">{session.displayName}</span>
            <span className="badge">{formatMonthLabel(month)}</span>
            <a href="/dashboard/pricing/category" className="button button-secondary" style={{ fontSize: "11px", padding: "5px 12px" }}>
              📊 Category Pricing →
            </a>
          </div>
        }
      />

      {/* ── Compact 3-chip toolbar ──────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "10px",
        marginBottom: "12px",
      }}>

        {/* Chip 1 — Monthly Review (sidebar variant: purple gradient, ~50px) */}
        <MonthlyReviewModal
          month={month}
          username={session.displayName}
          data={reviewData}
          variant="sidebar"
        />

        {/* Chip 2 — Volume Tiers status */}
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "11px 14px", borderRadius: "12px", width: "100%",
          background: tierEnabled
            ? "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.08) 100%)"
            : "var(--bg-elevated)",
          border: `1.5px solid ${tierEnabled ? "rgba(16,185,129,0.45)" : "var(--border-light)"}`,
          boxShadow: tierEnabled ? "0 4px 14px rgba(16,185,129,0.2)" : "none",
        }}>
          <span style={{
            width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
            background: tierEnabled ? "rgba(16,185,129,0.22)" : "var(--bg-subtle)",
            border: `1px solid ${tierEnabled ? "rgba(16,185,129,0.4)" : "var(--border-light)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px",
          }}>
            {tierEnabled ? "⚡" : "○"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "9px", fontWeight: 800, textTransform: "uppercase" as const,
              letterSpacing: "0.1em", marginBottom: "2px",
              color: tierEnabled ? "var(--success)" : "var(--text-muted)",
            }}>
              Monthly Policy
            </div>
            <div style={{
              fontSize: "13px", fontWeight: 700, lineHeight: 1,
              color: tierEnabled ? "var(--success)" : "var(--text-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
            }}>
              Volume Tiers {tierEnabled ? "Enabled" : "Disabled"}
            </div>
            <div style={{ fontSize: "9px", marginTop: "2px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {tierEnabled ? "Set per-item tiers in Pricing Engine" : "Admin enables in Settings"}
            </div>
          </div>
          <span style={{
            fontSize: "9px", fontWeight: 900, padding: "3px 8px", borderRadius: "10px",
            flexShrink: 0,
            background: tierEnabled ? "linear-gradient(135deg, #10b981, #059669)" : "var(--bg-subtle)",
            color: tierEnabled ? "#fff" : "var(--text-muted)",
            border: tierEnabled ? "none" : "1px solid var(--border-light)",
          }}>
            {tierEnabled ? "ON" : "OFF"}
          </span>
        </div>

        {/* Chip 3 — USD Rate (blue gradient, same 50px height) */}
        <UsdRateCompact />

      </div>

      {/* USD pricing export — moved here from overview */}
      <div style={{ marginBottom: "12px" }}>
        <UsdPricePanel catalog={salesCatalog} month={month} username={session.displayName} />
      </div>

      {/* Item-level pricing calculator */}
      <InteractiveDashboard
        categories={categories}
        items={items}
        suppliers={suppliers}
        priceEntries={priceEntries}
        role={session.role}
        month={month}
        salesCatalog={salesCatalog}
        username={session.displayName}
        initialCategoryId={initialCategoryId}
        initialItemId={initialItemId}
        saved={searchParams?.saved}
        error={searchParams?.error}
        floorPct={floorPct}
        priceHistory={priceHistory}
        scTransportOverrideEnabled={scTransportOverrideEnabled}
        tierEnabled={tierEnabled}
        itemSellHistory={itemSellHistory}
      />
    </div>
  );
}
