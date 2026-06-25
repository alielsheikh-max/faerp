"use client";

import { useState, useTransition, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { formatCurrency, formatMonthLabel, formatDateTime } from "@/lib/format";
import { saveSellingPriceInline, approvePriceEntryAction, rejectPriceEntryAction } from "@/app/actions/pricing";
import { useI18n } from "@/lib/i18n-context";

const SUPPLIER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

// ── Types (must match getMonthlyReviewData return shape) ──────────────────────
type SupplierQuote = {
  quoteId: number;
  supplierId: number;
  supplierName: string;
  price: number;
  recordedAt: string;
  status: string;
  reviewNote: string | null;
  notes: string | null;
  actualTransport: number | null;
};

type HistoryEntry = {
  item_id: number;
  supplier_id: number;
  supplier_name: string;
  month: string;
  price: number;
};

type ExistingSell = {
  sell_min: number;
  sell_max: number;
  strategy: string;
  created_by: string;
  created_at: string;
  tier_pricing_enabled?: number;
  other_expenses?: number;
  markup_type?: string;
  markup_min?: number;
  markup_max?: number;
} | null;

type SellingHistoryEntry = {
  item_id: number;
  month: string;
  sell_min: number;
  sell_max: number;
  strategy: string;
};

type LastConfirmedBuyingEntry = {
  item_id: number;
  price: number;
  month: string;
  supplier_name: string;
  recorded_at: string;
};

type LastConfirmedSellingEntry = {
  item_id: number;
  sell_min: number;
  sell_max: number;
  month: string;
  strategy: string;
  created_at: string;
  created_by: string;
};

type ReviewItem = {
  itemId: number;
  itemName: string;
  unit: string;
  categoryId: number;
  categoryName: string;
  suppliers: SupplierQuote[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  existingSell: ExistingSell;
  history: HistoryEntry[];
  sellingHistory: SellingHistoryEntry[];
  lastConfirmedBuying: LastConfirmedBuyingEntry | null;
  lastConfirmedSelling: LastConfirmedSellingEntry | null;
  transportation_per_unit: number;
  moq: number;
  is_tiered: number;
  tier1_max: number;
  tier1_discount: number;
  tier2_max: number;
  tier2_discount: number;
  tier3_max: number;
  tier3_discount: number;
  tier4_max: number;
  tier4_discount: number;
  recommendedSupplierId: number | null;
};

type ReviewCategory = {
  categoryId: number;
  categoryName: string;
  items: ReviewItem[];
};

type Props = {
  month: string;
  username: string;
  data: ReviewCategory[];
  /** "sidebar" (default) = compact button; "dashboard" = full card tile */
  variant?: "sidebar" | "dashboard";
};

// ── Supplier quote card with inline approvals ──────────────────────────────────
const SupplierQuoteCard = memo(function SupplierQuoteCard({
  q,
  itemId,
  month,
  username,
  color,
  isBest,
  isRecommended,
}: {
  q: SupplierQuote;
  itemId: number;
  month: string;
  username: string;
  color: string;
  isBest: boolean;
  isRecommended: boolean;
}) {
  const { t, locale } = useI18n();
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleApprove = () => {
    setActionError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("entryId", String(q.quoteId));
      fd.append("reviewedBy", username);
      fd.append("reviewNote", reviewNote);
      const res = await approvePriceEntryAction(fd);
      if (!res.ok) {
        setActionError(res.error ?? "Failed to consider");
      } else {
        setReviewNote("");
      }
    });
  };

  const handleReject = () => {
    if (!reviewNote.trim()) {
      setActionError(locale === "ar" ? "ملاحظة الرفض مطلوبة" : "Rejection note is required");
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("entryId", String(q.quoteId));
      fd.append("reviewedBy", username);
      fd.append("reviewNote", reviewNote);
      const res = await rejectPriceEntryAction(fd);
      if (!res.ok) {
        setActionError(res.error ?? "Failed to reject");
      } else {
        setReviewNote("");
      }
    });
  };

  // Render status badge
  const renderStatusBadge = () => {
    switch (q.status) {
      case "approved":
        return (
          <span
            style={{
              fontSize: "9px",
              fontWeight: 800,
              background: "rgba(16, 185, 129, 0.15)",
              color: "var(--success)",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            {locale === "ar" ? "✓ معتمد" : "✓ Considered"}
          </span>
        );
      case "rejected":
        return (
          <span
            style={{
              fontSize: "9px",
              fontWeight: 800,
              background: "rgba(239, 68, 68, 0.15)",
              color: "var(--danger)",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            {locale === "ar" ? "✕ مرفوض" : "✕ Rejected"}
          </span>
        );
      default:
        return (
          <span
            style={{
              fontSize: "9px",
              fontWeight: 800,
              background: "rgba(245, 158, 11, 0.15)",
              color: "var(--warning)",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            {locale === "ar" ? "⏳ قيد المراجعة" : "⏳ Pending"}
          </span>
        );
    }
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "var(--radius)",
        border: `1.5px solid ${isBest ? "var(--info)" : color + "44"}`,
        background: isBest ? "var(--info-light)" : color + "0a",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {/* Top row with supplier name and status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
          <span
            onClick={() => window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: q.supplierId } }))}
            className="clickable-detail-trigger"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {q.supplierName}
          </span>
          {isRecommended && <span style={{ color: "#eab308", fontSize: "13px", flexShrink: 0 }} title={locale === "ar" ? "المورد الموصى به" : "Recommended Supplier"}>⭐</span>}
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
          {isBest && (
            <span
              style={{
                fontSize: "8px",
                fontWeight: 800,
                background: "var(--info)",
                color: "#fff",
                padding: "1px 5px",
                borderRadius: "4px",
              }}
            >
              {t("gen.best")}
            </span>
          )}
          {isRecommended && (
            <span
              style={{
                fontSize: "8px",
                fontWeight: 800,
                background: "rgba(234, 179, 8, 0.15)",
                color: "#ca8a04",
                padding: "1px 5px",
                borderRadius: "4px",
                border: "1px solid rgba(234, 179, 8, 0.3)",
              }}
            >
              {locale === "ar" ? "موصى" : "REC"}
            </span>
          )}
          {renderStatusBadge()}
        </div>
      </div>

      {/* Price and date */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div
          style={{
            fontSize: "18px",
            fontWeight: 800,
            color: isBest ? "var(--info)" : "var(--text-primary)",
          }}
        >
          {formatCurrency(q.price)}
        </div>
        <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>
          {formatDateTime(q.recordedAt)}
        </div>
      </div>

      {/* Notes / Transport info */}
      {q.notes && (
        <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", background: "rgba(0,0,0,0.02)", padding: "4px 6px", borderRadius: "4px", fontStyle: "italic" }}>
          "{q.notes}"
        </div>
      )}
      {q.actualTransport !== null && (
        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {locale === "ar" ? "النقل الفعلي: " : "Act. Trans: "}<strong>{formatCurrency(q.actualTransport)}</strong>
        </div>
      )}

      {/* Decision block for pending status */}
      {q.status === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px", borderTop: "1px dashed var(--border-light)", paddingTop: "8px" }}>
          <input
            type="text"
            placeholder={locale === "ar" ? "ملاحظة (مطلوبة للرفض)..." : "Note (required for reject)..."}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            disabled={pending}
            style={{
              width: "100%",
              padding: "5px 8px",
              fontSize: "11px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              type="button"
              onClick={handleApprove}
              disabled={pending}
              style={{
                padding: "5px 8px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#fff",
                background: "var(--success)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "..." : (locale === "ar" ? "اعتماد" : "Consider")}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={pending}
              style={{
                padding: "5px 8px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#fff",
                background: "var(--danger)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "..." : (locale === "ar" ? "رفض" : "Reject")}
            </button>
          </div>
        </div>
      )}

      {/* Rejection/Approval note feedback */}
      {q.status === "rejected" && q.reviewNote && (
        <div style={{ fontSize: "10.5px", color: "var(--danger)", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)", padding: "6px 8px", borderRadius: "4px", marginTop: "4px" }}>
          <strong>{locale === "ar" ? "سبب الرفض: " : "Rejection note: "}</strong>
          {q.reviewNote}
        </div>
      )}
      {q.status === "approved" && q.reviewNote && (
        <div style={{ fontSize: "10.5px", color: "var(--success)", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)", padding: "6px 8px", borderRadius: "4px", marginTop: "4px" }}>
          <strong>{locale === "ar" ? "ملاحظة الاعتماد: " : "Consideration note: "}</strong>
          {q.reviewNote}
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: "10px", color: "var(--danger)", marginTop: "2px", fontWeight: 600 }}>
          ⚠️ {actionError}
        </div>
      )}
    </div>
  );
});

const ItemRow = memo(function ItemRow({
  item,
  month,
  username,
  supplierColorMap,
  allSuppliers,
}: {
  item: ReviewItem;
  month: string;
  username: string;
  supplierColorMap: Map<string, string>;
  allSuppliers: SupplierQuote[];
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [historyWindow, setHistoryWindow] = useState<3 | 6 | 9>(3);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(
    item.suppliers.length > 0 ? item.suppliers[0].supplierId : null
  );
  const isTiered = item.is_tiered === 1;

  const hasPending = item.suppliers.some(q => q.status === 'pending');
  const hasRejected = item.suppliers.some(q => q.status === 'rejected');
  const hasApproved = item.suppliers.some(q => q.status === 'approved');
  const allRejected = item.suppliers.length > 0 && item.suppliers.every(q => q.status === 'rejected');

  const isPublished = !!item.existingSell;
  const spread = item.minPrice > 0
    ? (((item.maxPrice - item.minPrice) / item.minPrice) * 100).toFixed(1)
    : "0.0";

  return (
    <div
      style={{
        borderRadius: "var(--radius)",
        border: `1.5px solid ${open ? "var(--primary)" : isPublished ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
        overflow: "hidden",
        transition: "border-color 150ms",
        background: "var(--bg-surface)",
      }}
    >
      {/* ── Collapsed header row ── */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto auto auto",
          gap: "12px",
          alignItems: "center",
          padding: "11px 16px",
          cursor: "pointer",
          background: open ? "var(--primary-light)" : "transparent",
          transition: "background 150ms",
          userSelect: "none",
        }}
      >
        {/* Chevron */}
        <span
          style={{
            fontSize: "11px",
            color: open ? "var(--primary)" : "var(--text-muted)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 200ms",
            flexShrink: 0,
          }}
        >
          ▶
        </span>

        {/* Name */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: open ? "var(--primary)" : "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span
              onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: item.itemId } })); }}
              className="clickable-detail-trigger"
            >
              {item.itemName}
            </span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
            {item.unit} · {item.suppliers.length} supplier{item.suppliers.length !== 1 ? "s" : ""}
          </div>
          {item.recommendedSupplierId && !item.suppliers.some(q => q.supplierId === item.recommendedSupplierId) && (
            <div style={{
              fontSize: "9px", fontWeight: 800, color: "#ca8a04",
              background: "rgba(234, 179, 8, 0.12)", border: "1px solid rgba(234, 179, 8, 0.25)",
              padding: "1px 6px", borderRadius: "4px", marginTop: "3px",
              display: "inline-flex", alignItems: "center", gap: "3px",
            }}>
              ⭐ {locale === "ar" ? "الموصى لم يسعّر" : "Rec. Not Quoted"}
            </div>
          )}
        </div>

        {/* Supplier color dots */}
        <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
          {item.suppliers.map((q) => (
            <span
              key={q.supplierId}
              title={q.supplierName}
              onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: q.supplierId } })); }}
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: supplierColorMap.get(q.supplierName) ?? "#94a3b8",
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        {/* Min price */}
        <span style={{ fontSize: "12px", color: "var(--success)", fontWeight: 700, whiteSpace: "nowrap" }}>
          ↓ {formatCurrency(item.minPrice)}
        </span>

        {/* Avg price */}
        <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 700, whiteSpace: "nowrap" }}>
          ⌀ {formatCurrency(item.avgPrice)}
        </span>

        {/* Status badges */}
        {(() => {
          if (isPublished) {
            return (
              <span
                className="badge badge-success"
                style={{ fontSize: "10px", padding: "2px 8px", whiteSpace: "nowrap" }}
              >
                {locale === "ar" ? "✓ منشور" : "✓ Published"}
              </span>
            );
          }
          if (hasPending) {
            return (
              <span
                className="badge badge-warning"
                style={{ fontSize: "10px", padding: "2px 8px", whiteSpace: "nowrap" }}
              >
                {locale === "ar" ? "⏳ قيد المراجعة" : "⏳ Pending Review"}
              </span>
            );
          }
          if (allRejected) {
            return (
              <span
                className="badge badge-danger"
                style={{ fontSize: "10px", padding: "2px 8px", whiteSpace: "nowrap", background: "var(--danger)", color: "#fff" }}
              >
                {locale === "ar" ? "✕ مرفوض" : "✕ Rejected"}
              </span>
            );
          }
          return (
            <span
              className="badge"
              style={{ fontSize: "10px", padding: "2px 8px", whiteSpace: "nowrap", background: "var(--info)", color: "#fff" }}
            >
              {locale === "ar" ? "💡 جاهز للتسعير" : "💡 Ready to Price"}
            </span>
          );
        })()}
      </div>

      {/* ── Expanded detail ── */}
      {open && (
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid var(--border-light)",
            background: "var(--bg-elevated)",
          }}
        >
          {/* Two-column layout grid */}
          <div
            className="mobile-stack"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
              gap: "24px",
              alignItems: "start",
            }}
          >
            {/* ── Column 1: Current Inputs & Action Panel ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", marginBottom: "8px" }}>
                  👋 {locale === "ar" ? "عروض الأسعار الحالية (اختر للمقارنة)" : "Current Quotes (Select to Compare)"}
                </p>
                {/* Supplier price cards */}
                <div
                  className="mobile-stack"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {item.suppliers.map((q) => {
                    const color = supplierColorMap.get(q.supplierName) ?? "#94a3b8";
                    const isBest = q.price === item.minPrice;
                    const isSelected = selectedSupplierId === q.supplierId;
                    return (
                      <div
                        key={q.quoteId}
                        onClick={() => setSelectedSupplierId(q.supplierId)}
                        style={{
                          cursor: "pointer",
                          borderRadius: "var(--radius)",
                          outline: isSelected ? "2.5px solid var(--primary)" : "1.5px solid transparent",
                          outlineOffset: "2px",
                          transition: "all 150ms ease",
                          transform: isSelected ? "translateY(-2px)" : "none",
                          boxShadow: isSelected ? "0 4px 12px rgba(99,102,241,0.12)" : "none",
                        }}
                      >
                        <SupplierQuoteCard
                          q={q}
                          itemId={item.itemId}
                          month={month}
                          username={username}
                          color={color}
                          isBest={isBest}
                          isRecommended={item.recommendedSupplierId === q.supplierId}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Already published info */}
              {item.existingSell && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--success-light)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    borderRadius: "var(--radius)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--success)" }}>{t("review.currentlyPublished")}</span>
                  <span>
                    <strong style={{ color: "var(--success)" }}>{formatCurrency(item.existingSell.sell_min)}</strong>
                    <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>→</span>
                    <strong style={{ color: "var(--primary)" }}>{formatCurrency(item.existingSell.sell_max)}</strong>
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", marginInlineStart: "auto" }}>
                    by {item.existingSell.created_by} · {formatDateTime(item.existingSell.created_at)}
                  </span>
                </div>
              )}

              {/* MOQ and Transportation info */}
              <div style={{ display: "flex", gap: "12px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: "11.5px" }}>
                <div style={{ flex: 1, color: "var(--text-secondary)" }}>
                  <span>{locale === "ar" ? "تكلفة النقل الثابتة: " : "Fixed Transportation: "}</span>
                  <strong>{formatCurrency(item.transportation_per_unit)}</strong>
                </div>
                {item.moq > 0 && (
                  <div style={{ flex: 1, color: "var(--text-secondary)" }}>
                    <span>{locale === "ar" ? "الحد الأدنى للطلب (MOQ): " : "MOQ: "}</span>
                    <strong>{item.moq} {locale === "ar" ? "وحدة" : "units"}</strong>
                  </div>
                )}
              </div>

              {/* Status guidance message */}
              <div
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius)",
                  fontSize: "12px",
                  fontWeight: 700,
                  textAlign: "center",
                  background: hasPending
                    ? "rgba(245, 158, 11, 0.05)"
                    : allRejected
                    ? "rgba(239, 68, 68, 0.05)"
                    : "rgba(16, 185, 129, 0.05)",
                  border: `1px dashed ${
                    hasPending
                      ? "#f59e0b"
                      : allRejected
                      ? "var(--danger)"
                      : "var(--success)"
                  }`,
                  color: hasPending
                    ? "#d97706"
                    : allRejected
                    ? "var(--danger)"
                    : "var(--success)",
                }}
              >
                {hasPending ? (
                  <span>
                    ⏳ {locale === "ar"
                      ? "يرجى اعتماد (قبول) أو رفض عروض أسعار الموردين المعلقة أعلاه."
                      : "Please consider or reject the pending supplier quotes above."}
                  </span>
                ) : allRejected ? (
                  <span>
                    ✕ {locale === "ar"
                      ? "تم رفض جميع عروض الأسعار لهذا المنتج. يرجى انتظار إعادة التقديم من المستودع."
                      : "All quotes for this item have been rejected. Awaiting WH resubmission."}
                  </span>
                ) : (
                  <span>
                    💡 {locale === "ar"
                      ? "تم اعتماد عروض الأسعار. هذا المنتج جاهز للتسعير في محرك التسعير الرئيسي."
                      : "Quotes considered. This item is ready for pricing in the main pricing engine."}
                  </span>
                )}
              </div>

              {/* Volume Tier Preview — always visible for tiered items */}
              {isTiered && (
                <div style={{
                  padding: "12px",
                  background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(59,130,246,0.06) 100%)",
                  border: "1px dashed rgba(16,185,129,0.3)",
                  borderRadius: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "11.5px"
                }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {locale === "ar" ? "⚡ معاينة شرائح الحجم" : "⚡ Volume Tier Preview"}
                  </div>
                  {(() => {
                    const currentQuote = item.suppliers.find(s => s.supplierId === selectedSupplierId);
                    const buyCost = currentQuote ? currentQuote.price : item.minPrice;
                    const transport = item.transportation_per_unit;
                    const other = item.existingSell ? (item.existingSell.other_expenses ?? 0) : 0;

                    const t1Max  = item.tier1_max;
                    const t1Disc = item.tier1_discount ?? 0;
                    const t2Max  = item.tier2_max;
                    const t2Disc = item.tier2_discount ?? 0;
                    const t3Max  = item.tier3_max ?? 300;
                    const t3Disc = item.tier3_discount ?? 0;
                    const t4Max  = item.tier4_max ?? 0;
                    const t4Disc = item.tier4_discount ?? 0;
                    const has4   = t4Disc > 0;

                    const roundUp5 = (v: number) => v > 0 ? Math.ceil(v / 5) * 5 : v;

                    // Calculate Tier 1 Price using divisor/markup base logic
                    let tier1Price = 0;
                    if (t1Disc > 0 && t1Disc < 1) {
                      tier1Price = roundUp5(buyCost / t1Disc + transport + other);
                    } else {
                      if (item.existingSell) {
                        if (item.existingSell.markup_type === "divisor" && item.existingSell.markup_min && item.existingSell.markup_min > 0) {
                          tier1Price = roundUp5(buyCost / item.existingSell.markup_min + transport + other);
                        } else if (item.existingSell.markup_type === "amount" && item.existingSell.markup_min !== undefined) {
                          tier1Price = roundUp5(buyCost + item.existingSell.markup_min + transport + other);
                        } else {
                          const pct = item.existingSell.markup_min ?? 10;
                          tier1Price = roundUp5(buyCost * (1 + pct / 100) + transport + other);
                        }
                      } else {
                        tier1Price = roundUp5(buyCost * 1.1 + transport + other);
                      }
                    }

                    const baseSellMin = Math.max(0, tier1Price - transport - other);

                    const getTierPrice = (disc: number) => {
                      if (disc <= 0 || buyCost <= 0) return 0;
                      if (disc < 1) {
                        return roundUp5(buyCost / disc + transport + other);
                      }
                      return roundUp5(baseSellMin * (1 - disc / 100) + transport + other);
                    };

                    const tier2Price = getTierPrice(t2Disc);
                    const tier3Price = getTierPrice(t3Disc);
                    const tier4Price = getTierPrice(t4Disc);

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>
                            {locale === "ar" ? `شريحة ١ (٠ - ${t1Max} وحدة)` : `Base Tier (0 – ${t1Max} units)`}
                            {t1Disc > 0 && t1Disc < 1 ? ` ÷ ${t1Disc}` : ""}:
                          </span>
                          <strong style={{ color: "var(--success)" }}>{tier1Price > 0 ? formatCurrency(tier1Price) : "—"}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>
                            {locale === "ar" ? `شريحة ٢ (${t1Max + 1} - ${t2Max} وحدة)` : `Tier 2 (${t1Max + 1} – ${t2Max} units)`}
                            {t2Disc < 1 ? ` ÷ ${t2Disc}` : (locale === "ar" ? ` — خصم ${t2Disc}%` : ` — ${t2Disc}% off`)}:
                          </span>
                          <strong style={{ color: "var(--primary)" }}>{tier2Price > 0 ? formatCurrency(tier2Price) : "—"}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>
                            {locale === "ar" ? `شريحة ٣ (${t2Max + 1} - ${t3Max} وحدة)` : `Tier 3 (${t2Max + 1} – ${t3Max} units)`}
                            {t3Disc < 1 ? ` ÷ ${t3Disc}` : (locale === "ar" ? ` — خصم ${t3Disc}%` : ` — ${t3Disc}% off`)}:
                          </span>
                          <strong style={{ color: "var(--warning)" }}>{tier3Price > 0 ? formatCurrency(tier3Price) : "—"}</strong>
                        </div>
                        {has4 && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>
                              {locale === "ar" ? `شريحة ٤ (${t3Max + 1}${t4Max ? ` - ${t4Max}` : "+"} وحدة)` : `Tier 4 (${t3Max + 1}${t4Max ? ` – ${t4Max}` : "+"} units)`}
                              {t4Disc < 1 ? ` ÷ ${t4Disc}` : (locale === "ar" ? ` — خصم ${t4Disc}%` : ` — ${t4Disc}% off`)}:
                            </span>
                            <strong style={{ color: "var(--danger)" }}>{tier4Price > 0 ? formatCurrency(tier4Price) : "—"}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Column 2: Historical Insights & Margins ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Last Confirmed baseline cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Last Confirmed Buying */}
                <div style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-medium)",
                  background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(99,102,241,0.02) 100%)",
                }}>
                  <div style={{ fontSize: "9px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                    📥 {locale === "ar" ? "آخر شراء معتمد" : "Last Confirmed Buy"}
                  </div>
                  {item.lastConfirmedBuying ? (
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--primary)" }}>
                        {formatCurrency(item.lastConfirmedBuying.price)}
                      </div>
                      <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {locale === "ar" ? "المورد: " : "Supplier: "}<strong>{item.lastConfirmedBuying.supplier_name}</strong>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
                        {locale === "ar" ? "الشهر: " : "Month: "}<strong>{formatMonthLabel(item.lastConfirmedBuying.month)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic", marginTop: "4px" }}>
                      {locale === "ar" ? "لا توجد أسعار شراء سابقة" : "No historical quotes"}
                    </div>
                  )}
                </div>

                {/* Last Confirmed Selling */}
                <div style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-medium)",
                  background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(16,185,129,0.02) 100%)",
                }}>
                  <div style={{ fontSize: "9px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                    🏷️ {locale === "ar" ? "آخر بيع معتمد" : "Last Confirmed Sell"}
                  </div>
                  {item.lastConfirmedSelling ? (
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--success)" }}>
                        {formatCurrency(item.lastConfirmedSelling.sell_min)}
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", margin: "0 3px" }}>→</span>
                        {formatCurrency(item.lastConfirmedSelling.sell_max)}
                      </div>
                      <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {locale === "ar" ? "الاستراتيجية: " : "Strategy: "}<strong>{item.lastConfirmedSelling.strategy.toUpperCase()}</strong>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
                        {locale === "ar" ? "الشهر: " : "Month: "}<strong>{formatMonthLabel(item.lastConfirmedSelling.month)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic", marginTop: "4px" }}>
                      {locale === "ar" ? "لا توجد أسعار بيع سابقة" : "No historical sales"}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Supplier Insights */}
              {(() => {
                const currentQuote = item.suppliers.find(s => s.supplierId === selectedSupplierId);
                if (!currentQuote) return null;
                const supplierHistory = item.history.filter(h => h.supplier_id === selectedSupplierId);
                const prevPrice = supplierHistory[0]?.price;
                const avgHistPrice = supplierHistory.length > 0 
                  ? supplierHistory.reduce((a, b) => a + b.price, 0) / supplierHistory.length 
                  : null;

                let varFromPrev = null;
                if (prevPrice) {
                  varFromPrev = ((currentQuote.price - prevPrice) / prevPrice * 100);
                }
                let varFromAvg = null;
                if (avgHistPrice) {
                  varFromAvg = ((currentQuote.price - avgHistPrice) / avgHistPrice * 100);
                }

                return (
                  <div style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1.5px dashed var(--primary-light)",
                    background: "rgba(99,102,241,0.02)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase" }}>
                        💡 {locale === "ar" ? `تحليل عرض سعر: ${currentQuote.supplierName}` : `Quote Insight: ${currentQuote.supplierName}`}
                      </div>
                      <span style={{ fontSize: "9px", background: "var(--primary-light)", color: "var(--primary)", padding: "1px 5px", borderRadius: "4px", fontWeight: 800 }}>
                        {locale === "ar" ? "محدد" : "Selected"}
                      </span>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "8px" }}>
                      <div>
                        <div style={{ fontSize: "8.5px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {locale === "ar" ? "السعر الحالي" : "Current Quote"}
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                          {formatCurrency(currentQuote.price)}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: "8.5px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {locale === "ar" ? "مقارنة بالسعر السابق" : "Vs Last Quote"}
                        </div>
                        {varFromPrev !== null ? (
                          <div style={{ fontSize: "13px", fontWeight: 800, color: varFromPrev > 0 ? "var(--danger)" : varFromPrev < 0 ? "var(--success)" : "var(--text-secondary)", marginTop: "2px" }}>
                            {varFromPrev > 0 ? "+" : ""}{varFromPrev.toFixed(1)}%
                            <span style={{ fontSize: "9px", fontWeight: 500, color: "var(--text-muted)", display: "block" }}>
                              ({locale === "ar" ? "كان: " : "was "} {formatCurrency(prevPrice)})
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic", marginTop: "2px" }}>—</div>
                        )}
                      </div>

                      <div>
                        <div style={{ fontSize: "8.5px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {locale === "ar" ? "مقارنة بالمتوسط" : "Vs Avg History"}
                        </div>
                        {varFromAvg !== null ? (
                          <div style={{ fontSize: "13px", fontWeight: 800, color: varFromAvg > 0 ? "var(--danger)" : varFromAvg < 0 ? "var(--success)" : "var(--text-secondary)", marginTop: "2px" }}>
                            {varFromAvg > 0 ? "+" : ""}{varFromAvg.toFixed(1)}%
                            <span style={{ fontSize: "9px", fontWeight: 500, color: "var(--text-muted)", display: "block" }}>
                              ({locale === "ar" ? "متوسط: " : "avg "} {formatCurrency(avgHistPrice)})
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic", marginTop: "2px" }}>—</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Other Supplier Quotes for this Item ──────────── */}
              {(() => {
                // Use the full unfiltered supplier list to show ALL quotes regardless of status filter
                const otherQuotes = allSuppliers.filter(s => s.supplierId !== selectedSupplierId);
                if (otherQuotes.length === 0) return null;

                const statusStyle = (status: string) => {
                  switch (status) {
                    case "approved": return { bg: "rgba(5,150,105,0.10)", color: "#059669", label: locale === "ar" ? "معتمد" : "Approved" };
                    case "published": return { bg: "rgba(5,150,105,0.10)", color: "#047857", label: locale === "ar" ? "منشور" : "Published" };
                    case "rejected": return { bg: "rgba(239,68,68,0.10)", color: "#dc2626", label: locale === "ar" ? "مرفوض" : "Rejected" };
                    case "negotiated": return { bg: "rgba(217,119,6,0.10)", color: "#b45309", label: locale === "ar" ? "تم التفاوض" : "Negotiated" };
                    case "reconsidered": return { bg: "rgba(245,158,11,0.10)", color: "#d97706", label: locale === "ar" ? "مُعاد النظر" : "Reconsidered" };
                    default: return { bg: "rgba(107,114,128,0.10)", color: "#6b7280", label: locale === "ar" ? "قيد المراجعة" : "Pending" };
                  }
                };

                return (
                  <div style={{
                    padding: "12px 14px", borderRadius: "12px",
                    border: "1.5px solid var(--border-light)",
                    background: "var(--bg-elevated)",
                  }}>
                    <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", marginBottom: "8px" }}>
                      📋 {locale === "ar" ? "أسعار الموردين الآخرين لنفس الصنف" : "Other Supplier Quotes for This Item"}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {otherQuotes.map(q => {
                        const st = statusStyle(q.status);
                        return (
                          <div key={q.quoteId} style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "7px 10px", borderRadius: "8px",
                            background: "var(--bg-subtle)", border: "1px solid var(--border-light)",
                            fontSize: "12px",
                          }}>
                            <span style={{
                              width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                              background: SUPPLIER_COLORS[item.suppliers.indexOf(q) % SUPPLIER_COLORS.length],
                            }} />
                            <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                              {q.supplierName}
                            </span>
                            <strong style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-primary)", flexShrink: 0 }}>
                              {formatCurrency(q.price)}
                            </strong>
                            <span style={{
                              fontSize: "8px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px",
                              background: st.bg, color: st.color, flexShrink: 0, textTransform: "uppercase",
                            }}>
                              {st.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Combined Selling vs Buying History Table */}
              {(() => {
                const allHistMonths = Array.from(
                  new Set(item.history.map((h) => h.month))
                ).sort((a, b) => b.localeCompare(a)).slice(0, historyWindow);

                if (allHistMonths.length === 0) return null;

                return (
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", marginBottom: "6px" }}>
                      📈 {locale === "ar" ? "مقارنة تاريخ الشراء والبيع" : "Historical Buying vs Selling baseline"}
                    </div>
                    <div className="table-responsive" style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--bg-elevated)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-subtle)" }}>
                            <th style={{ padding: "6px 12px", textAlign: locale === "ar" ? "right" : "left", fontWeight: 700, fontSize: "9.5px", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                              {locale === "ar" ? "الشهر" : "Month"}
                            </th>
                            <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, fontSize: "9.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                              {locale === "ar" ? "متوسط الشراء" : "Avg Buy"}
                            </th>
                            <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, fontSize: "9.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                              {locale === "ar" ? "نطاق البيع المعتمد" : "Published Sell Range"}
                            </th>
                            <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, fontSize: "9.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                              {locale === "ar" ? "الهامش التقريبي" : "Est. Markup"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {allHistMonths.map((m, idx) => {
                            const mQuotes = item.history.filter(h => h.month === m);
                            const buyAvg = mQuotes.length > 0 
                              ? mQuotes.reduce((a, b) => a + b.price, 0) / mQuotes.length 
                              : null;

                            const sellEntry = item.sellingHistory.find(s => s.month === m);

                            let markupStr = "—";
                            if (buyAvg && sellEntry) {
                              const minMarkup = ((sellEntry.sell_min - buyAvg) / buyAvg * 100).toFixed(1);
                              const maxMarkup = ((sellEntry.sell_max - buyAvg) / buyAvg * 100).toFixed(1);
                              markupStr = `+${minMarkup}% → +${maxMarkup}%`;
                            }

                            return (
                              <tr key={m} style={{ borderBottom: idx < allHistMonths.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                                <td style={{ padding: "6px 12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                                  {formatMonthLabel(m)}
                                </td>
                                <td style={{ padding: "6px 12px", textAlign: "center", color: "var(--primary)", fontWeight: 700 }}>
                                  {buyAvg ? formatCurrency(buyAvg) : "—"}
                                </td>
                                <td style={{ padding: "6px 12px", textAlign: "center", color: "var(--success)", fontWeight: 700 }}>
                                  {sellEntry ? (
                                    <span>
                                      {formatCurrency(sellEntry.sell_min)} - {formatCurrency(sellEntry.sell_max)}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: "10.5px", color: "var(--text-dim)", fontStyle: "italic" }}>
                                      {locale === "ar" ? "غير منشور" : "Not Published"}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, color: sellEntry ? "var(--warning)" : "var(--text-dim)" }}>
                                  {markupStr}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── Historical supplier price comparison table ── */}
              {(() => {
                const allHistMonths = Array.from(
                  new Set(item.history.map((h) => h.month))
                ).sort((a, b) => b.localeCompare(a)).slice(0, historyWindow);

                if (allHistMonths.length === 0) return null;

                const histSuppliers = Array.from(
                  new Set(item.history.map((h) => h.supplier_name))
                ).sort();

                const priceMap = new Map<string, number>();
                for (const h of item.history) {
                  priceMap.set(`${h.month}||${h.supplier_name}`, h.price);
                }

                const monthMin = new Map<string, number>();
                for (const m of allHistMonths) {
                  const prices = histSuppliers
                    .map((s) => priceMap.get(`${m}||${s}`))
                    .filter((p): p is number => p !== undefined);
                  if (prices.length) monthMin.set(m, Math.min(...prices));
                }

                return (
                  <div>
                    {/* Header with filter toggle */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.10em",
                            color: "var(--text-muted)",
                          }}
                        >
                          📊 {locale === "ar" ? "سجل أسعار الموردين بالتفصيل" : "Detailed Supplier Quote History"}
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                          ({allHistMonths.length}M)
                        </span>
                      </div>
                      {/* 3 / 6 / 9 month toggle */}
                      <div style={{ display: "flex", gap: "3px", background: "var(--bg-muted)", padding: "2px", borderRadius: "5px", border: "1px solid var(--border-light)" }}>
                        {([3, 6, 9] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setHistoryWindow(w); }}
                            style={{
                              padding: "2px 8px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              background: historyWindow === w ? "var(--primary)" : "transparent",
                              color: historyWindow === w ? "#fff" : "var(--text-muted)",
                              transition: "all 150ms",
                            }}
                          >
                            {w}M
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Table */}
                    <div className="table-responsive" style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--bg-elevated)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-subtle)" }}>
                            <th style={{ padding: "6px 12px", textAlign: locale === "ar" ? "right" : "left", fontWeight: 700, fontSize: "9.5px", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)", whiteSpace: "nowrap", position: "sticky", [locale === "ar" ? "right" : "left"]: 0, background: "var(--bg-subtle)", zIndex: 1 }}>
                              {locale === "ar" ? "المورد" : "Supplier"}
                            </th>
                            {allHistMonths.map((m) => (
                              <th key={m} style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, fontSize: "9.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)", whiteSpace: "nowrap" }}>
                                {formatMonthLabel(m)}
                              </th>
                            ))}
                            <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, fontSize: "9.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)", whiteSpace: "nowrap" }}>
                              {locale === "ar" ? "الاتجاه" : "Trend"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {histSuppliers.map((supplierName, si) => {
                            const color = supplierColorMap.get(supplierName) ?? "#94a3b8";
                            const chronoPrices = [...allHistMonths]
                              .reverse()
                              .map((m) => priceMap.get(`${m}||${supplierName}`))
                              .filter((p): p is number => p !== undefined);

                            let trendIcon = "→";
                            let trendColor = "var(--text-muted)";
                            if (chronoPrices.length >= 2) {
                              const first = chronoPrices[0];
                              const last = chronoPrices[chronoPrices.length - 1];
                              const pct = ((last - first) / first) * 100;
                              if (pct > 1) { trendIcon = `↑ ${pct.toFixed(1)}%`; trendColor = "var(--danger)"; }
                              else if (pct < -1) { trendIcon = `↓ ${Math.abs(pct).toFixed(1)}%`; trendColor = "var(--success)"; }
                              else { trendIcon = locale === "ar" ? "≈ مستقر" : "≈ stable"; trendColor = "var(--text-muted)"; }
                            }

                            return (
                              <tr key={supplierName} style={{ borderBottom: si < histSuppliers.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                                <td style={{ padding: "6px 12px", fontWeight: 700, whiteSpace: "nowrap", position: "sticky", [locale === "ar" ? "right" : "left"]: 0, background: "var(--bg-elevated)", zIndex: 1 }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                                    {supplierName}
                                  </span>
                                </td>
                                {allHistMonths.map((m) => {
                                  const price = priceMap.get(`${m}||${supplierName}`);
                                  const isBestInMonth = price !== undefined && price === monthMin.get(m);
                                  return (
                                    <td key={m} style={{ padding: "6px 12px", textAlign: "center", fontWeight: isBestInMonth ? 800 : 500, color: isBestInMonth ? "var(--info)" : price !== undefined ? "var(--text-primary)" : "var(--text-dim)", background: isBestInMonth ? "rgba(2,132,199,0.08)" : "transparent", whiteSpace: "nowrap" }}>
                                      {price !== undefined ? formatCurrency(price) : "—"}
                                    </td>
                                  );
                                })}
                                <td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, fontSize: "10.5px", color: trendColor, whiteSpace: "nowrap" }}>
                                  {chronoPrices.length >= 2 ? trendIcon : "—"}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Month averages footer row */}
                          <tr style={{ borderTop: "1.5px solid var(--border)", background: "var(--bg-subtle)" }}>
                            <td style={{ padding: "6px 12px", fontSize: "9.5px", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.07em", whiteSpace: "nowrap", position: "sticky", [locale === "ar" ? "right" : "left"]: 0, background: "var(--bg-subtle)" }}>
                              {locale === "ar" ? "المتوسط / شهر" : "Avg / month"}
                            </td>
                            {allHistMonths.map((m) => {
                              const monthPrices = histSuppliers
                                .map((s) => priceMap.get(`${m}||${s}`))
                                .filter((p): p is number => p !== undefined);
                              const avg = monthPrices.length > 0 ? monthPrices.reduce((a, b) => a + b, 0) / monthPrices.length : null;
                              return (
                                <td key={m} style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, fontSize: "10.5px", color: "var(--primary)", whiteSpace: "nowrap" }}>
                                  {avg !== null ? formatCurrency(avg) : "—"}
                                </td>
                              );
                            })}
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Main modal component ──────────────────────────────────────────────────────
export default function MonthlyReviewModal({ month, username, data, variant = "sidebar" }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [showConsidered, setShowConsidered] = useState(false);
  const [showPending, setShowPending]     = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build a stable supplier → color map across all data
  const supplierColorMap = new Map<string, string>();
  let colorIdx = 0;
  for (const cat of data) {
    for (const item of cat.items) {
      for (const q of item.suppliers) {
        if (!supplierColorMap.has(q.supplierName)) {
          supplierColorMap.set(q.supplierName, SUPPLIER_COLORS[colorIdx % SUPPLIER_COLORS.length]);
          colorIdx++;
        }
      }
    }
  }

  // Close on Escape — intentionally removed: modal must stay open until user clicks Close

  // Filter data by search and status (only show pending/considered reviews in this modal based on toggle states)
  const filtered = data
    .map((cat) => ({
      ...cat,
      items: cat.items
        .map((item) => ({
          ...item,
          suppliers: item.suppliers.filter((q) => {
            if (q.status === "pending") return showPending;
            if (q.status === "approved" || q.status === "rejected") return showConsidered;
            return false;
          }),
        }))
        .filter((item) => {
          if (item.suppliers.length === 0) return false;
          return (
            search === "" ||
            item.itemName.toLowerCase().includes(search.toLowerCase()) ||
            item.suppliers.some((q) =>
              q.supplierName.toLowerCase().includes(search.toLowerCase())
            )
          );
        }),
    }))
    .filter((cat) => cat.items.length > 0);

  const totalItems = data.reduce((s, c) => s + c.items.length, 0);
  const pendingCount = data.reduce(
    (s, c) => s + c.items.filter((i) => i.suppliers.some((q) => q.status === "pending")).length,
    0
  );
  const consideredCount = totalItems - pendingCount;

  const toggleCat = (id: number) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedCats(new Set(data.map((c) => c.categoryId)));
  const collapseAll = () => setExpandedCats(new Set());

  // Open → auto-expand all categories
  const handleOpen = () => {
    setOpen(true);
    setExpandedCats(new Set(data.map((c) => c.categoryId)));
  };

  return (
    <>
      {/* ── Trigger button — sidebar variant ── */}
      {variant === "sidebar" && (
        <button
          type="button"
          onClick={handleOpen}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "11px 14px",
            borderRadius: "12px",
            border: "1.5px solid #6366f1",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 200ms ease",
            textAlign: "left",
            boxShadow: "0 4px 14px rgba(99,102,241,0.45)",
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)";
            btn.style.boxShadow = "0 6px 20px rgba(99,102,241,0.6)";
            btn.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";
            btn.style.boxShadow = "0 4px 14px rgba(99,102,241,0.45)";
            btn.style.transform = "translateY(0)";
          }}
        >
          <span style={{
            width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px",
            boxShadow: "0 2px 8px rgba(99,102,241,0.5)",
          }}>📋</span>
          <span style={{ flex: 1, letterSpacing: "0.01em" }}>{t("sidebar.monthlyReview")}</span>
          {pendingCount > 0 && (
            <span style={{
              fontSize: "10px", fontWeight: 900,
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              color: "#fff", padding: "3px 8px", borderRadius: "10px", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(245,158,11,0.5)",
              animation: "pulse-ring 2s ease-out infinite",
            }}>
              {pendingCount} {t("sidebar.pending")}
            </span>
          )}
          {pendingCount === 0 && totalItems > 0 && (
            <span style={{
              fontSize: "10px", fontWeight: 800,
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff", padding: "3px 8px", borderRadius: "10px", flexShrink: 0,
              boxShadow: "0 2px 6px rgba(16,185,129,0.4)",
            }}>
              ✓ {t("sidebar.allDone")}
            </span>
          )}
        </button>
      )}

      {/* ── Trigger button — dashboard card variant ── */}
      {variant === "dashboard" && (
        <button
          type="button"
          onClick={handleOpen}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px 20px",
            borderRadius: "14px",
            border: `1.5px solid ${pendingCount > 0 ? "rgba(245,158,11,0.5)" : "rgba(99,102,241,0.35)"}`,
            background: pendingCount > 0
              ? "linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)"
              : "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
            cursor: "pointer",
            transition: "all 220ms ease",
            textAlign: "left",
            boxShadow: pendingCount > 0
              ? "0 2px 8px rgba(245,158,11,0.15)"
              : "0 2px 8px rgba(99,102,241,0.12)",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.transform = "translateY(-2px)";
            btn.style.boxShadow = pendingCount > 0
              ? "0 8px 24px rgba(245,158,11,0.25)"
              : "0 8px 24px rgba(99,102,241,0.22)";
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.transform = "translateY(0)";
            btn.style.boxShadow = pendingCount > 0
              ? "0 2px 8px rgba(245,158,11,0.15)"
              : "0 2px 8px rgba(99,102,241,0.12)";
          }}
        >
          {/* Icon block */}
          <div style={{
            width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0,
            background: pendingCount > 0
              ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: pendingCount > 0
              ? "0 4px 12px rgba(245,158,11,0.45)"
              : "0 4px 12px rgba(99,102,241,0.4)",
            fontSize: "20px",
          }}>
            📋
          </div>

          {/* Text block */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div style={{
              fontSize: "15px", fontWeight: 800, letterSpacing: "-0.01em",
              color: pendingCount > 0 ? "#92400e" : "#3730a3",
            }}>
              Monthly Review
            </div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", fontWeight: 500 }}>
              {totalItems} {t("review.tracked")} · {consideredCount} {t("review.considered")} · {pendingCount} {t("review.pending")}
            </div>
          </div>

          {/* Status pill */}
          {pendingCount > 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0,
            }}>
              <span style={{
                fontSize: "11px", fontWeight: 900,
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                color: "#fff", padding: "4px 10px", borderRadius: "99px",
                boxShadow: "0 2px 8px rgba(245,158,11,0.5)",
                animation: "pulse-ring 2s ease-out infinite",
                whiteSpace: "nowrap",
              }}>
                ⏳ {pendingCount} pending
              </span>
            </div>
          ) : totalItems > 0 ? (
            <span style={{
              fontSize: "11px", fontWeight: 800,
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff", padding: "4px 10px", borderRadius: "99px",
              boxShadow: "0 2px 6px rgba(16,185,129,0.4)",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              ✓ {t("sidebar.allDone")}
            </span>
          ) : (
            <div style={{
              width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
              background: "rgba(99,102,241,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", color: "#6366f1", fontWeight: 800,
            }}>→</div>
          )}
        </button>
      )}

      {/* ── Full-screen modal overlay ── */}
      {open && mounted && createPortal(
        <div
          ref={overlayRef}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,9,15,0.7)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
            animation: "fadeIn 0.18s ease-out",
          }}
        >
          <div
            className="modal-container"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-xl)",
              width: "100%",
              maxWidth: "1160px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
              overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "20px 24px 16px",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--primary)",
                    marginBottom: "4px",
                  }}
                >
                  {formatMonthLabel(month)} · {t("review.eyebrow")}
                </p>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                    margin: 0,
                  }}
                >
                  {t("review.title")}
                </h2>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="badge badge-strong">{totalItems} {t("review.tracked")}</span>
                  <span className="badge badge-success">{consideredCount} {t("review.considered")}</span>
                  {pendingCount > 0 && (
                    <span className="badge badge-warning">{pendingCount} {t("review.pending")}</span>
                  )}
                </div>
              </div>

              {/* Supplier legend */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "center",
                  maxWidth: "260px",
                }}
              >
                {Array.from(supplierColorMap.entries()).map(([name, color]) => (
                  <span
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    {name}
                  </span>
                ))}
              </div>

              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "22px",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Search + filter controls */}
            <div
              style={{
                padding: "10px 24px",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexShrink: 0,
                flexWrap: "wrap",
              }}
            >
              {/* Search */}
              <input
                type="text"
                placeholder={t("review.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: "1 1 160px", minWidth: "140px",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-medium)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />

              {/* ── Status filter toggles ── */}
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                {/* Show Considered toggle */}
                <button
                  type="button"
                  onClick={() => setShowConsidered(v => !v)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "8px", cursor: "pointer",
                    fontSize: "12px", fontWeight: 700, transition: "all 150ms",
                    border: `1.5px solid ${showConsidered ? "var(--success)" : "var(--border-medium)"}`,
                    background: showConsidered ? "var(--success-light)" : "var(--bg-elevated)",
                    color: showConsidered ? "var(--success)" : "var(--text-muted)",
                  }}
                >
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: showConsidered ? "var(--success)" : "var(--border-medium)",
                    transition: "background 150ms",
                  }} />
                  {t("gen.considered")}
                  <span style={{
                    fontSize: "9px", fontWeight: 800,
                    padding: "1px 5px", borderRadius: "4px",
                    background: showConsidered ? "var(--success)" : "var(--border-medium)",
                    color: "#fff",
                    transition: "background 150ms",
                  }}>
                    {consideredCount}
                  </span>
                </button>

                {/* Show Pending toggle */}
                <button
                  type="button"
                  onClick={() => setShowPending(v => !v)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "8px", cursor: "pointer",
                    fontSize: "12px", fontWeight: 700, transition: "all 150ms",
                    border: `1.5px solid ${showPending ? "var(--warning)" : "var(--border-medium)"}`,
                    background: showPending ? "var(--warning-light)" : "var(--bg-elevated)",
                    color: showPending ? "var(--warning)" : "var(--text-muted)",
                  }}
                >
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: showPending ? "var(--warning)" : "var(--border-medium)",
                    transition: "background 150ms",
                  }} />
                  {t("gen.pending")}
                  <span style={{
                    fontSize: "9px", fontWeight: 800,
                    padding: "1px 5px", borderRadius: "4px",
                    background: showPending ? "var(--warning)" : "var(--border-medium)",
                    color: "#fff",
                    transition: "background 150ms",
                  }}>
                    {pendingCount}
                  </span>
                </button>
              </div>

              {/* Expand / Collapse */}
              <div style={{ display: "flex", gap: "6px", marginLeft: "auto", flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={expandAll}
                  className="button button-secondary"
                  style={{ padding: "7px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  {t("review.expandAll")}
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="button button-secondary"
                  style={{ padding: "7px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  {t("review.collapseAll")}
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 24px 24px",
                scrollbarWidth: "thin",
                scrollbarColor: "var(--border-medium) transparent",
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    padding: "48px 0",
                    fontSize: "14px",
                  }}
                >
                  {search ? `No results for "${search}"` : "No price data for this month yet."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {filtered.map((cat) => {
                    const catOpen = expandedCats.has(cat.categoryId);
                    const catPending = cat.items.filter((i) => i.suppliers.some((q) => q.status === "pending")).length;
                    return (
                      <div key={cat.categoryId}>
                        {/* Category header */}
                        <div
                          onClick={() => toggleCat(cat.categoryId)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 14px",
                            borderRadius: "var(--radius)",
                            background: catOpen ? "var(--primary-light)" : "var(--bg-subtle)",
                            border: `1.5px solid ${catOpen ? "var(--primary)" : "var(--border)"}`,
                            cursor: "pointer",
                            userSelect: "none",
                            marginBottom: catOpen ? "8px" : "0",
                            transition: "all 150ms",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              color: catOpen ? "var(--primary)" : "var(--text-muted)",
                              transform: catOpen ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform 200ms",
                              flexShrink: 0,
                            }}
                          >
                            ▶
                          </span>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "13px",
                              flex: 1,
                              color: catOpen ? "var(--primary)" : "var(--text-primary)",
                            }}
                          >
                            {cat.categoryName}
                          </span>
                          <span className="badge" style={{ fontSize: "10px" }}>
                            {cat.items.length} items
                          </span>
                          {catPending === 0 ? (
                            <span className="badge badge-success" style={{ fontSize: "10px" }}>
                              ✓ {t("review.allConsidered")}
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: "10px" }}>
                              {catPending} {t("review.pending")}
                            </span>
                          )}
                        </div>

                        {/* Items */}
                        {catOpen && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {cat.items.map((item) => (
                              <ItemRow
                                key={item.itemId}
                                item={item}
                                month={month}
                                username={username}
                                supplierColorMap={supplierColorMap}
                                allSuppliers={data.flatMap(c => c.items).find(i => i.itemId === item.itemId)?.suppliers ?? item.suppliers}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 24px",
                borderTop: "1px solid var(--border-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
                background: "var(--bg-elevated)",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {t("review.footer")}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="button button-secondary"
                style={{ fontSize: "13px", padding: "8px 20px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
