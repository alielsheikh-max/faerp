import { SectionIntro } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import MarkReadClient from "@/components/mark-read-client";
import {
  getRecentPriceUpdates,
  getPriceAcknowledgments,
  getPendingPriceChangeRequests,
  getNegotiatedPriceEntries,
} from "@/lib/db";
import { formatDateTime, formatCurrency, currentMonth, formatMonthLabel } from "@/lib/format";
import PriceChangeRequests from "@/components/price-change-requests";
import { getServerT, getServerLocale } from "@/lib/locale-server";

export default function NotificationsPage() {
  const session = requireRole(["SC", "SA", "AD"]);
  const t = getServerT();
  const locale = getServerLocale();
  const isAr = locale === "ar";
  const month = currentMonth();

  const isManager = session.role === "SC" || session.role === "AD";

  const recentUpdates = getRecentPriceUpdates(month, 20);
  const acknowledgments = isManager ? getPriceAcknowledgments(30) : [];
  const pendingChangeRequests = isManager ? getPendingPriceChangeRequests() : [];
  const negotiatedEntries = isManager ? getNegotiatedPriceEntries(month) : [];

  const unreadCount = recentUpdates.filter((u: any) => !u.ack_by).length;
  const totalActivity = pendingChangeRequests.length + acknowledgments.length + recentUpdates.length + negotiatedEntries.length;

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={t("notif.eyebrow")}
        title={t("notif.title")}
        description={
          isManager
            ? t("notif.descManager")
            : t("notif.descSA")
        }
        actions={<span className="badge badge-strong">{formatMonthLabel(month)}</span>}
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
              <div style={{ flex: 1, minWidth: 0, textAlign: isAr ? "right" : "left" }}>
                <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#b45309", marginBottom: "4px" }}>
                  {t("notif.actionRequired")}
                </div>
                <div style={{ fontSize: "17px", fontWeight: 900, color: "#92400e", marginBottom: "3px" }}>
                  {t("notif.priceChangeRequests").replace("{count}", String(pendingChangeRequests.length))}
                </div>
                <div style={{ fontSize: "12px", color: "#b45309" }}>
                  {t("notif.waitingDecision")}
                </div>
              </div>
              <div style={{
                padding: "10px 18px", borderRadius: "99px", flexShrink: 0,
                background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)",
                color: "#b45309", fontWeight: 800, fontSize: "13px",
              }}>
                {t("notif.reviewBelow")}
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
              <div style={{ flex: 1, minWidth: 0, textAlign: isAr ? "right" : "left" }}>
                <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4338ca", marginBottom: "4px" }}>
                  {t("notif.unacknowledged")}
                </div>
                <div style={{ fontSize: "17px", fontWeight: 900, color: "#3730a3", marginBottom: "3px" }}>
                  {t("notif.priceUpdatesNotSeen").replace("{count}", String(unreadCount))}
                </div>
                <div style={{ fontSize: "12px", color: "#4338ca" }}>
                  {t("notif.saNotConfirmed")}
                </div>
              </div>
              <div style={{
                padding: "10px 16px", borderRadius: "99px",
                background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                color: "#4338ca", fontWeight: 800, fontSize: "13px", flexShrink: 0,
              }}>
                {t("notif.scrollToSee")}
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
          <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--success)", marginBottom: "6px" }}>{t("notif.allCaughtUp")}</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t("notif.allCaughtUpDesc")}</div>
        </div>
      )}

      {/* ── SA view: price update alerts ──────────────────────────────────── */}
      {!isManager && recentUpdates.length > 0 && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
            <div>
              <p className="eyebrow">{t("notif.priceAlerts")}</p>
              <h2>{t("notif.currentMonthUpdates").replace("{count}", String(recentUpdates.length))}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                {t("notif.unreadHighlighted")}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="badge badge-warning">{unreadCount} {t("notif.unacknowledged")}</span>
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
                  borderLeft: isAr ? "none" : (isUnread ? "4px solid #f59e0b" : "4px solid var(--border-light)"),
                  borderRight: isAr ? (isUnread ? "4px solid #f59e0b" : "4px solid var(--border-light)") : "none",
                  transition: "background 200ms",
                  direction: isAr ? "rtl" : "ltr",
                }}>
                  <div style={{ textAlign: isAr ? "right" : "left" }}>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{u.item_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.category_name}</div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.newRange")}</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                      {formatCurrency(u.new_sell_min)} – {formatCurrency(u.new_sell_max)}
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.was")}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: u.prev_sell_min ? "line-through" : "none" }}>
                      {u.prev_sell_min != null ? `${formatCurrency(u.prev_sell_min)} – ${formatCurrency(u.prev_sell_max)}` : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.updated")}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDateTime(u.changed_at)}</div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    {u.ack_by ? (
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                        background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                      }}>{t("notif.seenBy").replace("{user}", u.ack_by)}</span>
                    ) : (
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                        background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)",
                        animation: "pulse-ring 2.5s ease-out infinite",
                      }}>{t("notif.pending")}</span>
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
          <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
            <div>
              <p className="eyebrow">{t("notif.actionRequired")}</p>
              <h2>{t("notif.pendingPriceChangeRequests").replace("{count}", String(pendingChangeRequests.length))}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                {t("notif.approveRejectDesc")}
              </p>
            </div>
            <span className="badge badge-warning" style={{ animation: "pulse-ring 2s ease-out infinite" }}>
              {pendingChangeRequests.length} {t("gen.pending")}
            </span>
          </div>
          <PriceChangeRequests requests={pendingChangeRequests} username={session.displayName} />
        </section>
      )}

      {/* ── SC/AD: Negotiated Prices Log ─────────────────────────────────── */}
      {isManager && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
            <div>
              <p className="eyebrow" style={{ color: "#8b5cf6" }}>{t("notif.negotiationFeed")}</p>
              <h2>{t("notif.negotiatedPricesLog")}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                {t("notif.negotiatedDesc")}
              </p>
            </div>
            <span className="badge" style={{ background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.35)", fontWeight: 700 }}>
              {t("notif.negotiatedCount").replace("{count}", String(negotiatedEntries.length))}
            </span>
          </div>
          {negotiatedEntries.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🤝</div>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{t("notif.noNegotiatedPrices")}</div>
              <div style={{ fontSize: "12px" }}>{t("notif.noNegotiatedPricesDesc")}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {negotiatedEntries.map((a: any) => {
                const diff = a.negotiated_price - a.original_price;
                const diffPct = a.original_price > 0 ? (diff / a.original_price) * 100 : 0;
                const isSaving = diff < 0;

                return (
                  <div key={a.id} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto auto",
                    gap: "16px", alignItems: "center",
                    padding: "12px 16px", borderRadius: "10px",
                    background: "var(--bg-surface)", border: "1px solid var(--border-light)",
                    borderLeft: isAr ? "none" : "4px solid #8b5cf6",
                    borderRight: isAr ? "4px solid #8b5cf6" : "none",
                    direction: isAr ? "rtl" : "ltr",
                  }}>
                    <div style={{ textAlign: isAr ? "right" : "left" }}>
                      <div style={{ fontWeight: 700, fontSize: "13px" }}>{a.item_name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{a.supplier_name}</div>
                      {a.negotiated_notes && (
                        <div style={{ fontSize: "11px", color: "#8b5cf6", fontStyle: "italic", marginTop: "3px" }}>
                          {isAr ? "ملاحظات:" : "Notes:"} {a.negotiated_notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: isAr ? "left" : "right" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.original")}</div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "line-through" }}>
                        {formatCurrency(a.original_price)}
                      </div>
                    </div>
                    <div style={{ textAlign: isAr ? "left" : "right" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.negotiated")}</div>
                      <div style={{ fontWeight: 800, color: "var(--success)", fontSize: "13px" }}>
                        {formatCurrency(a.negotiated_price)}
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: isSaving ? "var(--success)" : "var(--danger)" }}>
                        {isSaving ? "▼" : "▲"} {Math.abs(diffPct).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ textAlign: isAr ? "left" : "right" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                        background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.25)",
                      }}>{t("notif.loggedBy").replace("{user}", a.collected_by)}</span>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>{formatDateTime(a.recorded_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── SC/AD: SA Acknowledgment feed ─────────────────────────────────── */}
      {isManager && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
            <div>
              <p className="eyebrow">{t("notif.teamActivity")}</p>
              <h2>{t("notif.saPriceAcks")}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                {t("notif.saConfirmingUpdates")}
              </p>
            </div>
            <span className="badge badge-strong">{acknowledgments.length} {isAr ? "إجمالي" : "total"}</span>
          </div>
          {acknowledgments.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{t("notif.noAcksYet")}</div>
              <div style={{ fontSize: "12px" }}>{t("notif.noAcksYetDesc")}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {acknowledgments.map((a) => (
                <div key={a.id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto",
                  gap: "12px", alignItems: "center",
                  padding: "12px 16px", borderRadius: "10px",
                  background: "var(--bg-surface)", border: "1px solid var(--border-light)",
                  borderLeft: isAr ? "none" : "4px solid var(--success)",
                  borderRight: isAr ? "4px solid var(--success)" : "none",
                  direction: isAr ? "rtl" : "ltr",
                }}>
                  <div style={{ textAlign: isAr ? "right" : "left" }}>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{a.item_name}</div>
                  </div>
                  <span className="badge">{formatMonthLabel(a.month)}</span>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.priceRange")}</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                      {formatCurrency(a.new_sell_min)} – {formatCurrency(a.new_sell_max)}
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <span style={{
                      fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                      background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                    }}>{t("notif.seenBy").replace("{user}", a.acknowledged_by)}</span>
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
          <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
            <div>
              <p className="eyebrow">{t("notif.priceHistory")}</p>
              <h2>{t("notif.allPriceUpdates").replace("{month}", formatMonthLabel(month)).replace("{count}", String(recentUpdates.length))}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                {t("notif.orangeBorderHint")}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="badge badge-warning">{unreadCount} {t("notif.unacknowledged")}</span>
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
                  borderLeft: isAr ? "none" : (isUnread ? "4px solid #f59e0b" : "4px solid var(--success)"),
                  borderRight: isAr ? (isUnread ? "4px solid #f59e0b" : "4px solid var(--success)") : "none",
                  direction: isAr ? "rtl" : "ltr",
                }}>
                  <div style={{ textAlign: isAr ? "right" : "left" }}>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{u.item_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.category_name}</div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.newRange")}</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                      {formatCurrency(u.new_sell_min)} – {formatCurrency(u.new_sell_max)}
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.scNote")}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", maxWidth: "140px", textAlign: isAr ? "left" : "right" }}>
                      {u.sa_note || "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("notif.by")}</div>
                    <div style={{ fontSize: "12px", fontWeight: 600 }}>{u.changed_by}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{formatDateTime(u.changed_at)}</div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    {u.ack_by ? (
                      <div>
                        <span style={{
                          fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "99px",
                          background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                          display: "block",
                        }}>{t("notif.seen")}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginTop: "3px", textAlign: "center" }}>
                          {t("notif.seenBy").replace("{user}", u.ack_by)}
                        </span>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "99px",
                        background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)",
                      }}>{t("notif.awaitingSA")}</span>
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
          <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--success)", marginBottom: "6px" }}>{t("notif.allClearForMonth").replace("{month}", formatMonthLabel(month))}</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t("notif.noPriceChanges")}</div>
        </div>
      )}
      {/* Mark acknowledgments as read when manager views the notifications page */}
      {isManager && <MarkReadClient />}
    </div>
  );
}
