import { SectionIntro, StatCard } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { getCategories, getMonthlyReport } from "@/lib/db";
import { currentMonth, formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import { getServerT } from "@/lib/locale-server";

export default function ReportsPage({ searchParams }: { searchParams?: { month?: string; categoryId?: string } }) {
  const session = requireRole(["SC"]);
  const t = getServerT();
  const month = searchParams?.month || currentMonth();
  const categoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const categories = getCategories();
  const report = getMonthlyReport(month, categoryId);
  const printHref = `/dashboard/reports/print?month=${encodeURIComponent(month)}${categoryId ? `&categoryId=${categoryId}` : ""}`;
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
            <a href={printHref} className="button button-secondary" target="_blank">{t("rep.openPrint")}</a>
            <a href={exportHref} className="button button-primary">{t("rep.exportCSV")}</a>
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
                    <td>{row.itemName}</td>
                    <td>{row.unit}</td>
                    <td>
                      <div className="report-chip-wrap">
                        {Object.values(row.quotes).map((q) => (
                          <span key={`${row.itemId}-${q.supplierName}`} className="report-chip">
                            {q.supplierName}: {formatCurrency(q.price)}
                          </span>
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
                  <th>{t("rep.sellMin")}</th>
                  <th>{t("rep.sellMax")}</th>
                </tr>
              </thead>
              <tbody>
                {report.monthlySellingPrices.map((row) => (
                  <tr key={row.item_id}>
                    <td>{row.item_name}</td>
                    <td>{row.strategy?.toUpperCase()}</td>
                    <td>{formatCurrency(row.sell_min)}</td>
                    <td>{formatCurrency(row.sell_max)}</td>
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
                  <td>{row.item_name}</td>
                  <td>{row.supplier_name}</td>
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
