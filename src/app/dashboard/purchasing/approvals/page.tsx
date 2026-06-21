import { requireRole } from "@/lib/auth";
import { getPriceChangeRequestsByUser } from "@/lib/db";
import { SectionIntro, StatCard } from "@/components/app-shell";
import ApprovalsHistory from "@/components/approvals-history";
import { getServerT } from "@/lib/locale-server";

export default function WHApprovalsPage() {
  const session = requireRole(["WH", "SC"]);
  const t = getServerT();

  const all      = getPriceChangeRequestsByUser(session.displayName);
  const pending  = all.filter(r => r.status === "pending");
  const approved = all.filter(r => r.status === "approved");
  const rejected = all.filter(r => r.status === "rejected");

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={t("whapp.eyebrow")}
        title={t("whapp.title")}
        description={t("whapp.desc")}
        actions={
          pending.length > 0 ? (
            <span className="badge badge-warning" style={{ fontSize: "12px", padding: "5px 12px", animation: "pulse-ring 2s ease-out infinite" }}>
              ⏳ {t("whapp.awaitingApproval").replace("{count}", String(pending.length))}
            </span>
          ) : all.length > 0 ? (
            <span className="badge badge-success" style={{ fontSize: "12px", padding: "5px 12px" }}>{t("whapp.nothingPending")}</span>
          ) : (
            <span className="badge" style={{ fontSize: "12px", padding: "5px 12px" }}>{session.displayName}</span>
          )
        }
      />

      {/* KPI strip */}
      <section className="stat-grid">
        <StatCard label={t("gen.pending")}   value={pending.length}   note={t("whapp.pendingNote")}  accent="amber" />
        <StatCard label={t("gen.approved")}  value={approved.length}  note={t("whapp.approvedNote")}  accent="green" />
        <StatCard label={t("gen.rejected")}  value={rejected.length}  note={t("whapp.rejectedNote")}  accent="red" />
        <StatCard label={t("whapp.submissionLog")} value={all.length}      note={t("whapp.totalSentNote")}         accent="indigo" />
      </section>

      {/* ── Pending requests — read-only for WH ── */}
      {pending.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow" style={{ fontSize: "10px" }}>{t("whapp.awaitingReview")}</p>
              <h2>{t("whapp.pendingRequests")}</h2>
            </div>
            <span className="badge badge-warning">{t("whapp.inQueue").replace("{count}", String(pending.length))}</span>
          </div>
          <ApprovalsHistory requests={pending} mode="wh-pending" />
        </section>
      )}

      {/* ── Full history ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>{t("whapp.submissionLog")}</p>
            <h2>{t("whapp.allMyRequests")}</h2>
          </div>
          <span className="badge">{t("whapp.total").replace("{count}", String(all.length))}</span>
        </div>
        {all.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
            <span style={{ fontSize: "32px", display: "block", marginBottom: "10px" }}>📋</span>
            {t("whapp.noRequestsTitle")}
            <br />
            <span style={{ fontSize: "12px", marginTop: "6px", display: "block" }}>
              {t("whapp.noRequestsDesc")}
            </span>
          </div>
        ) : (
          <ApprovalsHistory requests={all} mode="wh" />
        )}
      </section>
    </div>
  );
}
