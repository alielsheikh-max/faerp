import { SectionIntro, StatCard } from "@/components/app-shell";
import AdminPanel from "@/components/admin-panel";
import PurgeDatabasePanel from "@/components/purge-database-panel";
import CollapsiblePanel from "@/components/collapsible-panel";

import { requireRole } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/db";
import { getServerT } from "@/lib/locale-server";

export default function AdminPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const session = requireRole(["AD"]);
  const t = getServerT();
  const snapshot = getAdminSnapshot();

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
