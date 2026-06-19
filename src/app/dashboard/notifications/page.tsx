import { SectionIntro } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import {
  getRecentPriceUpdates,
  getPriceAcknowledgments,
  getPendingPriceChangeRequests,
} from "@/lib/db";
import { formatDateTime, formatCurrency, currentMonth } from "@/lib/format";
import PriceChangeRequests from "@/components/price-change-requests";

export default function NotificationsPage() {
  const session = requireRole(["SC", "SA", "AD"]);
  const month = currentMonth();

  const isManager = session.role === "SC" || session.role === "AD";

  const recentUpdates = getRecentPriceUpdates(month, 20);
  const acknowledgments = isManager ? getPriceAcknowledgments(30) : [];
  const pendingChangeRequests = isManager ? getPendingPriceChangeRequests() : [];

  const unreadCount = recentUpdates.filter((u: any) => !u.ack_by).length;
  const totalActivity = pendingChangeRequests.length + acknowledgments.length + recentUpdates.length;

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Activity Center"
        title="Notifications"
        description={
          isManager
            ? "Track price update acknowledgments, pending approvals, and team activity."
            : "View price change alerts for the current month and acknowledge them."
        }
        actions={<span className="badge badge-strong">{month}</span>}
      />

      {/* ── Unread / Pending Alert Banner ─────────────────────────────────── */}
      {(unreadCount > 0 || pendingChangeRequests.length > 0) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: pendingChangeRequests.length > 0 && unreadCount > 0 ? "1fr 1fr" : "1fr",
          gap: "12px",
        }}>
          {/* Pending approvals alert */}
          {pendingChangeRequests.length > 0 && (
            <div style={{
              padding: "20px 24px", borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))",
              border: "1.5px solid rgba(245,158,11,0.35)",
              display: "flex", alignItems: "center", gap: "16px",
              boxShadow: "0 4px 20px rgba(245,158,11,0.12)",
            }}>
              {/* Pulsing icon */}
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px", flexShrink: 0,
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px", boxShadow: "0 4px 14px rgba(245,158,11,0.5)",
                animation: "pulse-ring 2.5s ease-out infinite",
              }}>🔔</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#b45309", marginBottom: "4px" }}>
                  Action Required
                </div>
                <div style={{ fontSize: "17px", fontWeight: 900, color: "#92400e", marginBottom: "3px" }}>
                  {pendingChangeRequests.length} Price Change Request{pendingChangeRequests.length > 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: "12px", color: "#b45309" }}>
                  Waiting for your review and decision
                </div>
              </div>
              <div style={{
                padding: "10px 18px", borderRadius: "99px", flexShrink: 0,
                background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)",
                color: "#b45309", fontWeight: 800, fontSize: "13px",
              }}>
                ↓ Review below
              </div>
            </div>
          )}

          {/* Unread notifications alert */}
          {unreadCount > 0 && (
            <div style={{
              padding: "20px 24px", borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))",
              border: "1.5px solid rgba(99,102,241,0.3)",
              display: "flex", alignItems: "center", gap: "16px",
              boxShadow: "0 4px 20px rgba(99,102,241,0.1)",
            }}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px", flexShrink: 0,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px", boxShadow: "0 4px 14px rgba(99,102,241,0.45)",
              }}>📨</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4338ca", marginBottom: "4px" }}>
                  Unacknowledged
                </div>
                <div style={{ fontSize: "17px", fontWeight: 900, color: "#3730a3", marginBottom: "3px" }}>
                  {unreadCount} Price Update{unreadCount > 1 ? "s" : ""} Not Seen
                </div>
                <div style={{ fontSize: "12px", color: "#4338ca" }}>
                  SA team hasn&apos;t confirmed these changes yet
                </div>
              </div>
              <div style={{
                padding: "10px 16px", borderRadius: "99px",
                background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                color: "#4338ca", fontWeight: 800, fontSize: "13px", flexShrink: 0,
              }}>
                ↓ Scroll to see
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── All clear state ────────────────────────────────────────────── */}
      {unreadCount === 0 && pendingChangeRequests.length === 0 && totalActivity === 0 && (
        <div style={{
          padding: "48px", borderRadius: "20px", textAlign: "center",
          background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.04))",
          border: "1.5px solid rgba(16,185,129,0.25)",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--success)", marginBottom: "6px" }}>All caught up!</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No pending actions or unread notifications.</div>
        </div>
      )}

      {/* ── SA view: price update alerts ──────────────────────────────────── */}
      {!isManager && recentUpdates.length > 0 && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Price Alerts</p>
              <h2>Current Month Updates ({recentUpdates.length})</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                Unread items are highlighted — acknowledge them to clear the counter
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="badge badge-warning">{unreadCount} Unacknowledged</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentUpdates.map((u: any) => {
              const isUnread = !u.ack_by;
              return (
                <div key={u.id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto auto",
                  gap: "12px", alignItems: "center",
                  padding: "14px 16px", borderRadius: "12px",
                  background: isUnread ? "rgba(245,158,11,0.06)" : "var(--bg-surface)",
                  border: `1.5px solid ${isUnread ? "rgba(245,158,11,0.3)" : "var(--border-light)"}`,
                  borderLeft: isUnread ? "4px solid #f59e0b" : "4px solid var(--border-light)",
                  transition: "background 200ms",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{u.item_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.category_name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>New Range</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                      {formatCurrency(u.new_sell_min)} – {formatCurrency(u.new_sell_max)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>Was</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: u.prev_sell_min ? "line-through" : "none" }}>
                      {u.prev_sell_min != null ? `${formatCurrency(u.prev_sell_min)} – ${formatCurrency(u.prev_sell_max)}` : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>Updated</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDateTime(u.changed_at)}</div>
                  </div>
                  <div>
                    {u.ack_by ? (
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                        background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                      }}>✓ Seen by {u.ack_by}</span>
                    ) : (
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                        background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)",
                        animation: "pulse-ring 2.5s ease-out infinite",
                      }}>⚠ Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── SC/AD: Pending change requests ────────────────────────────────── */}
      {isManager && pendingChangeRequests.length > 0 && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Action Required</p>
              <h2>Pending Price Change Requests ({pendingChangeRequests.length})</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                Approve or reject each request — the price updates immediately on approval
              </p>
            </div>
            <span className="badge badge-warning" style={{ animation: "pulse-ring 2s ease-out infinite" }}>
              {pendingChangeRequests.length} Pending
            </span>
          </div>
          <PriceChangeRequests requests={pendingChangeRequests} username={session.displayName} />
        </section>
      )}

      {/* ── SC/AD: SA Acknowledgment feed ─────────────────────────────────── */}
      {isManager && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Team Activity</p>
              <h2>SA Price Acknowledgments</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                Sales agents confirming they received updated prices
              </p>
            </div>
            <span className="badge badge-strong">{acknowledgments.length} total</span>
          </div>
          {acknowledgments.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>No acknowledgments yet</div>
              <div style={{ fontSize: "12px" }}>SA team will confirm price updates here once you publish prices</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {acknowledgments.map((a) => (
                <div key={a.id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto",
                  gap: "12px", alignItems: "center",
                  padding: "12px 16px", borderRadius: "10px",
                  background: "var(--bg-surface)", border: "1px solid var(--border-light)",
                  borderLeft: "4px solid var(--success)",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{a.item_name}</div>
                  </div>
                  <span className="badge">{a.month}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>Price Range</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                      {formatCurrency(a.new_sell_min)} – {formatCurrency(a.new_sell_max)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                      background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                    }}>✓ {a.acknowledged_by}</span>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>{formatDateTime(a.acknowledged_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── All price updates this month ─────────────────────────────────── */}
      {isManager && recentUpdates.length > 0 && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Price History</p>
              <h2>All Price Updates — {month} ({recentUpdates.length})</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                Orange left border = SA hasn&apos;t acknowledged yet
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="badge badge-warning">{unreadCount} Unacknowledged</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recentUpdates.map((u: any) => {
              const isUnread = !u.ack_by;
              return (
                <div key={u.id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto auto",
                  gap: "12px", alignItems: "center",
                  padding: "12px 16px", borderRadius: "10px",
                  background: isUnread ? "rgba(245,158,11,0.04)" : "var(--bg-surface)",
                  border: `1px solid ${isUnread ? "rgba(245,158,11,0.25)" : "var(--border-light)"}`,
                  borderLeft: isUnread ? "4px solid #f59e0b" : "4px solid var(--success)",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{u.item_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.category_name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>New Range</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                      {formatCurrency(u.new_sell_min)} – {formatCurrency(u.new_sell_max)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>SC Note</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", maxWidth: "140px", textAlign: "right" }}>
                      {u.sa_note || "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>By</div>
                    <div style={{ fontSize: "12px", fontWeight: 600 }}>{u.changed_by}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{formatDateTime(u.changed_at)}</div>
                  </div>
                  <div>
                    {u.ack_by ? (
                      <div>
                        <span style={{
                          fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "99px",
                          background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                          display: "block",
                        }}>✓ Seen</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginTop: "3px", textAlign: "center" }}>
                          by {u.ack_by}
                        </span>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "99px",
                        background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)",
                      }}>⚠ Awaiting SA</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Empty state for manager ────────────────────────────────────── */}
      {isManager && recentUpdates.length === 0 && pendingChangeRequests.length === 0 && (
        <div style={{
          padding: "48px", borderRadius: "20px", textAlign: "center",
          background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.04))",
          border: "1.5px solid rgba(16,185,129,0.2)",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--success)", marginBottom: "6px" }}>All clear for {month}</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No price changes or pending requests this month.</div>
        </div>
      )}
    </div>
  );
}
