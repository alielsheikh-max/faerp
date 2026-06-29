"use client";

import { useState } from "react";
import { formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import type { PriceChangeRequest } from "@/lib/db";
import { useI18n } from "@/lib/i18n-context";

type Mode = "sc" | "wh" | "wh-pending";

type Props = {
  requests: PriceChangeRequest[];
  mode: Mode;
};

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  pending:  { bg: "var(--warning-light)",  border: "rgba(217,119,6,0.3)",  color: "var(--warning)",  icon: "⏳" },
  approved: { bg: "var(--success-light)",  border: "rgba(16,185,129,0.3)", color: "var(--success)",  icon: "✓" },
  rejected: { bg: "var(--danger-light)",   border: "rgba(220,38,38,0.3)",  color: "var(--danger)",   icon: "✕" },
};

export default function ApprovalsHistory({ requests, mode }: Props) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const getStatusLabel = (status: string) => {
    if (status === "pending") return t("gen.pending");
    if (status === "approved") return t("gen.approved");
    if (status === "rejected") return t("gen.rejected");
    return status;
  };

  const [search, setSearch]         = useState("");
  const [statusFilter, setFilter]   = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [expanded, setExpanded]     = useState<Set<number>>(new Set());

  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const filtered = requests.filter(r => {
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || (r.item_name ?? "").toLowerCase().includes(q)
      || (r.supplier_name ?? "").toLowerCase().includes(q)
      || (r.category_name ?? "").toLowerCase().includes(q)
      || r.reason.toLowerCase().includes(q)
      || r.month.includes(q);
    return matchStatus && matchSearch;
  });

  if (requests.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
        <span style={{ fontSize: "32px", display: "block", marginBottom: "10px" }}>📭</span>
        {isAr ? "لا توجد سجلات لعرضها." : "No records to display."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", flexDirection: isAr ? "row-reverse" : "row" }}>
        <input
          type="text"
          placeholder={isAr ? "البحث بالصنف، المورد، السبب..." : "Search by item, supplier, reason…"}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: "1 1 200px", padding: "8px 12px", borderRadius: "8px",
            border: "1px solid var(--border-medium)", background: "var(--bg-elevated)",
            color: "var(--text-primary)", fontSize: "13px", outline: "none",
            textAlign: isAr ? "right" : "left",
          }}
        />
        <div style={{ display: "flex", gap: "4px", background: "var(--bg-subtle)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)", flexDirection: isAr ? "row-reverse" : "row" }}>
          {(["all", "pending", "approved", "rejected"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`button ${statusFilter === s ? "button-primary" : "button-secondary"}`}
              style={{ padding: "5px 12px", fontSize: "11px", borderRadius: "6px", cursor: "pointer" }}
            >
              {s === "all" ? (isAr ? `الكل (${requests.length})` : `All (${requests.length})`) :
               s === "pending"  ? `⏳ ${requests.filter(r => r.status === "pending").length}` :
               s === "approved" ? `✓ ${requests.filter(r => r.status === "approved").length}` :
               `✕ ${requests.filter(r => r.status === "rejected").length}`}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {filtered.length !== requests.length && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: isAr ? "right" : "left" }}>
          {isAr ? `عرض ${filtered.length} من أصل ${requests.length} طلبات` : `Showing ${filtered.length} of ${requests.length} requests`}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "13px" }}>
          {isAr ? "لا توجد طلبات تطابق معايير التصفية." : "No requests match your filters."}
        </div>
      )}

      {/* Request cards */}
      {filtered.map(req => {
        const style   = STATUS_STYLE[req.status] ?? STATUS_STYLE.pending;
        const diff    = req.new_price - req.old_price;
        const pct     = req.old_price > 0 ? (diff / req.old_price) * 100 : 0;
        const isOpen  = expanded.has(req.id);

        return (
          <div
            key={req.id}
            style={{
              borderRadius: "var(--radius-lg)",
              border: `1.5px solid ${isOpen ? style.border : "var(--border)"}`,
              background: "var(--bg-surface)",
              boxShadow: "var(--shadow-sm)",
              overflow: "hidden",
              transition: "border-color 150ms",
            }}
          >
            {/* ── Collapsed header row ── */}
            <div
              onClick={() => toggle(req.id)}
              className="approvals-history-header"
              style={{
                background: isOpen ? `${style.bg}` : "transparent",
                transition: "background 150ms",
                direction: isAr ? "rtl" : "ltr",
              }}
            >
              {/* Chevron */}
              <span style={{
                fontSize: "11px", color: isOpen ? style.color : "var(--text-muted)",
                transform: isAr ? (isOpen ? "rotate(90deg)" : "rotate(180deg)") : (isOpen ? "rotate(90deg)" : "rotate(0deg)"),
                transition: "transform 200ms", flexShrink: 0,
              }}>{isAr ? "◀" : "▶"}</span>

              {/* Item + supplier */}
              <div style={{ minWidth: 0, textAlign: isAr ? "right" : "left" }}>
                <div style={{
                  fontWeight: 700, fontSize: "13px",
                  color: isOpen ? style.color : "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {req.item_name}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px", display: "inline-flex", gap: "6px", flexWrap: "wrap", flexDirection: isAr ? "row-reverse" : "row" }}>
                  <span>{req.supplier_name}</span>
                  <span>·</span>
                  <span>{formatMonthLabel(req.month)}</span>
                  <span>·</span>
                  <span>{req.category_name}</span>
                </div>
              </div>

              {/* Metadata details wrapper */}
              <div className="approvals-history-meta-wrapper">
                {/* Price change pill */}
                <div style={{
                  padding: "3px 10px", borderRadius: "99px",
                  background: diff > 0 ? "var(--danger-light)" : "var(--success-light)",
                  border: `1px solid ${diff > 0 ? "rgba(220,38,38,0.25)" : "rgba(16,185,129,0.25)"}`,
                  fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap",
                  color: diff > 0 ? "var(--danger)" : "var(--success)",
                }}>
                  {diff > 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
                  {" "}({formatCurrency(req.old_price)} → {formatCurrency(req.new_price)})
                </div>

                {/* Date */}
                <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatDateTime(req.requested_at)}
                </span>

                {/* Status badge */}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "3px 9px", borderRadius: "99px", fontSize: "10px", fontWeight: 700,
                  background: style.bg, border: `1px solid ${style.border}`, color: style.color,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {style.icon} {getStatusLabel(req.status)}
                </span>
              </div>
            </div>

            {/* ── Expanded detail ── */}
            {isOpen && (
              <div style={{
                padding: "0 16px 16px",
                borderTop: "1px solid var(--border-light)",
                background: "var(--bg-elevated)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                direction: isAr ? "rtl" : "ltr",
              }}>
                <div style={{ height: "12px" }} />

                {/* Price comparison */}
                <div className="approvals-history-diff" style={{
                  display: "flex", gap: "16px", alignItems: "center",
                  padding: "12px 16px",
                  background: diff > 0 ? "var(--danger-light)" : "var(--success-light)",
                  border: `1px solid ${diff > 0 ? "rgba(220,38,38,0.2)" : "rgba(16,185,129,0.2)"}`,
                  borderRadius: "var(--radius)",
                  flexDirection: isAr ? "row-reverse" : "row",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>{isAr ? "السعر السابق" : "Old Price"}</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-secondary)", textDecoration: "line-through" }}>{formatCurrency(req.old_price)}</div>
                  </div>
                  <div style={{ fontSize: "20px", color: "var(--text-muted)" }}>{isAr ? "←" : "→"}</div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>{isAr ? "السعر الجديد" : "New Price"}</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: diff > 0 ? "var(--danger)" : "var(--success)" }}>{formatCurrency(req.new_price)}</div>
                  </div>
                  <div style={{ marginInlineStart: isAr ? "0" : "auto", marginInlineEnd: isAr ? "auto" : "0", textAlign: isAr ? "left" : "right" }}>
                    <div style={{ fontWeight: 800, fontSize: "16px", color: diff > 0 ? "var(--danger)" : "var(--success)" }}>
                      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(2)} EGP
                    </div>
                    <div style={{ fontSize: "12px", color: diff > 0 ? "var(--danger)" : "var(--success)", fontWeight: 700 }}>
                      ({Math.abs(pct).toFixed(1)}%)
                    </div>
                  </div>
                </div>

                {/* WH Reason */}
                <div style={{
                  padding: "10px 14px",
                  background: "var(--bg-subtle)", borderRadius: "var(--radius)",
                  borderInlineStart: isAr ? "none" : "3px solid var(--warning)",
                  borderInlineEnd: isAr ? "3px solid var(--warning)" : "none",
                  textAlign: isAr ? "right" : "left",
                }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>{isAr ? "سبب تعديل المشتريات" : "WH Change Reason"}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{req.reason}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                    {isAr ? (
                      <>تم الإرسال بواسطة <strong>{req.requested_by}</strong> · {formatDateTime(req.requested_at)}</>
                    ) : (
                      <>Submitted by <strong>{req.requested_by}</strong> · {formatDateTime(req.requested_at)}</>
                    )}
                  </div>
                </div>

                {/* SC Review result — shown if resolved */}
                {req.status !== "pending" && (
                  <div style={{
                    padding: "10px 14px",
                    background: req.status === "approved" ? "var(--success-light)" : "var(--danger-light)",
                    borderRadius: "var(--radius)",
                    borderInlineStart: isAr ? "none" : `3px solid ${req.status === "approved" ? "var(--success)" : "var(--danger)"}`,
                    borderInlineEnd: isAr ? `3px solid ${req.status === "approved" ? "var(--success)" : "var(--danger)"}` : "none",
                    textAlign: isAr ? "right" : "left",
                  }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px",
                      color: req.status === "approved" ? "var(--success)" : "var(--danger)" }}>
                      {isAr ? (
                        <>مراجعة المدير: {req.status === "approved" ? "مقبول" : "مرفوض"}</>
                      ) : (
                        <>SC {req.status === "approved" ? "Approved" : "Rejected"}</>
                      )}
                    </div>
                    {req.review_note && (
                      <div style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "4px" }}>
                        {req.review_note}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {isAr ? (
                        <>تمت المراجعة بواسطة <strong>{req.reviewed_by}</strong> · {formatDateTime(req.reviewed_at)}</>
                      ) : (
                        <>Reviewed by <strong>{req.reviewed_by}</strong> · {formatDateTime(req.reviewed_at)}</>
                      )}
                    </div>
                  </div>
                )}

                {/* Pending message for WH */}
                {req.status === "pending" && mode !== "sc" && (
                  <div style={{
                    padding: "10px 14px",
                    background: "var(--warning-light)", borderRadius: "var(--radius)",
                    borderInlineStart: isAr ? "none" : "3px solid var(--warning)",
                    borderInlineEnd: isAr ? "3px solid var(--warning)" : "none",
                    fontSize: "12px", color: "var(--warning)", fontWeight: 600,
                    textAlign: isAr ? "right" : "left",
                  }}>
                    ⏳ {isAr ? "في انتظار مراجعة مدير سلسلة الإمداد. السعر الحالي يظل نشطًا حتى تتم الموافقة." : "Awaiting SC Manager review. The current price remains active until approved."}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
