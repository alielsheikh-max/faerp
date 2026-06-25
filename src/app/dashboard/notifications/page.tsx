import { SectionIntro } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import MarkReadClient, { MarkWHReadClient } from "@/components/mark-read-client";
import {
  getRecentPriceUpdates,
  getPriceAcknowledgments,
  getPendingPriceChangeRequests,
  getNegotiatedPriceEntries,
  getRejectedPriceEntriesForWH,
  getSalesCatalog,
} from "@/lib/db";
import { formatDateTime, formatCurrency, currentMonth, formatMonthLabel } from "@/lib/format";
import PriceChangeRequests from "@/components/price-change-requests";
import { getServerT, getServerLocale } from "@/lib/locale-server";
import CancelPendingButton from "@/components/cancel-pending-button";

const roundUp5 = (n: number | null | undefined) => n != null ? Math.ceil(n / 5) * 5 : n;

export default function NotificationsPage() {
  const session = requireRole(["SC", "SA", "AD", "WH", "MG"]);
  const t = getServerT();
  const locale = getServerLocale();
  const isAr = locale === "ar";
  const month = currentMonth();

  const isManager = session.role === "SC" || session.role === "AD";
  const isWH = session.role === "WH";
  const isMG = session.role === "MG";

  const recentUpdates = (session.role === "SC" || session.role === "SA" || session.role === "AD") ? getRecentPriceUpdates(month, 20) : [];
  const acknowledgments = (isManager || isMG) ? getPriceAcknowledgments(30) : [];
  const pendingChangeRequests = isManager ? getPendingPriceChangeRequests() : [];
  const negotiatedEntries = isManager ? getNegotiatedPriceEntries(month) : [];
  const rejectedEntries = isWH ? getRejectedPriceEntriesForWH(session.displayName) : [];

  // Reconsidered proposed prices returned from MG to SC
  const isSC = session.role === "SC";
  const reconsideredCatalog = isSC ? getSalesCatalog(month).filter((row: any) => row.sell_min !== null && row.approval_status === "reconsidered") : [];

  // Pending proposed prices submitted from SC to MG
  const scPendingCatalog = isSC ? getSalesCatalog(month).filter((row: any) => row.sell_min !== null && row.approval_status === "pending") : [];
  const mgPendingItems = isMG ? getSalesCatalog(month).filter((row: any) => row.sell_min !== null && row.approval_status === "pending") : [];

  const unreadCount = isWH
    ? rejectedEntries.filter((u: any) => !u.read_by_wh).length
    : isMG
      ? mgPendingItems.length
      : recentUpdates.filter((u: any) => !u.ack_by).length;

  const totalActivity = isWH
    ? rejectedEntries.length
    : isMG
      ? mgPendingItems.length
      : pendingChangeRequests.length + acknowledgments.length + recentUpdates.length + negotiatedEntries.length + reconsideredCatalog.length + scPendingCatalog.length;

  if (isWH) {
    return (
      <div className="page-stack">
        <SectionIntro
          eyebrow={isAr ? "مركز الإشعارات" : "Notification Center"}
          title={isAr ? "عروض الأسعار المرفوضة" : "Rejected Quote Notifications"}
          description={
            isAr
              ? "مراجعة عروض الأسعار التي تم رفضها من قبل إدارة سلاسل الإمداد للبدء في إعادة التفاوض."
              : "Review quotes rejected by the Supply Chain team to start renegotiation."
          }
          actions={<span className="badge badge-strong">{formatMonthLabel(month)}</span>}
        />

        {/* Unread banner for WH */}
        {unreadCount > 0 && (
          <div style={{
            padding: "20px 24px", borderRadius: "16px",
            background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.06))",
            border: "1.5px solid rgba(239,68,68,0.35)",
            display: "flex", alignItems: "center", gap: "16px",
            boxShadow: "0 4px 20px rgba(239,68,68,0.12)",
          }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "14px", flexShrink: 0,
              background: "linear-gradient(135deg, #ef4444, #f59e0b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", boxShadow: "0 4px 14px rgba(239,68,68,0.45)",
              animation: "pulse-ring-danger 1.8s infinite",
            }}>⚠️</div>
            <div style={{ flex: 1, minWidth: 0, textAlign: isAr ? "right" : "left" }}>
              <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#b91c1c", marginBottom: "4px" }}>
                {isAr ? "مراجعة مطلوبة" : "Review Required"}
              </div>
              <div style={{ fontSize: "17px", fontWeight: 900, color: "#991b1b", marginBottom: "3px" }}>
                {isAr ? `لديك ${unreadCount} عروض أسعار مرفوضة جديدة` : `You have ${unreadCount} new rejected quotes`}
              </div>
              <div style={{ fontSize: "12px", color: "#b91c1c" }}>
                {isAr ? "يرجى مراجعة ملاحظات الرفض وتعديل الأسعار" : "Please review the rejection notes and renegotiate pricing."}
              </div>
            </div>
          </div>
        )}

        {/* All clear state */}
        {totalActivity === 0 && (
          <div style={{
            padding: "48px", borderRadius: "20px", textAlign: "center",
            background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.04))",
            border: "1.5px solid rgba(16,185,129,0.25)",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--success)", marginBottom: "6px" }}>
              {isAr ? "لا توجد أسعار مرفوضة" : "No Rejected Quotes"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {isAr ? "كل شيء على ما يرام! لم يتم رفض أي من أسعارك هذا الشهر." : "Everything is caught up! None of your price submissions are currently rejected."}
            </div>
          </div>
        )}

        {/* Rejected entries list */}
        {totalActivity > 0 && (
          <section className="panel animate-fade-in">
            <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
              <div>
                <p className="eyebrow">{isAr ? "تغذية الإشعارات" : "Notification Feed"}</p>
                <h2>{isAr ? `قائمة المرفوضات (${rejectedEntries.length})` : `Rejected Quotes Log (${rejectedEntries.length})`}</h2>
              </div>
              {unreadCount > 0 && (
                <span className="badge badge-danger" style={{ background: "var(--danger)", color: "#fff", animation: "pulse-ring-danger 1.8s infinite" }}>
                  {unreadCount} {isAr ? "جديد" : "new"}
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {rejectedEntries.map((pe) => {
                const isUnread = !pe.read_by_wh;
                return (
                  <div key={pe.quote_id} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto auto",
                    gap: "16px", alignItems: "center",
                    padding: "14px 16px", borderRadius: "12px",
                    background: isUnread ? "rgba(239,68,68,0.04)" : "var(--bg-surface)",
                    border: `1.5px solid ${isUnread ? "rgba(239,68,68,0.25)" : "var(--border-light)"}`,
                    borderLeft: isAr ? "none" : (isUnread ? "4px solid #ef4444" : "4px solid var(--border-light)"),
                    borderRight: isAr ? (isUnread ? "4px solid #ef4444" : "4px solid var(--border-light)") : "none",
                    direction: isAr ? "rtl" : "ltr",
                  }}>
                    <div style={{ textAlign: isAr ? "right" : "left" }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{pe.item_name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {isAr ? "المورد:" : "Supplier:"} <strong>{pe.supplier_name}</strong>
                      </div>
                      {pe.review_note && (
                        <div style={{
                          fontSize: "12px", color: "#b91c1c", background: "rgba(239,68,68,0.06)",
                          padding: "8px 12px", borderRadius: "8px", border: "1px dashed rgba(239,68,68,0.2)",
                          marginTop: "6px", fontStyle: "italic"
                        }}>
                          <strong>{isAr ? "سبب الرفض:" : "Rejection Reason:"}</strong> {pe.review_note}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: isAr ? "left" : "right" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{isAr ? "السعر المرفوض" : "Rejected Price"}</div>
                      <div style={{ fontWeight: 800, color: "var(--danger)", fontSize: "14px" }}>
                        {formatCurrency(pe.price)}
                      </div>
                      <span className="badge" style={{ fontSize: "9px", marginTop: "2px" }}>{pe.month}</span>
                    </div>

                    <div style={{ textAlign: isAr ? "left" : "right" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{isAr ? "تمت المراجعة بواسطة" : "Reviewed By"}</div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>{pe.reviewed_by || "SC Manager"}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{pe.reviewed_at ? formatDateTime(pe.reviewed_at) : ""}</div>
                    </div>

                    <div style={{ textAlign: isAr ? "left" : "right" }}>
                      {isUnread ? (
                        <span style={{
                          fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                          background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)",
                        }}>{isAr ? "غير مقروء" : "New"}</span>
                      ) : (
                        <span style={{
                          fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                          background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)",
                        }}>{isAr ? "تم الاطلاع" : "Seen"}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <MarkWHReadClient />
      </div>
    );
  }

  if (isMG) {
    return (
      <div className="page-stack">
        <SectionIntro
          eyebrow={isAr ? "مركز الإشعارات" : "Notification Center"}
          title={isAr ? "طلبات التسعير المعلقة" : "Pending Pricing Approvals"}
          description={
            isAr
              ? "مراجعة واعتماد طلبات تسعير الفئات والأصناف المقدمة من Pricing Control."
              : "Review and approve category/item pricing proposals submitted by Pricing Control."
          }
          actions={<span className="badge badge-strong">{formatMonthLabel(month)}</span>}
        />

        {mgPendingItems.length > 0 ? (
          <section className="panel animate-fade-in">
            <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
              <div>
                <p className="eyebrow">{isAr ? "مطلوب إجراء" : "Action Required"}</p>
                <h2>{isAr ? `${mgPendingItems.length} أصناف تنتظر الاعتماد` : `${mgPendingItems.length} Items Awaiting Approval`}</h2>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                  {isAr ? "مراجعة الأسعار المقترحة مقابل الأسعار الحالية" : "Review proposed prices vs current approved prices"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span className="badge badge-warning" style={{ animation: "pulse-ring 2s ease-out infinite" }}>
                  {mgPendingItems.length} {isAr ? "معلق" : "pending"}
                </span>
                <a href="/dashboard" className="button button-primary" style={{ padding: "6px 14px", fontSize: "11px", textDecoration: "none" }}>
                  {isAr ? "اعتماد ←" : "Approve →"}
                </a>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {mgPendingItems.map((row: any) => (
                <div key={row.item_id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto",
                  gap: "16px", alignItems: "center",
                  padding: "14px 16px", borderRadius: "12px",
                  background: "rgba(245,158,11,0.04)",
                  border: "1.5px solid rgba(245,158,11,0.25)",
                  borderLeft: isAr ? "none" : "4px solid #f59e0b",
                  borderRight: isAr ? "4px solid #f59e0b" : "none",
                  direction: isAr ? "rtl" : "ltr",
                }}>
                  <div style={{ textAlign: isAr ? "right" : "left" }}>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>{row.item_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{row.category_name}</div>
                  </div>
                  {/* Current approved price */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>
                      {isAr ? "السعر الحالي" : "Current"}
                    </div>
                    {row.last_approved_sell_min != null ? (
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "line-through" }}>
                        {formatCurrency(roundUp5(row.last_approved_sell_min))} – {formatCurrency(roundUp5(row.last_approved_sell_max))}
                      </div>
                    ) : (
                      <span className="badge" style={{ fontSize: "9px" }}>{isAr ? "جديد" : "New Item"}</span>
                    )}
                  </div>
                  {/* Proposed new price */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "9px", color: "#b45309", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>
                      {isAr ? "المقترح" : "Proposed"}
                    </div>
                    <div style={{ fontWeight: 800, color: "#b45309", fontSize: "13px" }}>
                      {formatCurrency(roundUp5(row.sell_min))} – {formatCurrency(roundUp5(row.sell_max))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div style={{
            padding: "48px", borderRadius: "20px", textAlign: "center",
            background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.04))",
            border: "1.5px solid rgba(16,185,129,0.25)",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--success)", marginBottom: "6px" }}>
              {isAr ? "لا توجد طلبات معلقة" : "No Pending Approvals"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {isAr ? "كل شيء معتمد! لا توجد طلبات تسعير معلقة حالياً." : "All clear! There are no proposed prices awaiting your approval."}
            </div>
          </div>
        )}

        {/* SA Acknowledgment Feed — also visible to MG */}
        {acknowledgments.length > 0 && (
          <section className="panel animate-fade-in">
            <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
              <div>
                <p className="eyebrow">{isAr ? "نشاط الفريق" : "Team Activity"}</p>
                <h2>{isAr ? "تأكيدات المبيعات" : "Sales Acknowledgments"}</h2>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                  {isAr ? "تأكيد فريق المبيعات على استلام تحديثات الأسعار المنقحة" : "Sales team confirmations that revised price updates have been received"}
                </p>
              </div>
              <span className="badge badge-strong">{acknowledgments.length} {isAr ? "إجمالي" : "total"}</span>
            </div>
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
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{isAr ? "السعر" : "Price Range"}</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                      {formatCurrency(a.new_sell_min)} – {formatCurrency(a.new_sell_max)}
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? "left" : "right" }}>
                    <span style={{
                      fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "99px",
                      background: "rgba(16,185,129,0.12)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                    }}>✓ {isAr ? `تم بواسطة ${a.acknowledged_by}` : `Seen by ${a.acknowledged_by}`}</span>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>{formatDateTime(a.acknowledged_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

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

      {/* ── SC: Outgoing Pending Approvals ───────────────────────────────── */}
      {isSC && scPendingCatalog.length > 0 && (
        <section className="panel animate-fade-in">
          <div className="panel-header" style={{ marginBottom: "14px", textAlign: isAr ? "right" : "left" }}>
            <div>
              <p className="eyebrow" style={{ color: "#f59e0b" }}>{isAr ? "الطلبات الصادرة" : "Outgoing Requests"}</p>
              <h2>{isAr ? "أسعار معلقة لدى المدير" : "Pending MG Approval"}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
                {isAr ? "الأسعار المقترحة المرسلة للمدير للاعتماد — يمكنك إلغاء الطلب قبل اتخاذ إجراء" : "Proposed prices sent to Manager for approval — you can cancel before action is taken"}
              </p>
            </div>
            <span className="badge badge-warning" style={{ animation: "pulse-ring 2s ease-out infinite" }}>
              {scPendingCatalog.length} {isAr ? "معلق" : "pending"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {scPendingCatalog.map((row: any) => (
              <div key={row.item_id} style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto",
                gap: "14px", alignItems: "center",
                padding: "14px 16px", borderRadius: "12px",
                background: "rgba(245,158,11,0.04)",
                border: "1.5px solid rgba(245,158,11,0.25)",
                borderLeft: isAr ? "none" : "4px solid #f59e0b",
                borderRight: isAr ? "4px solid #f59e0b" : "none",
                direction: isAr ? "rtl" : "ltr",
              }}>
                <div style={{ textAlign: isAr ? "right" : "left" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>{row.item_name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{row.category_name}</div>
                </div>
                {/* Current approved price */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>
                    {isAr ? "الحالي" : "Current"}
                  </div>
                  {row.last_approved_sell_min != null ? (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "line-through" }}>
                      {formatCurrency(roundUp5(row.last_approved_sell_min))} – {formatCurrency(roundUp5(row.last_approved_sell_max))}
                    </div>
                  ) : (
                    <span className="badge" style={{ fontSize: "9px" }}>{isAr ? "أول مرة" : "First Time"}</span>
                  )}
                </div>
                {/* Proposed new price */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "#b45309", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>
                    {isAr ? "المقترح" : "Proposed"}
                  </div>
                  <div style={{ fontWeight: 800, color: "#b45309", fontSize: "13px" }}>
                    {formatCurrency(roundUp5(row.sell_min))} – {formatCurrency(roundUp5(row.sell_max))}
                  </div>
                </div>
                {/* Cancel button */}
                <div style={{ textAlign: "center" }}>
                  <CancelPendingButton itemId={row.item_id} month={month} itemName={row.item_name} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Reconsidered Prices section (SC only) ── */}
      {isSC && reconsideredCatalog.length > 0 && (
        <section className="panel animate-fade-in" style={{ borderColor: "rgba(239,68,68,0.4)", marginBottom: "16px" }}>
          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--danger)" }}>{isAr ? "إعادة النظر والرقابة" : "Reconsideration Actions Required"}</p>
              <h2>{isAr ? "أسعار أعادها المدير للمراجعة" : "Proposed Prices Returned by Manager"}</h2>
            </div>
            <span className="badge badge-danger">{reconsideredCatalog.length} {t("gen.item")}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {reconsideredCatalog.map(row => (
              <div key={row.item_id} style={{
                padding: "16px", borderRadius: "12px", background: "rgba(239,68,68,0.03)",
                border: "1.5px solid rgba(239,68,68,0.2)", display: "flex", flexDirection: "column", gap: "8px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: isAr ? "row-reverse" : "row" }}>
                  <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{row.item_name}</strong>
                  <span className="badge" style={{ fontSize: "10px" }}>{row.category_name}</span>
                </div>
                <div style={{
                  padding: "8px 12px", background: "rgba(239,68,68,0.06)", border: "1px dashed rgba(239,68,68,0.25)",
                  borderRadius: "8px", fontSize: "12px", color: "var(--danger)"
                }}>
                  <strong>{isAr ? "ملاحظة المدير:" : "Manager Note:"}</strong> {row.reconsider_note || (isAr ? "لا توجد ملاحظة إضافية." : "No additional note provided.")}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <a href={`/dashboard/pricing/category?categoryId=${row.category_id}`} className="button button-primary" style={{ padding: "6px 12px", fontSize: "11px", textDecoration: "none" }}>
                    ✏️ {isAr ? "تعديل التسعير الآن" : "Edit Pricing Now"}
                  </a>
                </div>
              </div>
            ))}
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
