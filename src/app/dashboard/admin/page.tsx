import { SectionIntro, StatCard } from "@/components/app-shell";
import AdminPanel from "@/components/admin-panel";
import PurgeDatabasePanel from "@/components/purge-database-panel";
import CollapsiblePanel from "@/components/collapsible-panel";
import CsvImportPanel from "@/components/csv-import-panel";
import MonthlyTierToggle from "@/components/monthly-tier-toggle";
import MonthlyTransportToggle from "@/components/monthly-transport-toggle";
import MonthlyPastEntryToggle from "@/components/monthly-past-entry-toggle";

import { requireRole } from "@/lib/auth";
import { getAdminSnapshot, isTierPricingEnabled, isScTransportOverrideEnabled, isPastMonthEntryAllowed } from "@/lib/db";
import { currentMonth, formatMonthLabel } from "@/lib/format";
import { getServerT, getServerLocale } from "@/lib/locale-server";

export default function AdminPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const session = requireRole(["AD"]);
  const t = getServerT();
  const locale = getServerLocale();
  const isAr = locale === "ar";
  const snapshot = getAdminSnapshot();
  const month = currentMonth();
  const tierEnabled = isTierPricingEnabled(month);
  const transportOverrideEnabled = isScTransportOverrideEnabled(month);
  const pastMonthEntryAllowed = isPastMonthEntryAllowed(month);

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={t("admin.eyebrow")}
        title={t("admin.title")}
        description={t("admin.desc")}
        actions={
          searchParams?.success ? (
            <span className="badge badge-success">{searchParams.success}</span>
          ) : searchParams?.error ? (
            <span className="badge badge-danger">{searchParams.error}</span>
          ) : (
            <span className="badge badge-strong">{session.displayName}</span>
          )
        }
      />

      <section className="stat-grid">
        <StatCard label={t("admin.activeUsers")}  value={snapshot.users.length}      note={t("admin.erpAccounts")} />
        <StatCard label={t("admin.categories")}   value={snapshot.categories.length} note={t("admin.managedCats")} />
        <StatCard label={t("admin.suppliersReg")} value={snapshot.suppliers.length}  note={t("admin.supplierRecords")} />
        <StatCard label={t("admin.catalogItems")} value={snapshot.items.length}      note={t("admin.tradingItems")} />
      </section>

      {/* ── Quick Shortcuts ──────────────────────────────────────────────── */}
      <section className="panel animate-fade-in" style={{ padding: "20px 24px" }}>
        <div style={{ marginBottom: "14px" }}>
          <p className="eyebrow" style={{ textTransform: "uppercase", fontSize: "11px", fontWeight: 700, color: "var(--primary)" }}>
            {isAr ? "اختصارات التحكم" : "Control Shortcuts"}
          </p>
          <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "4px 0 0" }}>
            {isAr ? "الإجراءات السريعة" : "Quick Actions"}
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {[
            {
              title: isAr ? "إضافة مورد جديد" : "Onboard Supplier",
              desc: isAr ? "تسجيل مورد جديد وتحديد تفضيلاته فورا" : "Onboard a new supplier & set preferences",
              icon: "🏭",
              link: "/dashboard/admin/suppliers?addSupplier=true",
              color: "rgba(99,102,241,0.08)",
              borderColor: "rgba(99,102,241,0.2)",
              iconBg: "rgba(99,102,241,0.15)",
              iconColor: "#6366f1"
            },
            {
              title: isAr ? "إضافة صنف جديد" : "Add Catalog Item",
              desc: isAr ? "إنشاء منتج جديد وتحديد الحد الأدنى وتكلفة النقل" : "Create item, specify MOQ & transport",
              icon: "📦",
              link: "/dashboard/admin/items?addItem=true",
              color: "rgba(16,185,129,0.08)",
              borderColor: "rgba(16,185,129,0.2)",
              iconBg: "rgba(16,185,129,0.15)",
              iconColor: "#10b981"
            },
            {
              title: isAr ? "إضافة فئة جديدة" : "Create Category",
              desc: isAr ? "إنشاء فئة أو تصنيف منتجات جديد للمستودع" : "Create a new product group / category",
              icon: "📁",
              link: "/dashboard/admin/items?addCategory=true",
              color: "rgba(245,158,11,0.08)",
              borderColor: "rgba(245,158,11,0.2)",
              iconBg: "rgba(245,158,11,0.15)",
              iconColor: "#d97706"
            }
          ].map((action) => (
            <a
              key={action.title}
              href={action.link}
              className="quick-action-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "16px",
                borderRadius: "14px",
                border: `1.5px solid ${action.borderColor}`,
                background: action.color,
                textDecoration: "none",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{
                width: "44px", height: "44px", borderRadius: "10px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px", background: action.iconBg, color: action.iconColor, flexShrink: 0
              }}>
                {action.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: "14px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                  {action.title}
                </h4>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "3px 0 0", lineHeight: 1.3 }}>
                  {action.desc}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Monthly Pricing Policy ───────────────────────────────────────── */}
      <section className="panel animate-fade-in">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Monthly Configuration</p>
            <h2>Pricing Policy — {formatMonthLabel(month)}</h2>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span className={`badge ${tierEnabled ? "badge-success" : ""}`} style={{ fontSize: "11px" }}>
              {tierEnabled ? "⚡ Tiers ON" : "○ Tiers OFF"}
            </span>
            <span className={`badge ${transportOverrideEnabled ? "badge-success" : ""}`} style={{ fontSize: "11px" }}>
              {transportOverrideEnabled ? "🚚 Trans. Override ON" : "🚚 Trans. Override OFF"}
            </span>
            <span className={`badge ${pastMonthEntryAllowed ? "badge-success" : ""}`} style={{ fontSize: "11px" }}>
              {pastMonthEntryAllowed ? "🔓 Past Month ON" : "🔒 Past Month OFF"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Toggle 1 — Volume Tiers */}
          <div style={{ flex: "0 0 auto", minWidth: "220px" }}>
            <MonthlyTierToggle month={month} initialEnabled={tierEnabled} />
          </div>

          {/* Toggle 2 — SC Transport Override */}
          <div style={{ flex: "0 0 auto", minWidth: "220px" }}>
            <MonthlyTransportToggle month={month} initialEnabled={transportOverrideEnabled} />
          </div>

          {/* Toggle 3 — Past Month Entry */}
          <div style={{ flex: "0 0 auto", minWidth: "220px" }}>
            <MonthlyPastEntryToggle month={month} initialEnabled={pastMonthEntryAllowed} />
          </div>

          {/* Explanation */}
          <div style={{
            flex: 1, minWidth: "240px",
            padding: "14px 16px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-light)",
            borderRadius: "10px",
            fontSize: "12px",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}>
            <div style={{ fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px", fontSize: "13px" }}>
              Active SC capabilities this month
            </div>
            <ul style={{ margin: 0, paddingInlineStart: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li style={{ color: tierEnabled ? "var(--success)" : "var(--text-muted)" }}>
                {tierEnabled ? "✓" : "○"} Volume tier discounts per item
              </li>
              <li style={{ color: tierEnabled ? "var(--success)" : "var(--text-muted)" }}>
                {tierEnabled ? "✓" : "○"} Switch item strategy (tier ↔ fixed min/max)
              </li>
              <li style={{ color: transportOverrideEnabled ? "var(--success)" : "var(--text-muted)" }}>
                {transportOverrideEnabled ? "✓" : "○"} Override transport fee per item this month
              </li>
              <li style={{ color: pastMonthEntryAllowed ? "var(--success)" : "var(--text-muted)" }}>
                {pastMonthEntryAllowed ? "✓" : "○"} Allow price entries for the previous calendar month
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── User Administration CRUD ────────────────────────────────────────── */}
      <AdminPanel
        users={snapshot.users}
        categories={snapshot.categories}
        suppliers={snapshot.suppliers}
        items={snapshot.items}
        showOnly="users"
        role={session.role}
      />

      {/* ── Historical Prices Import ────────────────────────────── */}
      <CollapsiblePanel
        id="historical-csv-import"
        eyebrow="Data Import"
        title="Import Historical Price Entries via CSV"
      >
        <CsvImportPanel type="historical_prices" />
      </CollapsiblePanel>

      {/* ── Dangerous Zone / Database Purge ────────────────────────────── */}
      <CollapsiblePanel
        id="purge"
        eyebrow="Dangerous Zone"
        title="Purge Database"
        badgeText="Destructive Action"
        badgeClass="badge-danger"
      >
        <PurgeDatabasePanel />
      </CollapsiblePanel>
    </div>
  );
}
