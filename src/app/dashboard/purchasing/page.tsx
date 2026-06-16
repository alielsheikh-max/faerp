import { SectionIntro } from "@/components/app-shell";
import PurchasingForm from "@/components/purchasing-form";
import RecentPricesTable from "@/components/recent-prices-table";
import { requireRole } from "@/lib/auth";
import { getCategories, getItems, getRecentPriceEntries, getSuppliers, getPurchasingHistory } from "@/lib/db";
import { currentMonth, formatMonthLabel } from "@/lib/format";
import { getServerT } from "@/lib/locale-server";

export default function PurchasingPage({ searchParams }: { searchParams?: { month?: string; saved?: string; error?: string } }) {
  const session = requireRole(["WH", "SC"]);
  const t = getServerT();
  const role = session.role;
  const month = currentMonth();

  const categories = getCategories();
  const items = getItems();
  const suppliers = getSuppliers();
  const recentEntries = getRecentPriceEntries(40);
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

        <div style={{ padding: "0 0 4px" }}>
          <RecentPricesTable entries={recentEntries} />
        </div>
      </section>
    </div>
  );
}
