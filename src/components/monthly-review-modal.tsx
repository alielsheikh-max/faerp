"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { formatCurrency, formatMonthLabel, formatDateTime } from "@/lib/format";
import { saveSellingPriceInline } from "@/app/actions/pricing";
import { useI18n } from "@/lib/i18n-context";

const SUPPLIER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

// ── Types (must match getMonthlyReviewData return shape) ──────────────────────
type SupplierQuote = {
  supplierId: number;
  supplierName: string;
  price: number;
  recordedAt: string;
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
} | null;

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

// ── Item row — collapsible ────────────────────────────────────────────────────
function ItemRow({
  item,
  month,
  username,
  supplierColorMap,
}: {
  item: ReviewItem;
  month: string;
  username: string;
  supplierColorMap: Map<string, string>;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [historyWindow, setHistoryWindow] = useState<3 | 6 | 9>(3);
  const isTiered = item.is_tiered === 1;

  // For tiered items: base price is stored as both min and max
  const [basePrice, setBasePrice] = useState<string>(
    item.existingSell ? String(item.existingSell.sell_min.toFixed(2)) : ""
  );
  const [sellMin, setSellMin] = useState<string>(
    item.existingSell ? String(item.existingSell.sell_min.toFixed(2)) : ""
  );
  const [sellMax, setSellMax] = useState<string>(
    item.existingSell ? String(item.existingSell.sell_max.toFixed(2)) : ""
  );
  const [otherExpenses, setOtherExpenses] = useState<string>(
    item.existingSell?.other_expenses ? String(item.existingSell.other_expenses) : "0"
  );
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [changeReason, setChangeReason] = useState("");
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  useEffect(() => {
    if (!open) {
      setChangeReason("");
      setConfirmUpdate(false);
    }
  }, [open]);

  const isPublished = !!item.existingSell;
  const spread = item.minPrice > 0
    ? (((item.maxPrice - item.minPrice) / item.minPrice) * 100).toFixed(1)
    : "0.0";

  const handleSave = () => {
    const expenses = parseFloat(otherExpenses) || 0;

    let finalMin: number;
    let finalMax: number;

    if (isTiered) {
      const base = parseFloat(basePrice);
      if (isNaN(base) || base <= 0) {
        setSaveError("Enter a valid base selling price");
        return;
      }
      finalMin = base;
      finalMax = base;
    } else {
      const min = parseFloat(sellMin);
      const max = parseFloat(sellMax);
      if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0) {
        setSaveError("Enter valid min and max prices");
        return;
      }
      if (max < min) {
        setSaveError("Max must be ≥ min");
        return;
      }
      finalMin = min;
      finalMax = max;
    }

    setSaveError(null);
    startSave(async () => {
      const res = await saveSellingPriceInline({
        itemId: item.itemId,
        month,
        sellMin: finalMin,
        sellMax: finalMax,
        createdBy: username,
        otherExpenses: expenses,
        tierPricingEnabled: isTiered ? 1 : 0,
        changeReason: isPublished ? changeReason : undefined,
      });
      if (res?.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else if (res?.floorViolation) {
        setSaveError(
          `Margin floor violation: min markup is below the configured floor of ${res.floorPct}%. Raise the selling price.`
        );
      } else {
        setSaveError(res?.error ?? "Save failed");
      }
    });
  };

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

        {/* Published badge or pending */}
        {isPublished ? (
          <span
            className="badge badge-success"
            style={{ fontSize: "10px", padding: "2px 8px", whiteSpace: "nowrap" }}
          >
            ✓ Published
          </span>
        ) : (
          <span
            className="badge badge-warning"
            style={{ fontSize: "10px", padding: "2px 8px", whiteSpace: "nowrap" }}
          >
            Pending
          </span>
        )}
      </div>

      {/* ── Expanded detail ── */}
      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            borderTop: "1px solid var(--border-light)",
            background: "var(--bg-elevated)",
          }}
        >
          {/* Supplier price cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              padding: "14px 0 12px",
            }}
          >
            {item.suppliers.map((q) => {
              const color = supplierColorMap.get(q.supplierName) ?? "#94a3b8";
              const isBest = q.price === item.minPrice;
              return (
                <div
                  key={q.supplierId}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius)",
                    border: `1.5px solid ${isBest ? "var(--info)" : color + "44"}`,
                    background: isBest ? "var(--info-light)" : color + "0a",
                    position: "relative",
                  }}
                >
                  {isBest && (
                    <span
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "6px",
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      marginBottom: "6px",
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
                        fontSize: "10px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {q.supplierName}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "17px",
                      fontWeight: 800,
                      color: isBest ? "var(--info)" : "var(--text-primary)",
                    }}
                  >
                    {formatCurrency(q.price)}
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "3px" }}>
                    {formatDateTime(q.recordedAt)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: "0",
              padding: "10px 14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius)",
              marginBottom: "14px",
            }}
          >
            {[
              { label: t("review.min"),    value: formatCurrency(item.minPrice), color: "var(--success)" },
              { label: t("review.avg"),    value: formatCurrency(item.avgPrice), color: "var(--primary)" },
              { label: t("review.max"),    value: formatCurrency(item.maxPrice), color: "var(--danger)" },
              { label: t("review.spread"), value: `${spread}%`,                  color: "var(--warning)" },
              { label: t("review.quotes"), value: String(item.suppliers.length), color: "var(--text-secondary)" },
            ].map((stat, i, arr) => (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  textAlign: "center",
                  borderRight: i < arr.length - 1 ? "1px solid var(--border-light)" : "none",
                  padding: "0 12px",
                }}
              >
                <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── Historical price comparison table ── */}
          {(() => {
            // Get unique months in the history, newest first, limited by window
            const allHistMonths = Array.from(
              new Set(item.history.map((h) => h.month))
            ).sort((a, b) => b.localeCompare(a)).slice(0, historyWindow);

            if (allHistMonths.length === 0) return null;

            // All supplier names present in history
            const histSuppliers = Array.from(
              new Set(item.history.map((h) => h.supplier_name))
            ).sort();

            // Build lookup: month+supplier -> price
            const priceMap = new Map<string, number>();
            for (const h of item.history) {
              priceMap.set(`${h.month}||${h.supplier_name}`, h.price);
            }

            // Min price per month for highlight
            const monthMin = new Map<string, number>();
            for (const m of allHistMonths) {
              const prices = histSuppliers
                .map((s) => priceMap.get(`${m}||${s}`))
                .filter((p): p is number => p !== undefined);
              if (prices.length) monthMin.set(m, Math.min(...prices));
            }

            return (
              <div style={{ marginBottom: "14px" }}>
                {/* Header with filter toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
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
                      📊 Price History
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-muted)",
                      }}
                    >
                      ({allHistMonths.length} month{allHistMonths.length !== 1 ? "s" : ""} shown)
                    </span>
                  </div>
                  {/* 3 / 6 / 9 month toggle */}
                  <div
                    style={{
                      display: "flex",
                      gap: "3px",
                      background: "var(--bg-muted)",
                      padding: "3px",
                      borderRadius: "7px",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    {([3, 6, 9] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setHistoryWindow(w); }}
                        style={{
                          padding: "3px 10px",
                          fontSize: "10px",
                          fontWeight: 700,
                          borderRadius: "5px",
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
                <div
                  style={{
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12px",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "var(--bg-subtle)" }}>
                        <th
                          style={{
                            padding: "7px 12px",
                            textAlign: locale === "ar" ? "right" : "left",
                            fontWeight: 700,
                            fontSize: "10px",
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            color: "var(--text-muted)",
                            borderBottom: "1px solid var(--border-light)",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            [locale === "ar" ? "right" : "left"]: 0,
                            background: "var(--bg-subtle)",
                            zIndex: 1,
                          }}
                        >
                          {locale === "ar" ? "المورد" : "Supplier"}
                        </th>
                        {allHistMonths.map((m) => (
                          <th
                            key={m}
                            style={{
                              padding: "7px 12px",
                              textAlign: "center",
                              fontWeight: 700,
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              borderBottom: "1px solid var(--border-light)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatMonthLabel(m)}
                          </th>
                        ))}
                        {/* Trend column */}
                        <th
                          style={{
                            padding: "7px 12px",
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: "10px",
                            color: "var(--text-muted)",
                            borderBottom: "1px solid var(--border-light)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {locale === "ar" ? "الاتجاه" : "Trend"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {histSuppliers.map((supplierName, si) => {
                        const color = supplierColorMap.get(supplierName) ?? "#94a3b8";
                        // Prices in chronological order for trend calc
                        const chronoPrices = [...allHistMonths]
                          .reverse()
                          .map((m) => priceMap.get(`${m}||${supplierName}`))
                          .filter((p): p is number => p !== undefined);

                        // Trend: compare oldest to newest
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
                          <tr
                            key={supplierName}
                            style={{
                              borderBottom: si < histSuppliers.length - 1
                                ? "1px solid var(--border-light)"
                                : "none",
                            }}
                          >
                            {/* Supplier name */}
                            <td
                              style={{
                                padding: "7px 12px",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                position: "sticky",
                                [locale === "ar" ? "right" : "left"]: 0,
                                background: "var(--bg-elevated)",
                                zIndex: 1,
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <span
                                  style={{
                                    width: "7px",
                                    height: "7px",
                                    borderRadius: "50%",
                                    background: color,
                                    flexShrink: 0,
                                  }}
                                />
                                {supplierName}
                              </span>
                            </td>

                            {/* Price per month */}
                            {allHistMonths.map((m) => {
                              const price = priceMap.get(`${m}||${supplierName}`);
                              const isBestInMonth =
                                price !== undefined && price === monthMin.get(m);
                              return (
                                <td
                                  key={m}
                                  style={{
                                    padding: "7px 12px",
                                    textAlign: "center",
                                    fontWeight: isBestInMonth ? 800 : 500,
                                    color: isBestInMonth
                                      ? "var(--info)"
                                      : price !== undefined
                                      ? "var(--text-primary)"
                                      : "var(--text-dim)",
                                    background: isBestInMonth
                                      ? "rgba(2,132,199,0.08)"
                                      : "transparent",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {price !== undefined ? formatCurrency(price) : "—"}
                                </td>
                              );
                            })}

                            {/* Trend */}
                            <td
                              style={{
                                padding: "7px 12px",
                                textAlign: "center",
                                fontWeight: 700,
                                fontSize: "11px",
                                color: trendColor,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {chronoPrices.length >= 2 ? trendIcon : "—"}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Month averages footer row */}
                      <tr
                        style={{
                          borderTop: "1.5px solid var(--border)",
                          background: "var(--bg-subtle)",
                        }}
                      >
                        <td
                          style={{
                            padding: "7px 12px",
                            fontSize: "10px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            color: "var(--text-muted)",
                            letterSpacing: "0.07em",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            [locale === "ar" ? "right" : "left"]: 0,
                            background: "var(--bg-subtle)",
                          }}
                        >
                          {locale === "ar" ? "المتوسط / شهر" : "Avg / month"}
                        </td>
                        {allHistMonths.map((m) => {
                          const monthPrices = histSuppliers
                            .map((s) => priceMap.get(`${m}||${s}`))
                            .filter((p): p is number => p !== undefined);
                          const avg =
                            monthPrices.length > 0
                              ? monthPrices.reduce((a, b) => a + b, 0) / monthPrices.length
                              : null;
                          return (
                            <td
                              key={m}
                              style={{
                                padding: "7px 12px",
                                textAlign: "center",
                                fontWeight: 700,
                                fontSize: "11px",
                                color: "var(--primary)",
                                whiteSpace: "nowrap",
                              }}
                            >
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

          {/* Already published info */}
          {item.existingSell && (
            <div
              style={{
                padding: "8px 12px",
                background: "var(--success-light)",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: "var(--radius)",
                marginBottom: "12px",
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
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                by {item.existingSell.created_by} · {formatDateTime(item.existingSell.created_at)}
              </span>
            </div>
          )}

          {/* MOQ and Transportation info */}
          <div style={{ display: "flex", gap: "12px", borderTop: "1px dashed var(--border-light)", paddingTop: "10px", marginTop: "10px", fontSize: "11.5px" }}>
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

          {/* Price Update Confirmation Required */}
          {isPublished && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "12px",
              background: "rgba(245, 158, 11, 0.05)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "10px",
              marginTop: "10px"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: "6px" }}>
                ⚠️ {locale === "ar" ? "تأكيد تحديث السعر مطلوب" : "Price Update Confirmation Required"}
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "10px", alignItems: "center" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", margin: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>{locale === "ar" ? "سبب التحديث" : "Change Reason"}</span>
                    <span style={{ color: "var(--danger)" }}>*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder={locale === "ar" ? "مطلوب - سبب التحديث..." : "Required — e.g. Cost change..."}
                    style={{
                      padding: "6.5px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      outline: "none"
                    }}
                  />
                </label>

                <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", cursor: "pointer", marginTop: "15px" }}>
                  <input
                    type="checkbox"
                    required
                    checked={confirmUpdate}
                    onChange={(e) => setConfirmUpdate(e.target.checked)}
                    style={{ width: "15px", height: "15px", cursor: "pointer", marginTop: "1px" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-primary)", lineHeight: "1.3", userSelect: "none" }}>
                    {locale === "ar" ? "أؤكد تعديل السعر المنشور" : "I confirm this price update"}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Quick sell price & expenses inputs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isTiered ? "1fr 1fr auto" : "1fr 1fr 1fr auto",
              gap: "10px",
              alignItems: "flex-end",
              marginTop: "8px"
            }}
          >
            {isTiered ? (
              /* ── Tiered item: single Base Selling Price + T13 preview ── */
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {locale === "ar" ? "سعر البيع الأساسي" : "Base Selling Price"}
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        background: "var(--primary)",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      TIER BASE
                    </span>
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder={formatCurrency(item.minPrice * 1.1).replace("EGP", "").trim()}
                    style={{
                      padding: "8px 11px",
                      borderRadius: "var(--radius)",
                      border: "1.5px solid var(--primary)",
                      background: "var(--bg-surface)",
                      color: "var(--primary)",
                      fontSize: "14px",
                      fontWeight: 700,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </label>

                {/* T13: live tier price preview */}
                {(() => {
                  const base = parseFloat(basePrice);
                  if (!base || base <= 0) return null;
                  const tiers = [
                    { label: "T1", max: item.tier1_max, disc: item.tier1_discount },
                    { label: "T2", max: item.tier2_max, disc: item.tier2_discount },
                    { label: "T3", max: item.tier3_max, disc: item.tier3_discount },
                    { label: "T4", max: item.tier4_max, disc: item.tier4_discount },
                  ].filter(t => t.disc > 0);
                  if (tiers.length === 0) return null;
                  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#06b6d4"];
                  return (
                    <div style={{
                      display: "flex", gap: "6px", flexWrap: "wrap",
                      padding: "8px 10px",
                      background: "var(--bg-subtle)",
                      borderRadius: "var(--radius)",
                      border: "1px dashed var(--border-medium)",
                      gridColumn: "1 / -1",
                    }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", alignSelf: "center" }}>
                        Tier Prices:
                      </span>
                      {tiers.map((tier, i) => {
                        const divisor = 1 - tier.disc / 100;
                        const raw = divisor > 0 ? base / divisor : base;
                        const rounded = Math.ceil(raw / 5) * 5;
                        return (
                          <span key={tier.label} style={{
                            fontSize: "11px", fontWeight: 800,
                            color: colors[i],
                            background: colors[i] + "18",
                            border: `1px solid ${colors[i]}44`,
                            borderRadius: "6px",
                            padding: "2px 8px",
                          }}>
                            {tier.label} ({tier.max > 0 ? `≤${tier.max}` : "∞"}): {formatCurrency(rounded)}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : (
              /* ── Non-tiered item: Min + Max ── */
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                  <span>{t("review.minSell")}</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={sellMin}
                    onChange={(e) => setSellMin(e.target.value)}
                    placeholder={formatCurrency(item.minPrice * 1.08).replace("EGP", "").trim()}
                    style={{
                      padding: "8px 11px",
                      borderRadius: "var(--radius)",
                      border: "1.5px solid var(--success)",
                      background: "var(--bg-surface)",
                      color: "var(--success)",
                      fontSize: "14px",
                      fontWeight: 700,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                  <span>{t("review.maxSell")}</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={sellMax}
                    onChange={(e) => setSellMax(e.target.value)}
                    placeholder={formatCurrency(item.maxPrice * 1.15).replace("EGP", "").trim()}
                    style={{
                      padding: "8px 11px",
                      borderRadius: "var(--radius)",
                      border: "1.5px solid var(--primary)",
                      background: "var(--bg-surface)",
                      color: "var(--primary)",
                      fontSize: "14px",
                      fontWeight: 700,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </label>
              </>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
              <span>{locale === "ar" ? "مصاريف أخرى (ج.م)" : "Other Expenses (EGP)"}</span>
              <input
                type="number"
                step="any"
                min="0"
                value={otherExpenses}
                onChange={(e) => setOtherExpenses(e.target.value)}
                style={{
                  padding: "8px 11px",
                  borderRadius: "var(--radius)",
                  border: "1.5px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                  width: "100%",
                }}
              />
            </label>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (isPublished && (!confirmUpdate || !changeReason.trim()))}
              className="button button-primary"
              style={{
                padding: "10px 16px",
                fontSize: "12px",
                whiteSpace: "nowrap",
                opacity: (saving || (isPublished && (!confirmUpdate || !changeReason.trim()))) ? 0.7 : 1,
                background: saved ? "var(--success)" : undefined,
                borderColor: saved ? "var(--success)" : undefined,
                cursor: (saving || (isPublished && (!confirmUpdate || !changeReason.trim()))) ? "not-allowed" : "pointer"
              }}
            >
              {saving ? t("review.savingBtn") : saved ? t("review.savedBtn") : isPublished ? t("review.updateBtn") : t("review.publishBtn")}
            </button>
          </div>

          {/* Volume Tier Preview — always visible for tiered items */}
          {isTiered && (
            <div style={{
              marginTop: "10px",
              padding: "10px 12px",
              background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(59,130,246,0.06) 100%)",
              border: "1px dashed rgba(16,185,129,0.3)",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "11.5px"
            }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {locale === "ar" ? "⚡ معاينة شرائح الحجم" : "⚡ Volume Tier Preview"}
              </div>
              {(() => {
                const base   = parseFloat(basePrice) || 0;
                const t1Max  = item.tier1_max;
                const t2Max  = item.tier2_max;
                const t2Disc = item.tier2_discount;
                const t3Max  = item.tier3_max ?? 300;
                const t3Disc = item.tier3_discount;
                const t4Max  = item.tier4_max ?? 0;
                const t4Disc = item.tier4_discount ?? 0;
                const has4   = t4Disc > 0;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{locale === "ar" ? `شريحة ١ (٠ - ${t1Max} وحدة):` : `Base Tier (0 – ${t1Max} units):`}</span>
                      <strong style={{ color: "var(--success)" }}>{base > 0 ? formatCurrency(base) : "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{locale === "ar" ? `شريحة ٢ (${t1Max + 1} - ${t2Max} وحدة) — خصم ${t2Disc}%:` : `Tier 2 (${t1Max + 1} – ${t2Max} units) — ${t2Disc}% off:`}</span>
                      <strong style={{ color: "var(--primary)" }}>{base > 0 ? formatCurrency(base * (1 - t2Disc / 100)) : "—"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{locale === "ar" ? `شريحة ٣ (${t2Max + 1} - ${t3Max} وحدة) — خصم ${t3Disc}%:` : `Tier 3 (${t2Max + 1} – ${t3Max} units) — ${t3Disc}% off:`}</span>
                      <strong style={{ color: "var(--warning)" }}>{base > 0 ? formatCurrency(base * (1 - t3Disc / 100)) : "—"}</strong>
                    </div>
                    {has4 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{locale === "ar" ? `شريحة ٤ (${t3Max + 1}${t4Max ? ` - ${t4Max}` : "+"} وحدة) — خصم ${t4Disc}%:` : `Tier 4 (${t3Max + 1}${t4Max ? ` – ${t4Max}` : "+"} units) — ${t4Disc}% off:`}</span>
                        <strong style={{ color: "var(--danger)" }}>{base > 0 ? formatCurrency(base * (1 - t4Disc / 100)) : "—"}</strong>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {saveError && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>
              ⚠ {saveError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main modal component ──────────────────────────────────────────────────────
export default function MonthlyReviewModal({ month, username, data, variant = "sidebar" }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [showPublished, setShowPublished] = useState(true);
  const [showPending, setShowPending]     = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Filter data by search
  const filtered = data
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) => {
          const isPublished = !!item.existingSell;
          if (!showPublished && isPublished) return false;
          if (!showPending && !isPublished) return false;
          return (
            search === "" ||
            item.itemName.toLowerCase().includes(search.toLowerCase()) ||
            item.suppliers.some((q) =>
              q.supplierName.toLowerCase().includes(search.toLowerCase())
            )
          );
        }
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const totalItems = data.reduce((s, c) => s + c.items.length, 0);
  const publishedCount = data.reduce(
    (s, c) => s + c.items.filter((i) => i.existingSell).length,
    0
  );

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
          {publishedCount < totalItems && totalItems > 0 && (
            <span style={{
              fontSize: "10px", fontWeight: 900,
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              color: "#fff", padding: "3px 8px", borderRadius: "10px", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(245,158,11,0.5)",
              animation: "pulse-ring 2s ease-out infinite",
            }}>
              {totalItems - publishedCount} {t("sidebar.pending")}
            </span>
          )}
          {publishedCount === totalItems && totalItems > 0 && (
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
            border: `1.5px solid ${publishedCount < totalItems && totalItems > 0 ? "rgba(245,158,11,0.5)" : "rgba(99,102,241,0.35)"}`,
            background: publishedCount < totalItems && totalItems > 0
              ? "linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)"
              : "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
            cursor: "pointer",
            transition: "all 220ms ease",
            textAlign: "left",
            boxShadow: publishedCount < totalItems && totalItems > 0
              ? "0 2px 8px rgba(245,158,11,0.15)"
              : "0 2px 8px rgba(99,102,241,0.12)",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.transform = "translateY(-2px)";
            btn.style.boxShadow = publishedCount < totalItems && totalItems > 0
              ? "0 8px 24px rgba(245,158,11,0.25)"
              : "0 8px 24px rgba(99,102,241,0.22)";
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.transform = "translateY(0)";
            btn.style.boxShadow = publishedCount < totalItems && totalItems > 0
              ? "0 2px 8px rgba(245,158,11,0.15)"
              : "0 2px 8px rgba(99,102,241,0.12)";
          }}
        >
          {/* Icon block */}
          <div style={{
            width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0,
            background: publishedCount < totalItems && totalItems > 0
              ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: publishedCount < totalItems && totalItems > 0
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
              color: publishedCount < totalItems && totalItems > 0 ? "#92400e" : "#3730a3",
            }}>
              Monthly Review
            </div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", fontWeight: 500 }}>
              {totalItems} items · {publishedCount} published · {totalItems - publishedCount} pending
            </div>
          </div>

          {/* Status pill */}
          {publishedCount < totalItems && totalItems > 0 ? (
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
                ⏳ {totalItems - publishedCount} pending
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
              ✓ All done
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
      {open && (
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
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-xl)",
              width: "100%",
              maxWidth: "860px",
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
                  <span className="badge badge-strong">{totalItems} items tracked</span>
                  <span className="badge badge-success">{publishedCount} published</span>
                  {totalItems - publishedCount > 0 && (
                    <span className="badge badge-warning">{totalItems - publishedCount} pending</span>
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
                {/* Show Published toggle */}
                <button
                  type="button"
                  onClick={() => setShowPublished(v => !v)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "8px", cursor: "pointer",
                    fontSize: "12px", fontWeight: 700, transition: "all 150ms",
                    border: `1.5px solid ${showPublished ? "var(--success)" : "var(--border-medium)"}`,
                    background: showPublished ? "var(--success-light)" : "var(--bg-elevated)",
                    color: showPublished ? "var(--success)" : "var(--text-muted)",
                  }}
                >
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: showPublished ? "var(--success)" : "var(--border-medium)",
                    transition: "background 150ms",
                  }} />
                  {t("gen.published")}
                  <span style={{
                    fontSize: "9px", fontWeight: 800,
                    padding: "1px 5px", borderRadius: "4px",
                    background: showPublished ? "var(--success)" : "var(--border-medium)",
                    color: "#fff",
                    transition: "background 150ms",
                  }}>
                    {data.reduce((s, c) => s + c.items.filter(i => !!i.existingSell).length, 0)}
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
                    {data.reduce((s, c) => s + c.items.filter(i => !i.existingSell).length, 0)}
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
                    const catPublished = cat.items.filter((i) => i.existingSell).length;
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
                          {catPublished === cat.items.length ? (
                            <span className="badge badge-success" style={{ fontSize: "10px" }}>
                              ✓ All published
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: "10px" }}>
                              {cat.items.length - catPublished} pending
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
                Prices saved here update the Sales catalog in real-time · Strategy: AVG buy price
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
        </div>
      )}
    </>
  );
}
