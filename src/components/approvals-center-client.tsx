"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatMonthLabel, formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import { approvePriceEntryAction, rejectPriceEntryAction } from "@/app/actions/pricing";
import PriceChangeRequests from "@/components/price-change-requests";

type PendingQuote = {
  id: number;
  item_id: number;
  supplier_id: number;
  month: string;
  price: number;
  recorded_at: string;
  notes: string | null;
  actual_transport: number | null;
  status: string;
  review_note: string | null;
  item_name: string;
  unit: string;
  category_name: string;
  category_id: number;
  supplier_name: string;
  collected_by: string;
  prevPrice: number | null;
  purchHistory: Array<{
    price: number;
    month: string;
    recorded_at: string;
    status: string;
    notes: string | null;
  }>;
  sellHistory: Array<{
    sell_min: number;
    sell_max: number;
    buy_avg: number;
    strategy: string;
    month: string;
    created_at: string;
  }>;
};

type PriceChangeRequest = {
  id: number;
  item_id: number;
  supplier_id: number;
  month: string;
  old_price: number;
  new_price: number;
  reason: string;
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  item_name: string;
  category_name: string;
  supplier_name: string;
  old_transport?: number | null;
  new_transport?: number | null;
};

type OutgoingProposal = {
  id: number;
  item_id: number;
  month: string;
  strategy: string;
  markup_type: string;
  buy_min: number;
  buy_max: number;
  buy_avg: number;
  markup_min: number;
  markup_max: number;
  sell_min: number;
  sell_max: number;
  transportation: number;
  other_expenses: number;
  confirmed_supplier_id: number | null;
  approval_status: 'pending' | 'approved' | 'reconsidered';
  reconsider_note: string | null;
  item_name: string;
  unit: string;
  category_name: string;
  supplier_name: string | null;
  supplier_fame_name: string | null;
};

type Props = {
  pendingQuotes: PendingQuote[];
  pendingRevisions: PriceChangeRequest[];
  outgoingProposals: OutgoingProposal[];
  username: string;
  month: string;
};

