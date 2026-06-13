import { SectionIntro } from "@/components/app-shell";
import PurchasingForm from "@/components/purchasing-form";
import { requireRole } from "@/lib/auth";
import { getCategories, getItems, getRecentPriceEntries, getSuppliers, getPurchasingHistory } from "@/lib/db";
import { currentMonth, formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import { getServerT } from "@/lib/locale-server";

export default function PurchasingPage({ searchParams }: { searchParams?: { month?: string; saved?: string; error?: string } }) {
  const session = requireRole(["WH", "SC"]);
  const t = getServerT();
  const role = session.role;
  const month = currentMonth();

  const categories = getCategories();
  const items = getItems();
  const suppliers = getSuppliers();
  const recentEntries = getRecentPriceEntries(20);
  const purchasingHistory = getPurchasingHistory(month);

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={formatMonthLabel(month)}
        title={t("purch.title")}
        description={t("purch.desc")}
        actions={
          searchParams?.saved ? (
            <span className="badge badge-success">{t("purch.savedOk")}</span>
          ) : searchParams?.error ? (
            <span className="badge badge-danger">{t("purch.errorMsg")}</span>
          ) : (
            <span className="badge">{session.displayName}</span>
          )
        }
      />

      {role === "WH" && (
        <div className="restriction-info-banner">
          <div>
            <strong>{t("purch.authBanner")}</strong> {t("purch.authBannerDesc")}
          </div>
        </div>
      )}

      <PurchasingForm
        categories={categories}
        items={items}
        suppliers={suppliers}
        month={month}
        role={role}
        displayName={session.displayName}
        purchasingHistory={purchasingHistory}
        wasSaved={!!searchParams?.saved}
      />

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{t("purch.latestActivity")}</p>
            <h2>{t("purch.recentPrices")}</h2>
          </div>
          <span className="badge">{recentEntries.length} {t("purch.rows")}</span>
        </div>

        <div className="table-wrap table-wrap-short">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("purch.month")}</th>
                <th>{t("purch.category")}</th>
                <th>{t("purch.item")}</th>
                <th>{t("gen.supplier")}</th>
                <th>{t("purch.price")}</th>
                <th>{t("purch.capturedBy")}</th>
                <th>{t("purch.recordedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                    {t("purch.noEntries")}
                  </td>
                </tr>
              ) : (
                recentEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td><span className="badge">{entry.month}</span></td>
                    <td><span className="badge badge-strong">{entry.category_name}</span></td>
                    <td><strong>{entry.item_name}</strong></td>
                    <td>{entry.supplier_name}</td>
                    <td><strong style={{ color: "var(--success)" }}>{formatCurrency(entry.price)}</strong></td>
                    <td><div className="cell-stack"><strong>{entry.collected_by}</strong></div></td>
                    <td>{formatDateTime(entry.recorded_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
