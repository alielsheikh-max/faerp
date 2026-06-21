import { requireRole } from "@/lib/auth";
import {
  getPendingPriceChangeRequests,
  getAllPriceChangeRequests,
  getPendingPriceEntries,
  getItemSupplierPurchasingHistory,
  getItemSellingPriceHistory,
  getPreviousApprovedPrice,
} from "@/lib/db";
import { SectionIntro, StatCard } from "@/components/app-shell";
import ApprovalsHistory from "@/components/approvals-history";
import { getServerT } from "@/lib/locale-server";
import { currentMonth } from "@/lib/format";
import ApprovalsCenterClient from "@/components/approvals-center-client";

export default function SCApprovalsPage() {
  const session = requireRole(["SC"]);
  const t = getServerT();
  const month = currentMonth();

  // Load pending submissions (Step 1)
  const pendingQuotes = getPendingPriceEntries();
  const pendingQuotesWithHistory = pendingQuotes.map((q) => {
    const purchHistory = getItemSupplierPurchasingHistory(q.item_id, q.supplier_id, 4);
    const sellHistory = getItemSellingPriceHistory(q.item_id, 4);
    const prevPrice = getPreviousApprovedPrice(q.item_id, q.supplier_id, month);
    return {
      ...q,
      prevPrice,
      purchHistory,
      sellHistory,
    };
  });

  // Load pending revisions (change requests)
  const pendingRevisions = getPendingPriceChangeRequests() as any[];
  const allRevisions = getAllPriceChangeRequests(200);
  const revisionsHistory = allRevisions.filter((r) => r.status !== "pending");

  const approvedRevisionsCount = allRevisions.filter((r) => r.status === "approved").length;
  const rejectedRevisionsCount = allRevisions.filter((r) => r.status === "rejected").length;

  const totalPending = pendingQuotes.length + pendingRevisions.length;

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={t("scapp.eyebrow")}
        title={t("scapp.title")}
        description={t("scapp.desc")}
        actions={
          totalPending > 0 ? (
            <span
              className="badge badge-warning"
              style={{
                fontSize: "12px",
                padding: "5px 12px",
                animation: "pulse-ring 2s ease-out infinite",
              }}
            >
              ⏳ {t("scapp.pendingCount").replace("{count}", String(totalPending))}
            </span>
          ) : (
            <span className="badge badge-success" style={{ fontSize: "12px", padding: "5px 12px" }}>
              {t("scapp.allClear")}
            </span>
          )
        }
      />

      {/* KPI strip */}
      <section className="stat-grid">
        <StatCard
          label={t("scapp.pendingReview") + " (Quotes)"}
          value={pendingQuotes.length}
          note={t("scapp.awaitingScDecision")}
          accent="amber"
        />
        <StatCard
          label={t("scapp.pendingReview") + " (Revisions)"}
          value={pendingRevisions.length}
          note={t("scapp.awaitingScDecision")}
          accent="indigo"
        />
        <StatCard
          label={t("gen.approved") + " (Revisions)"}
          value={approvedRevisionsCount}
          note={t("scapp.pricesUpdated")}
          accent="green"
        />
        <StatCard
          label={t("gen.rejected") + " (Revisions)"}
          value={rejectedRevisionsCount}
          note={t("scapp.returnedToWh")}
          accent="red"
        />
      </section>

      {/* Tabbed Approvals Workstation */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>
              {t("scapp.actionRequired")}
            </p>
            <h2>{t("scapp.pendingRequests")}</h2>
          </div>
        </div>
        <ApprovalsCenterClient
          pendingQuotes={pendingQuotesWithHistory}
          pendingRevisions={pendingRevisions}
          username={session.displayName}
          month={month}
        />
      </section>

      {/* Revisions Review History */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>
              {t("scapp.auditLog")}
            </p>
            <h2>{t("scapp.reviewHistory")}</h2>
          </div>
          <span className="badge">
            {t("scapp.resolved").replace("{count}", String(revisionsHistory.length))}
          </span>
        </div>
        <ApprovalsHistory requests={revisionsHistory} mode="sc" />
      </section>
    </div>
  );
}
