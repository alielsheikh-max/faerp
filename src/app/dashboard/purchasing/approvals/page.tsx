import { requireRole } from "@/lib/auth";
import { getPriceChangeRequestsByUser } from "@/lib/db";
import { SectionIntro, StatCard } from "@/components/app-shell";
import ApprovalsHistory from "@/components/approvals-history";

export default function WHApprovalsPage() {
  const session = requireRole(["WH", "SC"]);

  const all      = getPriceChangeRequestsByUser(session.displayName);
  const pending  = all.filter(r => r.status === "pending");
  const approved = all.filter(r => r.status === "approved");
  const rejected = all.filter(r => r.status === "rejected");

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="My Submissions"
        title="My Price Change Requests"
        description="Track all price change requests you've submitted. Pending requests are waiting for SC Manager review. Approved requests have been written into the system."
        actions={
          pending.length > 0 ? (
            <span className="badge badge-warning" style={{ fontSize: "12px", padding: "5px 12px", animation: "pulse-ring 2s ease-out infinite" }}>
              ⏳ {pending.length} awaiting approval
            </span>
          ) : all.length > 0 ? (
            <span className="badge badge-success" style={{ fontSize: "12px", padding: "5px 12px" }}>✓ Nothing pending</span>
          ) : (
            <span className="badge" style={{ fontSize: "12px", padding: "5px 12px" }}>{session.displayName}</span>
          )
        }
      />

      {/* KPI strip */}
      <section className="stat-grid">
        <StatCard label="Pending"   value={pending.length}   note="Awaiting SC approval"  accent="amber" />
        <StatCard label="Approved"  value={approved.length}  note="Price updated"          accent="green" />
        <StatCard label="Rejected"  value={rejected.length}  note="See SC note below"      accent="red" />
        <StatCard label="Total Sent" value={all.length}      note="All submissions"         accent="indigo" />
      </section>

      {/* ── Pending requests — read-only for WH ── */}
      {pending.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow" style={{ fontSize: "10px" }}>Awaiting Review</p>
              <h2>Pending Requests</h2>
            </div>
            <span className="badge badge-warning">{pending.length} in queue</span>
          </div>
          <ApprovalsHistory requests={pending} mode="wh-pending" />
        </section>
      )}

      {/* ── Full history ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow" style={{ fontSize: "10px" }}>Submission Log</p>
            <h2>All My Requests</h2>
          </div>
          <span className="badge">{all.length} total</span>
        </div>
        {all.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
            <span style={{ fontSize: "32px", display: "block", marginBottom: "10px" }}>📋</span>
            You haven't submitted any price change requests yet.
            <br />
            <span style={{ fontSize: "12px", marginTop: "6px", display: "block" }}>
              When you update a confirmed price in the Purchasing page, a request will appear here.
            </span>
          </div>
        ) : (
          <ApprovalsHistory requests={all} mode="wh" />
        )}
      </section>
    </div>
  );
}
