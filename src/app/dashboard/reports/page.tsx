import { SectionIntro, StatCard } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { getCategories, getMonthlyReport } from "@/lib/db";
import { currentMonth, formatCurrency, formatDateTime, formatMonthLabel, calcTierPricesShared } from "@/lib/format";
import { getServerT } from "@/lib/locale-server";
import ClickableDetailTrigger from "@/components/clickable-detail-trigger";

export default function ReportsPage({ searchParams }: { searchParams?: { month?: string; categoryId?: string } }) {
  const session = requireRole(["SC"]);
  const t = getServerT();
  const month = searchParams?.month || currentMonth();
  const categoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const categories = getCategories();
  const report = getMonthlyReport(month, categoryId);
  const printHref = `/dashboard/reports/print?month=${encodeURIComponent(month)}${categoryId ? `&categoryId=${categoryId}` : ""}&autoprint=1`;
  const exportHref = `/dashboard/reports/export?month=${encodeURIComponent(month)}${categoryId ? `&categoryId=${categoryId}` : ""}`;

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={t("rep.eyebrow")}
        title={t("rep.title")}
        description={t("rep.desc")}
        actions={<span className="badge">{session.displayName}</span>}
      />

      <section className="stat-grid">
        <StatCard label={t("rep.quotes")}        value={report.metrics.quotes}                      note={t("rep.currentQuotes")} />
        <StatCard label={t("rep.suppliers")}     value={report.metrics.suppliers}                   note={t("rep.inReport")} />
        <StatCard label={t("rep.publishedPrices")} value={report.metrics.selling}                   note={t("rep.approved")} />
        <StatCard label={t("rep.lastUpdate")}    value={formatDateTime(report.metrics.lastUpdate)}  note={t("rep.lastTimestamp")} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{t("rep.controls")}</p>
            <h2>{formatMonthLabel(month)}</h2>
          </div>
          <div className="button-row">
            <a href={printHref} className="button button-secondary" target="_blank">{t("rep.downloadPDF")}</a>
            <a href={exportHref} className="button button-primary">{t("rep.downloadXLSX")}</a>
          </div>
        </div>
        <form method="GET" className="inline-form">
          <label className="field">
            <span>{t("rep.month")}</span>
            <input type="month" name="month" defaultValue={month} />
          </label>
          <label className="field">
            <span>{t("rep.category")}</span>
            <select name="categoryId" defaultValue={categoryId ? String(categoryId) : ""}>
              <option value="">{t("rep.allCats")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="form-actions align-end">
            <button type="submit" className="button button-primary">{t("rep.generate")}</button>
          </div>
        </form>
      </section>

      <section className="dual-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{t("rep.supplierComp")}</p>
              <h2>{t("rep.latestMarket")}</h2>
            </div>
            <span className="badge">{report.comparisonRows.length} {t("rep.itemCol")}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("rep.catCol")}</th>
                  <th>{t("rep.itemCol")}</th>
                  <th>{t("rep.unitCol")}</th>
                  <th>{t("rep.quotedSuppliers")}</th>
                </tr>
              </thead>
              <tbody>
                {report.comparisonRows.map((row) => (
                  <tr key={row.itemId}>
                    <td>{row.categoryName}</td>
                    <td>
                      <ClickableDetailTrigger
                        type="item"
                        id={row.itemId}
                        className="clickable-detail-trigger"
                      >
                        {row.itemName}
                      </ClickableDetailTrigger>
                    </td>
                    <td>{row.unit}</td>
                    <td>
                      <div className="report-chip-wrap">
                        {Object.entries(row.quotes).map(([supId, q]) => (
                          <ClickableDetailTrigger
                            key={`${row.itemId}-${supId}`}
                            type="supplier"
                            id={Number(supId)}
                            style={{ cursor: "pointer" }}
                            className="report-chip"
                          >
                            {q.supplierName}: {formatCurrency(q.price)}
                          </ClickableDetailTrigger>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{t("rep.publishSummary")}</p>
              <h2>{t("rep.approvedSelling")}</h2>
            </div>
            <span className="badge">{report.monthlySellingPrices.length} {t("rep.approvedRows")}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("rep.itemCol")}</th>
                  <th>{t("rep.strategy")}</th>
                  <th colSpan={2}>{t("rep.sellMin")} / Bracket Prices</th>
                </tr>
              </thead>
              <tbody>
                {report.monthlySellingPrices.map((row) => (
                  <tr key={row.item_id}>
                    <td>
                      <ClickableDetailTrigger
                        type="item"
                        id={row.item_id}
                        className="clickable-detail-trigger"
                      >
                        {row.item_name}
                      </ClickableDetailTrigger>
                    </td>
                    <td>
                      {row.tier_pricing_enabled === 1 && row.is_tiered === 1 ? (
                        <span className="badge" style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)", fontWeight: 700 }}>
                          ⚡ TIERS
                        </span>
                      ) : row.is_tiered === 2 ? (
                        <span className="badge" style={{ background: "rgba(245,158,11,0.15)", color: "#d97706", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 700 }}>
                          🔒 FIXED
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "rgba(16,185,129,0.15)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 700 }}>
                          ↕ MIN/MAX
                        </span>
                      )}
                    </td>
                    <td colSpan={2}>
                      {row.tier_pricing_enabled === 1 && row.is_tiered === 1 ? (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {calcTierPricesShared(row).map(tp => (
                            <span key={tp.label} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", background: "var(--bg-subtle)", border: "1.5px solid var(--border-light)", color: "var(--text-primary)" }}>
                              <strong>{tp.label}:</strong> {formatCurrency(tp.price)}
                            </span>
                          ))}
                        </div>
                      ) : row.is_tiered === 2 ? (
                        <span style={{ fontWeight: 800, color: "#d97706" }}>
                          🔒 {formatCurrency(row.sell_min)}
                        </span>
                      ) : (
                        <span>
                          <strong style={{ color: "#10b981" }}>{formatCurrency(row.sell_min)}</strong>
                          <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>–</span>
                          <strong style={{ color: "#6366f1" }}>{formatCurrency(row.sell_max)}</strong>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{t("rep.riskWatch")}</p>
            <h2>{t("rep.sameMonth")}</h2>
          </div>
          <span className="badge">{report.volatilityRows.length} {t("rep.alerts")}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("rep.itemCol")}</th>
                <th>{t("gen.supplier")}</th>
                <th>{t("rep.updates")}</th>
                <th>{t("rep.low")}</th>
                <th>{t("rep.high")}</th>
                <th>{t("rep.lastChange")}</th>
              </tr>
            </thead>
            <tbody>
              {report.volatilityRows.map((row, i) => (
                <tr key={`${row.item_name}-${row.supplier_name}-${i}`}>
                  <td>
                    <ClickableDetailTrigger
                      type="item"
                      id={row.item_id}
                      className="clickable-detail-trigger"
                    >
                      {row.item_name}
                    </ClickableDetailTrigger>
                  </td>
                  <td>
                    <ClickableDetailTrigger
                      type="supplier"
                      id={row.supplier_id}
                      className="clickable-detail-trigger"
                    >
                      {row.supplier_name}
                    </ClickableDetailTrigger>
                  </td>
                  <td>{row.updates}</td>
                  <td>{formatCurrency(row.low_price)}</td>
                  <td>{formatCurrency(row.high_price)}</td>
                  <td>{formatDateTime(row.last_change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
