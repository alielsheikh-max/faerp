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

type Props = {
  pendingQuotes: PendingQuote[];
  pendingRevisions: PriceChangeRequest[];
  username: string;
  month: string;
};

export default function ApprovalsCenterClient({ pendingQuotes, pendingRevisions, username, month }: Props) {
  const { t, locale, isRTL } = useI18n();
  const isAr = locale === "ar";
  const router = useRouter();

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* ── Tabs Navigation ── */}
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

      {/* ── Tab Content ── */}
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

              // 10% is defined as the large gap threshold
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
  );
}
