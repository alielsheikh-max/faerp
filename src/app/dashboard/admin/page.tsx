import { SectionIntro, StatCard } from "@/components/app-shell";
import AdminPanel from "@/components/admin-panel";
import MarginFloorsPanel from "@/components/margin-floors-panel";
import CategoryMarkupPanel from "@/components/category-markup-panel";
import { requireRole } from "@/lib/auth";
import {
  getAdminSnapshot, getMarginFloors, getItems,
  countPendingRequests,
} from "@/lib/db";
import { getServerT } from "@/lib/locale-server";
import { formatMonthLabel, currentMonth as getMonth } from "@/lib/format";
import Link from "next/link";

export default function AdminPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const session = requireRole(["SC"]);
  const t = getServerT();
  const snapshot = getAdminSnapshot();
  const floors = getMarginFloors();
  const allItems = getItems();
  const pendingCount = countPendingRequests();
  const month = getMonth();

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

      {/* ── Price Change Requests — link to dedicated page ───────────────── */}
      <section className="panel" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <p className="eyebrow" style={{ fontSize: "10px", marginBottom: "4px" }}>WH → SC Workflow</p>
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Price Change Approvals</h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Review incoming price change requests from WH Purchasing.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {pendingCount > 0 ? (
              <span className="badge badge-warning" style={{ fontSize: "12px", padding: "5px 12px", animation: "pulse-ring 2s ease-out infinite" }}>
                ⏳ {pendingCount} pending
              </span>
            ) : (
              <span className="badge badge-success" style={{ fontSize: "12px", padding: "5px 12px" }}>✓ All clear</span>
            )}
            <Link href="/dashboard/approvals" className="button button-primary" style={{ padding: "9px 18px", fontSize: "13px" }}>
              {pendingCount > 0 ? `Review ${pendingCount} Request${pendingCount > 1 ? "s" : ""} →` : "View Approvals →"}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Category Bulk Markup ─────────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>Bulk Pricing</p>
            <h2>Apply Category Markup — {formatMonthLabel(month)}</h2>
          </div>
          <span className="badge" style={{ fontSize: "10px" }}>SC Manager only</span>
        </div>
        <CategoryMarkupPanel
          categories={snapshot.categories.map(c => ({ id: c.id, name: c.name }))}
          month={month}
          username={session.displayName}
        />
      </section>

      {/* ── Master data CRUD ────────────────────────────────────────────────── */}
      <AdminPanel
        users={snapshot.users}
        categories={snapshot.categories}
        suppliers={snapshot.suppliers}
        items={snapshot.items}
      />

      {/* ── Margin Floor Management ─────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>Pricing Controls</p>
            <h2>Margin Floor Rules</h2>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="badge badge-warning">{floors.length} active rules</span>
            <span className="badge" style={{ fontSize: "10px" }}>SC Manager only</span>
          </div>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "4px" }}>
          Margin floors set the <strong>minimum markup percentage</strong> that must be applied when
          publishing selling prices. Any attempt to save a price below the floor will be blocked.
          Item-level rules take precedence over category-level rules.
        </p>
        <MarginFloorsPanel
          floors={floors}
          categories={snapshot.categories.map((c) => ({ id: c.id, name: c.name }))}
          items={allItems.map((i) => ({
            id: i.id,
            name: i.name,
            category_id: i.category_id,
            category_name: i.category_name,
          }))}
          username={session.displayName}
        />
      </section>
    </div>
  );
}
