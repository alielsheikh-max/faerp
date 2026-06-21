import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCategories, getItems, getSuppliers, getAllPriceEntries,
  getSalesCatalog, getMonthlyReviewData,
  countPendingRequests, getRecentPriceUpdates,
  getWHCollectionOverview,
} from "@/lib/db";
import { currentMonth, formatCurrency, formatMonthLabel } from "@/lib/format";
import { SectionIntro } from "@/components/app-shell";
import InteractiveDashboard from "@/components/interactive-dashboard";
import ReportGenerator from "@/components/report-generator";
import RequestPricesBanner from "@/components/request-prices-banner";
import { getServerT, getServerLocale } from "@/lib/locale-server";
import ClientQuotingSimulator from "@/components/client-quoting-simulator";
import PriceUpdateAlerts from "@/components/price-update-alerts";
import UsdPricePanel from "@/components/usd-price-panel";
import MonthlyReviewModal from "@/components/monthly-review-modal";
import ScOverviewPanel from "@/components/sc-overview-panel";
import WhMissingQuotes from "@/components/wh-missing-quotes";
import ClickableDetailTrigger from "@/components/clickable-detail-trigger";

type SearchParams = { month?: string; categoryId?: string; itemId?: string; saved?: string; error?: string; simulate?: string };

export default function DashboardPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = requireRole();
  const t = getServerT();
  const role = session.role;

  if (role === "AD") {
    redirect("/dashboard/admin");
  }

  const month = searchParams?.month || currentMonth();
  const pendingCount = role === "SC" ? countPendingRequests() : 0;

  // ── SA: read-only approved catalog ──
  if (role === "SA") {
    const catalog = getSalesCatalog(month);
    const published = catalog.filter(r => r.sell_min !== null);
    const grouped: Record<string, typeof published> = {};
    for (const row of published) {
      if (!grouped[row.category_name]) grouped[row.category_name] = [];
      grouped[row.category_name].push(row);
    }
    const recentUpdates = getRecentPriceUpdates(month, 200);

    // Build price history map for "Revised" badge
    const priceHistoryMap: Record<number, { prev_sell_min: number | null; prev_sell_max: number | null; changed_at: string }> = {};
    for (const u of recentUpdates) {
      if (!priceHistoryMap[u.item_id]) {
        priceHistoryMap[u.item_id] = { prev_sell_min: u.prev_sell_min, prev_sell_max: u.prev_sell_max, changed_at: u.changed_at };
      }
    }

    // Tier price calculator (same formula as SalesList)
    function roundUp5(n: number) { return Math.ceil(n / 5) * 5; }
    function calcTierPrices(row: typeof published[0]) {
      const base = row.buy_avg ?? 0;
      return [
        { label: "B",  range: `1–${row.tier1_max}`,  price: row.tier1_discount > 0 ? roundUp5(base / row.tier1_discount) : null },
        { label: "T2", range: `${row.tier1_max + 1}–${row.tier2_max}`, price: row.tier2_discount > 0 ? roundUp5(base / row.tier2_discount) : null },
        { label: "T3", range: `${row.tier2_max + 1}–${row.tier3_max}`, price: row.tier3_discount > 0 ? roundUp5(base / row.tier3_discount) : null },
        { label: "T4", range: `>${row.tier3_max}`, price: row.tier4_discount > 0 ? roundUp5(base / row.tier4_discount) : null },
      ].filter(t => t.price !== null);
    }

    const TIER_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];

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
        <PriceUpdateAlerts recentUpdates={recentUpdates.slice(0, 20)} role="SA" />
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
                      <th style={{ textAlign: "center" }}>{t("gen.moq")}</th>
                      <th style={{ textAlign: "center" }}>{getServerLocale() === "ar" ? "الأسعار المعتمدة" : "Approved Prices"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const isTiered = row.is_tiered === 1 && row.buy_avg != null;
                      const tierPrices = isTiered ? calcTierPrices(row) : [];
                      const isRevised = !!priceHistoryMap[row.item_id];
                      return (
                        <tr key={row.item_id} style={isRevised ? {
                          backgroundColor: "rgba(245,158,11,0.04)",
                          borderLeft: "3px solid #f59e0b",
                        } : {}}>
                          <td style={{ fontWeight: 700, maxWidth: "340px" }}>
                            <ClickableDetailTrigger
                              type="item"
                              id={row.item_id}
                              className="clickable-detail-trigger"
                            >
                              {row.item_name}
                            </ClickableDetailTrigger>
                            {isRevised && (
                              <span style={{
                                display: "inline-block", marginInlineStart: "8px",
                                fontSize: "9px", fontWeight: 800, padding: "2px 7px",
                                borderRadius: "99px", background: "rgba(245,158,11,0.15)",
                                border: "1px solid rgba(245,158,11,0.4)", color: "#b45309",
                                verticalAlign: "middle",
                              }}>{getServerLocale() === "ar" ? "📝 معدل" : "📝 Revised"}</span>
                            )}
                          </td>
                          <td><span className="badge">{row.unit}</span></td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{
                              fontSize: "12px",
                              fontWeight: "bold",
                              color: "var(--warning)",
                              backgroundColor: "rgba(245, 158, 11, 0.15)",
                              border: "1px solid var(--warning)",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              display: "inline-block"
                            }}>
                              {row.moq} {row.unit}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {isTiered ? (
                              /* Tier price grid */
                              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                                {tierPrices.map((t, i) => (
                                  <div key={t.label} style={{ textAlign: "center", minWidth: "56px" }}>
                                    <div style={{ fontSize: "9px", fontWeight: 800, color: TIER_COLORS[i], textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.label}</div>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: TIER_COLORS[i] }}>{formatCurrency(t.price)}</div>
                                    <div style={{ fontSize: "8px", color: "var(--text-muted)" }}>{t.range} {row.unit}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* Standard min / max */
                              <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center" }}>
                                <div style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{getServerLocale() === "ar" ? "الأدنى" : "Min"}</div>
                                  <strong style={{ fontSize: "15px", color: "var(--success)" }}>{formatCurrency(row.sell_min)}</strong>
                                </div>
                                <span style={{ color: "var(--text-dim)" }}>—</span>
                                <div style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{getServerLocale() === "ar" ? "الأقصى" : "Max"}</div>
                                  <strong style={{ fontSize: "15px", color: "var(--primary)" }}>{formatCurrency(row.sell_max)}</strong>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    );
  }

  // ── Shared data for SC + WH ──
  const categories   = getCategories();
  const items        = getItems();
  const suppliers    = getSuppliers();
  const priceEntries = getAllPriceEntries();

  // ── SC: insights data ──
  const salesCatalog   = role === "SC" ? getSalesCatalog(month) : [];
  const reviewData     = role === "SC" ? getMonthlyReviewData(month) : [];
  const recentUpdates  = role === "SC" ? getRecentPriceUpdates(month, 20) : [];

  // Category progress stats
  const categoryStats = role === "SC" ? categories.map(cat => {
    const catItems  = items.filter(i => i.active !== 0 && i.category_id === cat.id);
    const pricedIds = new Set(salesCatalog.filter(r => r.sell_min !== null).map(r => r.item_id));
    const priced    = catItems.filter(i => pricedIds.has(i.id)).length;
    return {
      id: cat.id, name: cat.name,
      totalItems: catItems.length, pricedItems: priced,
      pct: catItems.length > 0 ? Math.round(priced / catItems.length * 100) : 0,
    };
  }).filter(c => c.totalItems > 0) : [];

  // Supplier activity
  const monthEntries    = role === "SC" ? priceEntries.filter(pe => pe.month === month) : [];
  const supplierStats   = role === "SC" ? suppliers
    .map(s => ({ id: s.id, name: (s as any).fame_name || s.name, quotesThisMonth: monthEntries.filter(pe => pe.supplier_id === s.id).length }))
    .filter(s => s.quotesThisMonth > 0)
    .sort((a, b) => b.quotesThisMonth - a.quotesThisMonth) : [];

  // KPI totals
  const totalActiveItems   = items.filter(i => i.active !== 0).length;
  const pricedCount        = new Set(salesCatalog.filter(r => r.sell_min !== null).map(r => r.item_id)).size;
  const quotesThisMonth    = monthEntries.length;
  const suppliersThisMonth = new Set(monthEntries.map(pe => pe.supplier_id)).size;

  // ── WH: collection overview ──
  const whOverview = role === "WH" ? getWHCollectionOverview(month) : null;


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
                  {searchParams?.simulate === "true" ? t("dash.stopSimulation") : t("dash.simulateDate")}
                </a>
              )}
            </div>
          )
        }
      />


      {/* ════════════════════════════════════════════════════════════
           SC: OVERVIEW DASHBOARD (Insights only — no pricing engine)
          ════════════════════════════════════════════════════════════ */}
      {role === "SC" && (
        <>
          {/* Action Bar — 3 equal premium cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
            <UsdPricePanel catalog={salesCatalog} month={month} username={session.displayName} />
            <MonthlyReviewModal month={month} username={session.displayName} data={reviewData} variant="dashboard" />
            <ReportGenerator role={role} username={session.displayName} dashboardMonth={month} />
          </div>

          {/* Save/Error notice */}
          {searchParams?.saved && (
            <div style={{
              padding: "10px 16px", marginBottom: "12px",
              background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.3)",
              borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px",
              fontSize: "13px", fontWeight: 700, color: "var(--success)",
            }}>
              <span>✅</span>
              <span>{getServerLocale() === "ar" ? `تم نشر الأسعار بنجاح لشهر ${formatMonthLabel(month)}.` : `Prices published successfully for ${formatMonthLabel(month)}.`}</span>
              <Link href={`/dashboard/pricing?month=${month}`} style={{ marginInlineStart: "auto", fontSize: "12px", color: "var(--primary)", textDecoration: "underline" }}>{getServerLocale() === "ar" ? "الذهاب إلى التسعير ←" : "Go to Pricing →"}</Link>
            </div>
          )}

          {/* Premium Overview Panel */}
          <ScOverviewPanel
            month={month}
            username={session.displayName}
            pricedCount={pricedCount}
            totalActiveItems={totalActiveItems}
            pendingCount={pendingCount}
            quotesThisMonth={quotesThisMonth}
            suppliersThisMonth={suppliersThisMonth}
            categoryStats={categoryStats}
            supplierStats={supplierStats}
            recentChanges={(recentUpdates as any[]).map(u => ({
              item_name: u.item_name,
              category_name: u.category_name,
              new_sell_min: u.new_sell_min,
              new_sell_max: u.new_sell_max,
              prev_sell_min: u.prev_sell_min ?? null,
              prev_sell_max: u.prev_sell_max ?? null,
              changed_at: u.changed_at,
              changed_by: u.changed_by,
              is_update: u.is_update ?? 0,
            }))}
          />
        </>
      )}


      {/* ── WH Dashboard + Purchasing Tool ─────────────────────────────── */}
      {role === "WH" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", marginBottom: "12px" }}>
          <RequestPricesBanner categories={categories} items={items} suppliers={suppliers} simulate={searchParams?.simulate === "true"} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ReportGenerator role={role} username={session.displayName} dashboardMonth={month} />
          </div>

          {/* T26: Collection Progress Overview */}
          {whOverview && (
            <>
              {/* Hero summary card */}
              <section className="panel animate-fade-in" style={{ padding: "20px 24px" }}>
                <div className="panel-header" style={{ marginBottom: "16px" }}>
                  <div>
                    <p className="eyebrow">{t("purch.collectionReport")}</p>
                    <h2>{t("purch.monthlyQuoteProgress").replace("{month}", formatMonthLabel(month))}</h2>
                  </div>
                  <span className={`badge ${
                    whOverview.totals.possible === 0 ? "" :
                    whOverview.totals.submitted === whOverview.totals.possible ? "badge-success" :
                    whOverview.totals.submitted > 0 ? "badge-warning" : "badge-danger"
                  }`}>
                    {t("purch.quotesCount")
                      .replace("{submitted}", String(whOverview.totals.submitted))
                      .replace("{possible}", String(whOverview.totals.possible))}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                  {[
                    { label: t("purch.submitted"), value: whOverview.totals.submitted, color: "var(--success)" },
                    { label: t("purch.remaining"), value: whOverview.totals.possible - whOverview.totals.submitted, color: "var(--danger)" },
                    { label: t("purch.categories"), value: whOverview.totals.categories, color: "var(--primary)" },
                    { label: t("purch.pctComplete"), value: whOverview.totals.possible > 0 ? `${Math.round((whOverview.totals.submitted / whOverview.totals.possible) * 100)}%` : "—", color: "var(--warning)" },
                  ].map(card => (
                    <div key={card.label} style={{
                      padding: "14px 16px", borderRadius: "10px",
                      background: "var(--bg-elevated)", border: "1px solid var(--border)"
                    }}>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: card.color }}>{card.value}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{card.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {whOverview.byCategory.map(cat => (
                    <div key={cat.category_name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12px" }}>
                        <span style={{ fontWeight: 600 }}>{cat.category_name}</span>
                        <span style={{ color: "var(--text-muted)" }}>{cat.submitted}/{cat.possible} ({cat.pct}%)</span>
                      </div>
                      <div style={{ height: "8px", borderRadius: "99px", background: "var(--bg-subtle)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: "99px",
                          width: `${cat.pct}%`,
                          background: cat.pct === 100 ? "var(--success)" : cat.pct > 50 ? "var(--warning)" : "var(--danger)",
                          transition: "width 0.6s ease"
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Missing quotes table */}
              {whOverview.missing.length > 0 && (
                <WhMissingQuotes
                  missing={whOverview.missing}
                  suppliers={suppliers}
                  displayName={session.displayName}
                  month={month}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* WH: Purchasing / Collection tool */}
      {role === "WH" && (
        <InteractiveDashboard
          categories={categories}
          items={items}
          suppliers={suppliers}
          priceEntries={priceEntries}
          role={role}
          month={month}
          salesCatalog={[]}
          username={session.displayName}
          initialCategoryId={searchParams?.categoryId ? Number(searchParams.categoryId) : undefined}
          initialItemId={searchParams?.itemId ? Number(searchParams.itemId) : undefined}
          saved={searchParams?.saved}
          error={searchParams?.error}
        />
      )}
    </div>
  );
}
