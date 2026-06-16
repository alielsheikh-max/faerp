import { SectionIntro, StatCard } from "@/components/app-shell";
import SalesList from "@/components/sales-list";
import { requireRole } from "@/lib/auth";
import { getCategories, getMonthlyMetrics, getSalesCatalog, getRecentPriceUpdates } from "@/lib/db";
import { currentMonth, formatDateTime, formatMonthLabel } from "@/lib/format";
import { getServerT } from "@/lib/locale-server";
import PriceUpdateAlerts from "@/components/price-update-alerts";

export default function SalesPage({ searchParams }: { searchParams?: { month?: string; categoryId?: string } }) {
  const session = requireRole(["SA", "SC"]);
  const t = getServerT();

  const month = searchParams?.month || currentMonth();
  const categoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const categories = getCategories();
  const rows = getSalesCatalog(month, categoryId);
  const metrics = getMonthlyMetrics(month);
  const publishedRows = rows.filter((row) => row.sell_min !== null);
  const recentUpdates = getRecentPriceUpdates(month);

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={formatMonthLabel(month)}
        title={t("sales.title")}
        description={t("sales.desc")}
        actions={<span className="badge badge-strong">{session.displayName}</span>}
      />

      <PriceUpdateAlerts recentUpdates={recentUpdates} />

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

      <SalesList initialRows={rows} categories={categories} month={month} />
    </div>
  );
}