export default function ApprovalsCenterClient({
  pendingQuotes,
  pendingRevisions,
  outgoingProposals,
  username,
  month
}: Props) {
  const { t, locale, isRTL } = useI18n();
  const isAr = locale === "ar";
  const router = useRouter();

  const [topTab, setTopTab] = useState<"incoming" | "outgoing">("incoming");
  const [activeTab, setActiveTab] = useState<"quotes" | "revisions">(
    pendingQuotes.length > 0 ? "quotes" : "revisions"
  );
  const [expandedQuotes, setExpandedQuotes] = useState<Set<number>>(new Set());
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [processingType, setProcessingType] = useState<"approve" | "reject" | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleExpand = (id: number) => {
    setExpandedQuotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApproveQuote = (id: number) => {
    setProcessingId(id);
    setProcessingType("approve");
    const note = reviewNotes[id] || "";
    const fd = new FormData();
    fd.set("entryId", String(id));
    fd.set("reviewedBy", username);
    fd.set("reviewNote", note);

    startTransition(async () => {
      const res = await approvePriceEntryAction(fd);
      setProcessingId(null);
      setProcessingType(null);
      if (res?.ok) {
        router.refresh();
      } else {
        alert(res?.error || "Approval failed.");
      }
    });
  };

  const handleRejectQuote = (id: number) => {
    const note = reviewNotes[id] || "";
    if (!note.trim()) {
      alert(t("scapp.rejectNoteRequired"));
      return;
    }

    setProcessingId(id);
    setProcessingType("reject");
    const fd = new FormData();
    fd.set("entryId", String(id));
    fd.set("reviewedBy", username);
    fd.set("reviewNote", note);

    startTransition(async () => {
      const res = await rejectPriceEntryAction(fd);
      setProcessingId(null);
      setProcessingType(null);
      if (res?.ok) {
        router.refresh();
      } else {
        alert(res?.error || "Rejection failed.");
      }
    });
  };

  const [outgoingFilter, setOutgoingFilter] = useState<"all" | "pending" | "approved" | "reconsidered">("all");

  const filteredOutgoing = outgoingFilter === "all"
    ? outgoingProposals
    : outgoingProposals.filter(p => p.approval_status === outgoingFilter);

  const outgoingPendingCount = outgoingProposals.filter(p => p.approval_status === "pending").length;
  const outgoingApprovedCount = outgoingProposals.filter(p => p.approval_status === "approved").length;
  const outgoingReconsideredCount = outgoingProposals.filter(p => p.approval_status === "reconsidered").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Top-Level Incoming / Outgoing Tabs ── */}
      <div style={{
        display: "flex",
        background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)",
        padding: "5px",
        borderRadius: "12px",
        border: "1.5px solid var(--border-medium)",
        alignSelf: "flex-start",
        gap: "4px",
        flexDirection: isRTL ? "row-reverse" : "row"
      }}>
        {([
          { id: "incoming" as const, label: t("scapp.incoming"), icon: "📥", count: pendingQuotes.length + pendingRevisions.length },
          { id: "outgoing" as const, label: t("scapp.outgoing"), icon: "📤", count: outgoingPendingCount },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setTopTab(tab.id)}
            style={{
              padding: "10px 20px",
              borderRadius: "9px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "13px",
              background: topTab === tab.id ? "var(--primary)" : "transparent",
              color: topTab === tab.id ? "#fff" : "var(--text-secondary)",
              transition: "all 150ms",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                background: topTab === tab.id ? "rgba(255,255,255,0.25)" : "var(--primary)",
                color: topTab === tab.id ? "#fff" : "#fff",
                padding: "1px 7px",
                borderRadius: "99px",
                fontSize: "10px",
                fontWeight: 800,
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════ INCOMING TAB ════════ */}
      {topTab === "incoming" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* ── Sub Tabs: Quotes / Revisions ── */}
          <div style={{
            display: "flex",
            background: "var(--bg-elevated)",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            alignSelf: "flex-start",
            gap: "4px",
            flexDirection: isRTL ? "row-reverse" : "row"
          }}>
            <button
              onClick={() => setActiveTab("quotes")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "13px",
                background: activeTab === "quotes" ? "var(--primary)" : "transparent",
                color: activeTab === "quotes" ? "#fff" : "var(--text-secondary)",
                transition: "all 150ms",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>📦</span>
              <span>{t("scapp.receivedQuotes")}</span>
              {pendingQuotes.length > 0 && (
                <span style={{
                  background: activeTab === "quotes" ? "#fff" : "var(--primary)",
                  color: activeTab === "quotes" ? "var(--primary)" : "#fff",
                  padding: "1px 6px",
                  borderRadius: "99px",
                  fontSize: "10px",
                  fontWeight: 800
                }}>{pendingQuotes.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("revisions")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "13px",
                background: activeTab === "revisions" ? "var(--primary)" : "transparent",
                color: activeTab === "revisions" ? "#fff" : "var(--text-secondary)",
                transition: "all 150ms",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>🔄</span>
              <span>{t("scapp.changeRequests")}</span>
              {pendingRevisions.length > 0 && (
                <span style={{
                  background: activeTab === "revisions" ? "#fff" : "var(--primary)",
                  color: activeTab === "revisions" ? "var(--primary)" : "#fff",
                  padding: "1px 6px",
                  borderRadius: "99px",
                  fontSize: "10px",
                  fontWeight: 800
                }}>{pendingRevisions.length}</span>
              )}
            </button>
          </div>

          {/* ── Incoming Tab Content ── */}
          {activeTab === "quotes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {pendingQuotes.length === 0 ? (
                <div className="panel" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "14px" }}>
                  <span style={{ fontSize: "36px", display: "block", marginBottom: "12px" }}>✅</span>
                  {t("scapp.noPendingQuotes")}
                </div>
              ) : (
                pendingQuotes.map((q) => {
                  const prevPrice = q.prevPrice;
                  const priceDiff = prevPrice !== null ? q.price - prevPrice : null;
                  const pricePct = prevPrice && prevPrice > 0 && priceDiff !== null ? (priceDiff / prevPrice) * 100 : null;
                  const isIncrease = priceDiff !== null && priceDiff > 0;
                  const isMe = processingId === q.id;
                  const isExpanded = expandedQuotes.has(q.id);
                  const hasLargeGap = pricePct !== null && Math.abs(pricePct) >= 10;

                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: "18px 20px",
                        borderRadius: "var(--radius-lg)",
                        border: hasLargeGap ? "1.5px solid rgba(239,68,68,0.4)" : "1.5px solid var(--border-medium)",
                        background: hasLargeGap
                          ? "linear-gradient(180deg, var(--bg-surface) 0%, rgba(239,68,68,0.02) 100%)"
                          : "var(--bg-surface)",
                        boxShadow: "var(--shadow-sm)",
                        opacity: isMe && pending ? 0.65 : 1,
                        transition: "all 200ms",
                        textAlign: isRTL ? "right" : "left",
                      }}
                    >
                      {/* Card Top Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <div>
                          <div style={{ display: "flex", gap: "6px", marginBottom: "6px", alignItems: "center", flexDirection: isRTL ? "row-reverse" : "row" }}>
                            <span className="badge" style={{ fontSize: "10px" }}>{q.category_name}</span>
                            <span className="badge badge-strong" style={{ fontSize: "10px" }}>{q.supplier_name}</span>
                            <span className="badge" style={{ fontSize: "10px" }}>{formatMonthLabel(q.month)}</span>
                            {hasLargeGap && (
                              <span style={{
                                background: "rgba(239,68,68,0.12)",
                                color: "var(--danger)",
                                border: "1px solid rgba(239,68,68,0.35)",
                                borderRadius: "6px",
                                padding: "2px 8px",
                                fontSize: "10px",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}>
                                ⚠️ {t("scapp.largeGap")}
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 4px" }}>
                            {q.item_name} <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400 }}>({q.unit})</span>
                          </h3>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {isAr ? "مقدم بواسطة" : "Collected by"} <strong style={{ color: "var(--text-secondary)" }}>{q.collected_by}</strong> · {formatDateTime(q.recorded_at)}
                          </div>
                        </div>

                        {/* Price Variance Display */}
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          padding: "8px 16px",
                          flexDirection: isRTL ? "row-reverse" : "row"
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: isRTL ? "flex-end" : "flex-start" }}>
                            <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 800 }}>{t("scapp.submittedPrice")}</span>
                            <strong style={{ fontSize: "16px", color: "var(--text-primary)" }}>{formatCurrency(q.price)}</strong>
                            {q.actual_transport !== null && (
                              <span style={{ fontSize: "9.5px", color: "var(--text-muted)" }}>
                                🚗 {isAr ? "النقل:" : "Transport:"} {formatCurrency(q.actual_transport)}
                              </span>
                            )}
                          </div>

                          <div style={{ width: "1px", height: "30px", background: "var(--border)" }} />

                          <div style={{ display: "flex", flexDirection: "column", alignItems: isRTL ? "flex-end" : "flex-start" }}>
                            <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 800 }}>{t("scapp.prevPrice")}</span>
                            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                              {prevPrice !== null ? formatCurrency(prevPrice) : "—"}
                            </span>
                          </div>

                          {pricePct !== null && (
                            <>
                              <div style={{ width: "1px", height: "30px", background: "var(--border)" }} />
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <span style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 800 }}>{t("scapp.variance")}</span>
                                <span style={{
                                  fontSize: "13px",
                                  fontWeight: 800,
                                  color: isIncrease ? "var(--danger)" : "var(--success)"
                                }}>
                                  {isIncrease ? "▲" : "▼"} {Math.abs(pricePct).toFixed(1)}%
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* WH Notes */}
                      {q.notes && (
                        <div style={{
                          padding: "8px 12px",
                          marginTop: "12px",
                          background: "var(--bg-subtle)",
                          borderRadius: "8px",
                          borderInlineStart: "3px solid var(--primary)",
                          fontSize: "12px",
                          color: "var(--text-secondary)"
                        }}>
                          <strong>{isAr ? "ملاحظة المشتريات:" : "WH Note:"} </strong>{q.notes}
                        </div>
                      )}

                      {/* Detail Toggle Action */}
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(q.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary)",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: "12px",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          <span>🔍</span>
                          <span>{isExpanded ? t("scapp.hideDetails") : t("scapp.showDetails")}</span>
                        </button>
                      </div>

                      {/* Expanded Section: Price Histories */}
                      {isExpanded && (
                        <div style={{
                          marginTop: "16px",
                          padding: "16px",
                          background: "var(--bg-elevated)",
                          borderRadius: "10px",
                          border: "1px solid var(--border-light)",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "16px",
                        }}>
                          {/* Purchasing History */}
                          <div>
                            <h4 style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                              📊 {t("scapp.purchHistory")}
                            </h4>
                            {q.purchHistory.length === 0 ? (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                                {isAr ? "لا يوجد سجل شراء سابق" : "No previous purchasing history"}
                              </div>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1.5px solid var(--border)" }}>
                                    <th style={{ textAlign: isRTL ? "right" : "left", padding: "4px" }}>{isAr ? "الشهر" : "Month"}</th>
                                    <th style={{ textAlign: "right", padding: "4px" }}>{isAr ? "السعر" : "Price"}</th>
                                    <th style={{ textAlign: isRTL ? "right" : "left", padding: "4px" }}>{isAr ? "ملاحظة" : "Note"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {q.purchHistory.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                      <td style={{ padding: "4px" }}>{formatMonthLabel(p.month)}</td>
                                      <td style={{ textAlign: "right", padding: "4px", fontWeight: 700 }}>{formatCurrency(p.price)}</td>
                                      <td style={{ padding: "4px", color: "var(--text-muted)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {p.notes || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Selling Price History */}
                          <div>
                            <h4 style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                              🏷️ {t("scapp.sellHistory")}
                            </h4>
                            {q.sellHistory.length === 0 ? (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                                {isAr ? "لا يوجد سجل بيع سابق" : "No previous selling history"}
                              </div>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1.5px solid var(--border)" }}>
                                    <th style={{ textAlign: isRTL ? "right" : "left", padding: "4px" }}>{isAr ? "الشهر" : "Month"}</th>
                                    <th style={{ textAlign: "right", padding: "4px" }}>{isAr ? "متوسط الشراء" : "Buy Avg"}</th>
                                    <th style={{ textAlign: "right", padding: "4px" }}>{isAr ? "سعر البيع" : "Sell Price"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {q.sellHistory.map((s, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                      <td style={{ padding: "4px" }}>{formatMonthLabel(s.month)}</td>
                                      <td style={{ textAlign: "right", padding: "4px" }}>{formatCurrency(s.buy_avg)}</td>
                                      <td style={{ textAlign: "right", padding: "4px", fontWeight: 700, color: "var(--success)" }}>
                                        {s.sell_min === s.sell_max ? formatCurrency(s.sell_min) : `${formatCurrency(s.sell_min)}–${formatCurrency(s.sell_max)}`}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions Section */}
                      <div style={{
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid var(--border-light)",
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-end",
                        flexDirection: isRTL ? "row-reverse" : "row"
                      }}>
                        <label className="field" style={{ flex: 1, margin: 0, textAlign: isRTL ? "right" : "left" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                            {isAr ? "ملاحظة المراجعة" : "Review Note"}{" "}
                            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                              ({isAr ? "مطلوبة للرفض" : "required for rejection"})
                            </span>
                          </span>
                          <input
                            type="text"
                            value={reviewNotes[q.id] ?? ""}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder={isAr ? "اكتب ملاحظتك هنا..." : "Write review decision note..."}
                            dir={isRTL ? "rtl" : "ltr"}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid var(--border-medium)",
                              background: "var(--bg-elevated)",
                              color: "var(--text-primary)",
                              fontSize: "13px",
                              textAlign: isRTL ? "right" : "left",
                              marginTop: "4px"
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => handleApproveQuote(q.id)}
                          disabled={pending}
                          className="button button-success"
                          style={{ padding: "9px 18px", fontSize: "12px", whiteSpace: "nowrap", height: "37px" }}
                        >
                          {isMe && processingType === "approve" ? t("scapp.approving") : `✓ ${isAr ? "موافقة" : "Approve"}`}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRejectQuote(q.id)}
                          disabled={pending}
                          className="button button-danger"
                          style={{ padding: "9px 18px", fontSize: "12px", whiteSpace: "nowrap", height: "37px" }}
                        >
                          {isMe && processingType === "reject" ? t("scapp.rejecting") : `✕ ${isAr ? "رفض" : "Reject"}`}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "revisions" && (
            <PriceChangeRequests requests={pendingRevisions} username={username} />
          )}
        </div>
      )}

      {/* ════════ OUTGOING TAB ════════ */}
      {topTab === "outgoing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* ── Status Filter Pills ── */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", flexDirection: isRTL ? "row-reverse" : "row" }}>
            {([
              { id: "all" as const, label: isAr ? "الكل" : "All", count: outgoingProposals.length, color: "var(--text-secondary)" },
              { id: "pending" as const, label: isAr ? "بانتظار الاعتماد" : "Pending", count: outgoingPendingCount, color: "#f59e0b" },
              { id: "approved" as const, label: isAr ? "معتمد" : "Approved", count: outgoingApprovedCount, color: "var(--success)" },
              { id: "reconsidered" as const, label: isAr ? "أعيد للمراجعة" : "Reconsidered", count: outgoingReconsideredCount, color: "var(--danger)" },
            ]).map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setOutgoingFilter(pill.id)}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: outgoingFilter === pill.id ? 700 : 500,
                  borderRadius: "20px",
                  border: `1.5px solid ${outgoingFilter === pill.id ? pill.color : "var(--border)"}`,
                  background: outgoingFilter === pill.id ? `${pill.color}15` : "var(--bg-elevated)",
                  color: outgoingFilter === pill.id ? pill.color : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 150ms",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                {pill.label}
                <span style={{
                  background: outgoingFilter === pill.id ? pill.color : "var(--border-medium)",
                  color: "#fff",
                  padding: "0 6px",
                  borderRadius: "99px",
                  fontSize: "10px",
                  fontWeight: 800,
                  lineHeight: "17px",
                }}>{pill.count}</span>
              </button>
            ))}
          </div>

          {/* ── Outgoing Proposals Table ── */}
          {filteredOutgoing.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "14px" }}>
              <span style={{ fontSize: "36px", display: "block", marginBottom: "12px" }}>📭</span>
              {t("scapp.noOutgoing")}
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)", borderBottom: "2px solid var(--border-medium)" }}>
                    {[
                      isAr ? "الشهر" : "Month",
                      isAr ? "المنتج" : "Item",
                      isAr ? "القسم" : "Category",
                      isAr ? "الاستراتيجية" : "Strategy",
                      isAr ? "المورد المؤكد" : "Confirmed Supplier",
                      isAr ? "نطاق البيع" : "Sell Range",
                      isAr ? "الحالة" : "Status",
                    ].map(h => (
                      <th key={h} style={{
                        padding: "11px 14px",
                        textAlign: isRTL ? "right" : "left",
                        fontWeight: 700,
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOutgoing.map((p, i) => {
                    const statusColor = p.approval_status === "approved"
                      ? "var(--success)"
                      : p.approval_status === "reconsidered"
                        ? "var(--danger)"
                        : "#f59e0b";
                    const statusLabel = p.approval_status === "approved"
                      ? (isAr ? "معتمد" : "Approved")
                      : p.approval_status === "reconsidered"
                        ? (isAr ? "أعيد للمراجعة" : "Reconsidered")
                        : (isAr ? "بانتظار الاعتماد" : "Pending");
                    const statusIcon = p.approval_status === "approved" ? "✅" : p.approval_status === "reconsidered" ? "🔄" : "⏳";

                    return (
                      <tr key={p.id} style={{
                        backgroundColor: i % 2 === 0 ? "transparent" : "var(--bg-subtle)",
                        borderBottom: "1px solid var(--border-light)",
                      }}>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatMonthLabel(p.month)}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.item_name}</div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{p.unit}</div>
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                          {p.category_name}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <span className="badge" style={{ fontSize: "10px", textTransform: "uppercase" }}>{p.strategy}</span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--text-primary)", fontWeight: 600 }}>
                          {p.supplier_fame_name || p.supplier_name || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontWeight: 700, color: "var(--primary)" }}>
                          {formatCurrency(p.sell_min)} – {formatCurrency(p.sell_max)}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: statusColor,
                            background: `${statusColor}12`,
                            border: `1px solid ${statusColor}40`,
                            borderRadius: "6px",
                            padding: "3px 10px",
                          }}>
                            {statusIcon} {statusLabel}
                          </span>
                          {p.approval_status === "reconsidered" && p.reconsider_note && (
                            <div style={{ fontSize: "10px", color: "var(--danger)", marginTop: "4px", maxWidth: "180px" }} title={p.reconsider_note}>
                              💬 {p.reconsider_note.length > 40 ? p.reconsider_note.slice(0, 40) + "…" : p.reconsider_note}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
