import { SectionIntro } from "@/components/app-shell";
import PurchasingForm from "@/components/purchasing-form";
import RecentPricesTable from "@/components/recent-prices-table";
import MonthSwitcher from "@/components/month-switcher";
import { requireRole } from "@/lib/auth";
import { getCategories, getItems, getRecentPriceEntries, getSuppliers, getPurchasingHistory, isPastMonthEntryAllowed } from "@/lib/db";
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/format";
import { getServerT, getServerLocale } from "@/lib/locale-server";

export default function PurchasingPage({ searchParams }: { searchParams?: { month?: string; saved?: string; error?: string; categoryId?: string; itemId?: string } }) {
  const session = requireRole(["WH", "SC"]);
  const t = getServerT();
  const role = session.role;
  
  const curMonth = currentMonth();
  const prevMonth = shiftMonth(curMonth, -1);
  const allowPast = isPastMonthEntryAllowed(curMonth);

  // Determine month to view
  let month = curMonth;
  if (allowPast && searchParams?.month === prevMonth) {
    month = prevMonth;
  }

  const categories = getCategories();
  const items = getItems();
  const suppliers = getSuppliers();
  const recentEntries = getRecentPriceEntries(40);
  const purchasingHistory = getPurchasingHistory(month);

  const locale = getServerLocale();
  const isAr = locale === "ar";

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={formatMonthLabel(month)}
        title={t("purch.title")}
        description={t("purch.desc")}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {allowPast && (
              <MonthSwitcher
                curMonth={curMonth}
                prevMonth={prevMonth}
                defaultValue={month}
                curLabel={`${formatMonthLabel(curMonth)} ${isAr ? "(الشهر الحالي)" : "(Current)"}`}
                prevLabel={`${formatMonthLabel(prevMonth)} ${isAr ? "(الشهر السابق)" : "(Previous)"}`}
              />
            )}
            {searchParams?.saved ? (
              <span className="badge badge-success">{t("purch.savedOk")}</span>
            ) : searchParams?.error ? (
              <span className="badge badge-danger">
                {searchParams.error === "locked" 
                  ? (isAr ? "هذا الشهر مغلق حالياً." : "Selected month is locked.")
                  : t("purch.errorMsg")}
              </span>
            ) : (
              <span className="badge">{session.displayName}</span>
            )}
          </div>
        }
      />

      {month === prevMonth && (
        <div style={{
          padding: "12px 18px",
          background: "rgba(245,158,11,0.1)",
          border: "1px solid rgba(245,158,11,0.3)",
          borderRadius: "10px",
          color: "#d97706",
          fontSize: "13px",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          ⚠️ {isAr 
            ? `إدخال أسعار الشهر السابق (${formatMonthLabel(prevMonth)}) مفتوح استثنائياً بواسطة المسؤول.` 
            : `Entries for the past month (${formatMonthLabel(prevMonth)}) are exceptionally open by the administrator.`}
        </div>
      )}

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
        initialCategoryId={searchParams?.categoryId}
        initialItemId={searchParams?.itemId}
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
          <RecentPricesTable
            entries={recentEntries}
            suppliers={suppliers}
            username={session.displayName}
            month={month}
            items={items}
            role={role}
          />
        </div>
      </section>
    </div>
  );
}
