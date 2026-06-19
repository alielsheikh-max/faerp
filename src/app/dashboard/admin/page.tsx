import { SectionIntro, StatCard } from "@/components/app-shell";
import AdminPanel from "@/components/admin-panel";
import PurgeDatabasePanel from "@/components/purge-database-panel";
import CollapsiblePanel from "@/components/collapsible-panel";
import MonthlyTierToggle from "@/components/monthly-tier-toggle";
import MonthlyTransportToggle from "@/components/monthly-transport-toggle";

import { requireRole } from "@/lib/auth";
import { getAdminSnapshot, isTierPricingEnabled, isScTransportOverrideEnabled } from "@/lib/db";
import { currentMonth, formatMonthLabel } from "@/lib/format";
import { getServerT } from "@/lib/locale-server";

export default function AdminPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const session = requireRole(["AD"]);
  const t = getServerT();
  const snapshot = getAdminSnapshot();
  const month = currentMonth();
  const tierEnabled = isTierPricingEnabled(month);
  const transportOverrideEnabled = isScTransportOverrideEnabled(month);

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
