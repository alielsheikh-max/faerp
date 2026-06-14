import { requireRole } from "@/lib/auth";
import {
  getCategories, getItems, getSuppliers, getAllPriceEntries,
  getSalesCatalog, getMonthlyReviewData,
  getEffectiveFloorForItem, getSellingPriceHistory,
} from "@/lib/db";
import { currentMonth, formatCurrency, formatMonthLabel } from "@/lib/format";
import { SectionIntro } from "@/components/app-shell";
import InteractiveDashboard from "@/components/interactive-dashboard";
import MonthlyReviewModal from "@/components/monthly-review-modal";
import ReportGenerator from "@/components/report-generator";
import RequestPricesBanner from "@/components/request-prices-banner";
import { getServerT } from "@/lib/locale-server";
import ClientQuotingSimulator from "@/components/client-quoting-simulator";


type SearchParams = { month?: string; categoryId?: string; itemId?: string; saved?: string; error?: string; simulate?: string };

export default function DashboardPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = requireRole();
  const t = getServerT();
  const role = session.role;
  const month = searchParams?.month || currentMonth();

  // ── SA: read-only approved catalog ──
  if (role === "SA") {
    const catalog = getSalesCatalog(month);
    const published = catalog.filter(r => r.sell_min !== null);
    const grouped: Record<string, typeof published> = {};
    for (const row of published) {
      if (!grouped[row.category_name]) grouped[row.category_name] = [];
      grouped[row.category_name].push(row);
    }

    return (
      <div className="page-stack">
        <SectionIntro
          eyebrow={formatMonthLabel(month)}
          title={t("dash.monthlyApproved")}
          description={`${t("dash.session")} ${session.displayName} — ${formatMonthLabel(month)}`}
          actions={
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <ReportGenerator role="SA" username={session.displayName} dashboardMonth={month} />
              <span className="badge badge-success">{published.length} {t("dash.itemsPublished")}</span>
            </div>
          }        />
        <ClientQuotingSimulator initialRows={catalog} month={formatMonthLabel(month)} />

        {published.length === 0 ? (
          <section className="panel" style={{ padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>📋</div>
            <h2 style={{ color: "var(--text-secondary)", marginBottom: "8px" }}>{t("dash.noPublished")}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{t("dash.noPublishedDesc")}</p>
          </section>
        ) : (
          Object.entries(grouped).map(([categoryName, rows]) => (
            <section className="panel" key={categoryName}>
              <div className="panel-header" style={{ marginBottom: "16px" }}>
                <div>
                  <p className="eyebrow">{t("dash.productCategory")}</p>
                  <h2>{categoryName}</h2>
                </div>
                <span className="badge">{rows.length} {t("gen.item")}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("dash.product")}</th>
                      <th>{t("dash.unit")}</th>
                      <th style={{ textAlign: "center" }}>{t("dash.minSell")}</th>
                      <th style={{ textAlign: "center" }}>{t("dash.maxSell")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.item_id}>
                        <td style={{ fontWeight: 700, maxWidth: "340px" }}>{row.item_name}</td>
                        <td><span className="badge">{row.unit}</span></td>
                        <td style={{ textAlign: "center" }}>
                          <strong style={{ fontSize: "15px", color: "var(--success)" }}>{formatCurrency(row.sell_min)}</strong>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <strong style={{ fontSize: "15px", color: "var(--primary)" }}>{formatCurrency(row.sell_max)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    );
  }

  // ── WH / SC: full dashboard ──
  const categories = getCategories();
  const items = getItems();
  const suppliers = getSuppliers();
  const priceEntries = getAllPriceEntries();
  const salesCatalog = role === "SC" ? getSalesCatalog(month) : [];
  const reviewData = role === "SC" ? getMonthlyReviewData(month) : [];
  const initialCategoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const initialItemId = searchParams?.itemId ? Number(searchParams.itemId) : undefined;

  // ── SC only: resolve floor + audit history for the selected item ──
  // The item in view is either from the URL param or defaults to the first item.
  // We fetch on the server so the calculator receives them on first render.
  const resolvedItemId =
    initialItemId ?? (initialCategoryId
      ? items.find((i) => i.category_id === initialCategoryId)?.id
      : items[0]?.id);

  const floorPct = (role === "SC" && resolvedItemId)
    ? getEffectiveFloorForItem(resolvedItemId)
    : null;

  const priceHistory = (role === "SC" && resolvedItemId)
    ? getSellingPriceHistory(resolvedItemId, month)
    : [];

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={formatMonthLabel(month)}
        title={t("dash.title")}
        description={t("dash.desc")}
        actions={
          searchParams?.saved ? (
            <span className="badge badge-success">{t("dash.saved")}</span>
          ) : searchParams?.error ? (
            <span className="badge badge-danger">{t("dash.error")}</span>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span className="badge badge-strong">{session.displayName}</span>
              {role === "WH" && (
                <a
                  href={searchParams?.simulate === "true" ? "/dashboard" : "/dashboard?simulate=true"}
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: searchParams?.simulate === "true" ? "var(--warning)" : "var(--bg-elevated)",
                    color: searchParams?.simulate === "true" ? "#000" : "var(--text-secondary)",
                    border: "1px solid var(--border-medium)",
                    textDecoration: "none",
                    transition: "all 150ms",
                  }}
                >
                  {searchParams?.simulate === "true" ? "⏹ Stop Simulation" : "⚙️ Simulate June 25th"}
                </a>
              )}
            </div>
          )
        }
      />

      {/* ── Action toolbar — PDF Reports + Monthly Review ───────────────────── */}
      {role === "SC" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
        }}>
          <ReportGenerator role={role} username={session.displayName} dashboardMonth={month} />
          <MonthlyReviewModal month={month} username={session.displayName} data={reviewData} variant="dashboard" />
        </div>
      )}
      {role === "WH" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", marginBottom: "12px" }}>
          <RequestPricesBanner categories={categories} items={items} simulate={searchParams?.simulate === "true"} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ReportGenerator role={role} username={session.displayName} dashboardMonth={month} />
          </div>
        </div>
      )}
      <InteractiveDashboard
        categories={categories}
        items={items}
        suppliers={suppliers}
        priceEntries={priceEntries}
        role={role}
        month={month}
        salesCatalog={salesCatalog}
        username={session.displayName}
        initialCategoryId={initialCategoryId}
        initialItemId={initialItemId}
        saved={searchParams?.saved}
        error={searchParams?.error}
        floorPct={floorPct}
        priceHistory={priceHistory}
      />
    </div>
  );
}
