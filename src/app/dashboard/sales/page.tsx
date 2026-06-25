import { SectionIntro, StatCard } from "@/components/app-shell";
import SalesList from "@/components/sales-list";
import { requireRole } from "@/lib/auth";
import { getCategories, getMonthlyMetrics, getSalesCatalog, getRecentPriceUpdates } from "@/lib/db";
import { currentMonth, formatDateTime, formatMonthLabel } from "@/lib/format";
import { getServerT } from "@/lib/locale-server";
import PriceUpdateAlerts from "@/components/price-update-alerts";
import SalesPriceListExport from "@/components/sales-price-list-export";

export default function SalesPage({ searchParams }: { searchParams?: { month?: string; categoryId?: string } }) {
  const session = requireRole(["SA", "SC"]);
  const t = getServerT();

  const month = searchParams?.month || currentMonth();
  const categoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const categories = getCategories();
  const isSC = session.role === "SC";
  const rows = getSalesCatalog(month, categoryId);
  const metrics = getMonthlyMetrics(month);
  const publishedRows = rows.filter((row) => row.sell_min !== null && (isSC || row.approval_status === "approved" || row.last_approved_sell_min !== null));

  // Build price history map for ALL roles — used for the 📝 Revised badge
  // SC: also shows inline old→new in the row. SA: badge only (they get the alert banner).
  const priceHistoryMap: Record<number, {
    prev_sell_min: number | null;
    prev_sell_max: number | null;
    changed_at: string;
    changed_by: string;
  }> = {};

  // Use a higher limit here so we capture all revised items this month for badges
  const allUpdates = getRecentPriceUpdates(month, 200);
  for (const u of allUpdates) {
    if (!priceHistoryMap[u.item_id]) {
      priceHistoryMap[u.item_id] = {
        prev_sell_min: u.prev_sell_min,
        prev_sell_max: u.prev_sell_max,
        changed_at: u.changed_at,
        changed_by: u.changed_by,
      };
    }
  }

  // For SA alerts: use a capped list (already deduplicated per item by DB query)
  const saAlerts = allUpdates.slice(0, 20);

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={formatMonthLabel(month)}
        title={t("sales.title")}
        description={t("sales.desc")}
        actions={<span className="badge badge-strong">{session.displayName}</span>}
      />

      {/* SA only: CRITICAL PRICE UPDATE alerts with acknowledge button
          SC sees inline row indicators instead — no banner here */}
      {!isSC && (
        <PriceUpdateAlerts recentUpdates={saAlerts} role="SA" />
      )}

      <section className="stat-grid">
        <StatCard label={t("sales.published")}   value={publishedRows.length}       note={t("sales.readyToQuote")} />
        <StatCard label={t("sales.marketItems")} value={metrics.products}            note={t("sales.capturedThis")} />
        <StatCard label={t("sales.coverage")}    value={metrics.suppliers}           note={t("sales.contributing")} />
        <StatCard label={t("sales.lastUpdate")}  value={formatDateTime(metrics.lastUpdate)} note={t("sales.latestActivity")} />
      </section>

      <div className="panel" style={{ padding: "20px 24px" }}>
        <form method="GET" className="inline-form">
          <label className="field">
            <span>{t("sales.filterMonth")}</span>
            <input type="month" name="month" defaultValue={month} />
          </label>
          <label className="field">
            <span>{t("sales.catScope")}</span>
            <select name="categoryId" defaultValue={categoryId ? String(categoryId) : ""}>
              <option value="">{t("sales.allCats")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="form-actions align-end">
            <button type="submit" className="button button-primary">{t("sales.loadPrices")}</button>
          </div>
        </form>
      </div>

      {/* SC only: export full approved price list as PDF or XLSX */}
      {isSC && (
        <SalesPriceListExport
          rows={rows as any}
          month={month}
          username={session.displayName}
        />
      )}

      <SalesList
        initialRows={rows}
        categories={categories}
        month={month}
        role={session.role as "SC" | "SA"}
        priceHistory={priceHistoryMap}
      />
    </div>
  );
}
