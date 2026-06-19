import { requireRole } from "@/lib/auth";
import { getPendingPriceChangeRequests, getAllPriceChangeRequests } from "@/lib/db";
import { SectionIntro, StatCard } from "@/components/app-shell";
import ApprovalsHistory from "@/components/approvals-history";

export default function SCApprovalsPage() {
  const session = requireRole(["SC"]);

  const pending = getPendingPriceChangeRequests();
  const all     = getAllPriceChangeRequests(200);
  const history = all.filter(r => r.status !== "pending");

  const approvedCount = all.filter(r => r.status === "approved").length;
  const rejectedCount = all.filter(r => r.status === "rejected").length;

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="WH → SC Workflow"
        title="Price Change Approvals"
        description="Review incoming price change requests from WH. Approve to update the market data, reject with a note to inform WH."
        actions={
          pending.length > 0 ? (
            <span className="badge badge-warning" style={{ fontSize: "12px", padding: "5px 12px", animation: "pulse-ring 2s ease-out infinite" }}>
              ⏳ {pending.length} pending
            </span>
          ) : (
            <span className="badge badge-success" style={{ fontSize: "12px", padding: "5px 12px" }}>✓ All clear</span>
          )
        }
      />

      {/* KPI strip */}
      <section className="stat-grid">
        <StatCard label="Pending Review"  value={pending.length}   note="Awaiting SC decision"   accent="amber" />
        <StatCard label="Approved"        value={approvedCount}    note="Prices updated"          accent="green" />
        <StatCard label="Rejected"        value={rejectedCount}    note="Returned to WH"          accent="red" />
        <StatCard label="Total Requests"  value={all.length}       note="All time"                accent="indigo" />
      </section>

      {/* ── Pending Queue — now handled in Notifications ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>Action Required</p>
            <h2>Pending Requests</h2>
          </div>
          {pending.length > 0 && (
            <span className="badge badge-warning">{pending.length} awaiting review</span>
          )}
        </div>
        {pending.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
            <span style={{ fontSize: "32px", display: "block", marginBottom: "10px" }}>✅</span>
            No pending requests. All clear.
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
                {pending.length} pending request{pending.length > 1 ? "s" : ""} — review them in Notifications
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Price change requests are now reviewed inline in the Notifications page with approve/reject buttons.
              </div>
            </div>
            <a href="/dashboard/notifications" style={{
              padding: "10px 20px", borderRadius: "99px",
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              color: "#fff", fontWeight: 800, fontSize: "13px",
              textDecoration: "none", whiteSpace: "nowrap",
            }}>
              Go to Notifications →
            </a>
          </div>
        )}
      </section>

      {/* ── History ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>Audit Log</p>
            <h2>Review History</h2>
          </div>
          <span className="badge">{history.length} resolved</span>
        </div>
        <ApprovalsHistory requests={history} mode="sc" />
      </section>
    </div>
  );
}
