import { requireRole } from "@/lib/auth";
import { getPendingPriceChangeRequests, getAllPriceChangeRequests } from "@/lib/db";
import { SectionIntro, StatCard } from "@/components/app-shell";
import ApprovalsHistory from "@/components/approvals-history";
import { getServerT } from "@/lib/locale-server";

export default function SCApprovalsPage() {
  const session = requireRole(["SC"]);
  const t = getServerT();

  const pending = getPendingPriceChangeRequests();
  const all     = getAllPriceChangeRequests(200);
  const history = all.filter(r => r.status !== "pending");

  const approvedCount = all.filter(r => r.status === "approved").length;
  const rejectedCount = all.filter(r => r.status === "rejected").length;

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={t("scapp.eyebrow")}
        title={t("scapp.title")}
        description={t("scapp.desc")}
        actions={
          pending.length > 0 ? (
            <span className="badge badge-warning" style={{ fontSize: "12px", padding: "5px 12px", animation: "pulse-ring 2s ease-out infinite" }}>
              ⏳ {t("scapp.pendingCount").replace("{count}", String(pending.length))}
            </span>
          ) : (
            <span className="badge badge-success" style={{ fontSize: "12px", padding: "5px 12px" }}>{t("scapp.allClear")}</span>
          )
        }
      />

      {/* KPI strip */}
      <section className="stat-grid">
        <StatCard label={t("scapp.pendingReview")}  value={pending.length}   note={t("scapp.awaitingScDecision")}   accent="amber" />
        <StatCard label={t("gen.approved")}        value={approvedCount}    note={t("scapp.pricesUpdated")}          accent="green" />
        <StatCard label={t("gen.rejected")}        value={rejectedCount}    note={t("scapp.returnedToWh")}          accent="red" />
        <StatCard label={t("scapp.totalRequests")}  value={all.length}       note={t("scapp.allTime")}                accent="indigo" />
      </section>

      {/* ── Pending Queue — now handled in Notifications ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>{t("scapp.actionRequired")}</p>
            <h2>{t("scapp.pendingRequests")}</h2>
          </div>
          {pending.length > 0 && (
            <span className="badge badge-warning">{t("scapp.awaitingReview").replace("{count}", String(pending.length))}</span>
          )}
        </div>
        {pending.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
            <span style={{ fontSize: "32px", display: "block", marginBottom: "10px" }}>✅</span>
            {t("scapp.noPendingRequests")}
          </div>
        ) : (
          <div style={{
            padding: "20px 24px", borderRadius: "12px",
            background: "rgba(245,158,11,0.06)", border: "1.5px solid rgba(245,158,11,0.3)",
            display: "flex", alignItems: "center", gap: "16px",
          }}>
            <span style={{ fontSize: "32px" }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>
                {t("scapp.pendingRequestBannerTitle").replace("{count}", String(pending.length))}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {t("scapp.pendingRequestBannerDesc")}
              </div>
            </div>
            <a href="/dashboard/notifications" style={{
              padding: "10px 20px", borderRadius: "99px",
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              color: "#fff", fontWeight: 800, fontSize: "13px",
              textDecoration: "none", whiteSpace: "nowrap",
            }}>
              {t("scapp.goToNotifications")}
            </a>
          </div>
        )}
      </section>

      {/* ── History ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>{t("scapp.auditLog")}</p>
            <h2>{t("scapp.reviewHistory")}</h2>
          </div>
          <span className="badge">{t("scapp.resolved").replace("{count}", String(history.length))}</span>
        </div>
        <ApprovalsHistory requests={history} mode="sc" />
      </section>
    </div>
  );
}
