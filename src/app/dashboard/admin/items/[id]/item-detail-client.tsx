"use client";

import { useState, useMemo } from "react";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-context";

type Props = {
  item: {
    id: number;
    name: string;
    unit: string;
    description: string;
    active: number;
    category_name: string;
    category_id: number;
    transportation_per_unit: number;
    moq: number;
  };
  supplierStats: Array<{
    name: string;
    avg: number;
    min: number;
    max: number;
    quoteCount: number;
    latestPrice: number | null;
    latestMonth: string | null;
  }>;
  monthStats: Array<{
    month: string;
    avg: number;
    min: number;
    max: number;
    count: number;
  }>;
  months: string[];
  supplierNames: string[];
  serializedGrid: Record<string, Record<string, { price: number; recordedAt: string }>>;
  sellingRows: Array<{
    month: string;
    sell_min: number;
    sell_max: number;
    strategy: string;
    markup_type: string;
    markup_min: number;
    markup_max: number;
    created_by: string;
    created_at: string;
  }>;
  role: string;
};

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function ItemDetailClient({
  item,
  supplierStats,
  monthStats,
  months,
  supplierNames,
  serializedGrid,
  sellingRows,
  role,
}: Props) {
  const { locale } = useI18n();
  const [windowSize, setWindowSize] = useState<6 | 12 | "all">(6);
  const visibleMonths = useMemo(() => {
    return windowSize === "all" ? months : months.slice(0, windowSize);
  }, [months, windowSize]);

  // Compute SVG chart points based on monthStats
  const chartData = useMemo(() => {
    if (monthStats.length === 0) return null;
    const sorted = [...monthStats].reverse(); // oldest first
    const prices = sorted.map((s) => s.avg);
    const minP = Math.min(...prices) * 0.95;
    const maxP = Math.max(...prices) * 1.05;
    const range = maxP - minP || 1;

    const W = 700;
    const H = 200;
    const padding = { top: 20, right: 30, bottom: 30, left: 60 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const points = sorted.map((stat, i) => {
      const x = padding.left + (sorted.length === 1 ? chartW / 2 : (i / (sorted.length - 1)) * chartW);
      const y = padding.top + chartH - ((stat.avg - minP) / range) * chartH;
      return { x, y, avg: stat.avg, month: stat.month };
    });

    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    return { W, H, padding, points, path, minP, maxP, range, chartW, chartH };
  }, [monthStats]);

  const bestSupplier = supplierStats[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "10px 0" }}>
      {/* Print-only brand header */}
      <div className="print-only" style={{ display: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1e3a8a", paddingBottom: "16px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/faerp logo.svg" style={{ width: "36px", height: "36px", objectFit: "contain" }} alt="Logo" />
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800 }}>FAERP</div>
              <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: ".08em" }}>{locale === "ar" ? "نظام تسعير المنتجات" : "Enterprise ERP · On-Premises"}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "4px", color: "#111827" }}>{locale === "ar" ? "تفاصيل ملف الصنف" : "Item Profile Details"}</div>
            <div style={{ fontSize: "11px", color: "#6b7280" }}>{locale === "ar" ? `تم الإنشاء في ${new Date().toLocaleDateString("ar-EG")}` : `Generated ${new Date().toLocaleDateString()}`}</div>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/dashboard/admin/items" className="button button-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          {locale === "ar" ? "← العودة إلى الكتالوج" : "← Back to Catalog"}
        </Link>
        <button
          type="button"
          onClick={() => typeof window !== "undefined" && window.print()}
          className="button button-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          🖨️ {locale === "ar" ? "طباعة التفاصيل" : "Print Details"}
        </button>
      </div>

      {/* Item Title Section */}
      <div style={{
        padding: "24px",
        borderRadius: "16px",
        border: "1px solid var(--border-medium)",
        background: "var(--bg-surface)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "16px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#fff" }}>
            📦
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary)", marginBottom: "4px" }}>
              {item.category_name}
            </div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>{item.name}</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              {role !== "AD" && item.description && item.description.toLowerCase().includes("imported via csv template")
                ? (locale === "ar" ? "لا يوجد وصف." : "No description provided.")
                : (item.description || (locale === "ar" ? "لا يوجد وصف." : "No description provided."))}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span className="badge badge-strong" style={{ fontSize: "12px", padding: "4px 10px" }}>{item.unit}</span>
          <span className={`badge ${item.active ? "badge-success" : "badge-danger"}`} style={{ fontSize: "12px", padding: "4px 10px" }}>
            {item.active ? (locale === "ar" ? "نشط" : "Active") : (locale === "ar" ? "غير نشط" : "Inactive")}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {role !== "SA" ? (
          <>
            <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>{locale === "ar" ? "المورد صاحب أفضل سعر" : "Best Price Supplier"}</div>
              <strong style={{ fontSize: "20px", color: "var(--success)" }}>
                {bestSupplier ? bestSupplier.name : "—"}
              </strong>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                {bestSupplier?.latestPrice 
                  ? (locale === "ar" ? `الأحدث: ${formatCurrency(bestSupplier.latestPrice)}` : `Latest: ${formatCurrency(bestSupplier.latestPrice)}`) 
                  : (locale === "ar" ? "لا توجد عروض أسعار" : "No quotes available")}
              </div>
            </div>

            <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>{locale === "ar" ? "الموردون النشطون" : "Active Suppliers"}</div>
              <strong style={{ fontSize: "24px", color: "var(--primary)" }}>{supplierStats.length}</strong>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{locale === "ar" ? "تم تكوينه في الكتالوج" : "Configured in catalog"}</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>{locale === "ar" ? "أقل سعر بيع معتمد" : "Approved Min Selling Price"}</div>
              <strong style={{ fontSize: "24px", color: "var(--success)" }}>
                {sellingRows[0] ? formatCurrency(sellingRows[0].sell_min) : "—"}
              </strong>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                {locale === "ar" ? "نشط لشهر " : "Active for "}{sellingRows[0] ? formatMonthLabel(sellingRows[0].month) : (locale === "ar" ? "الشهر الحالي" : "current month")}
              </div>
            </div>

            <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>{locale === "ar" ? "أقصى سعر بيع معتمد" : "Approved Max Selling Price"}</div>
              <strong style={{ fontSize: "24px", color: "var(--primary)" }}>
                {sellingRows[0] ? formatCurrency(sellingRows[0].sell_max) : "—"}
              </strong>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                {locale === "ar" ? "نشط لشهر " : "Active for "}{sellingRows[0] ? formatMonthLabel(sellingRows[0].month) : (locale === "ar" ? "الشهر الحالي" : "current month")}
              </div>
            </div>
          </>
        )}

        <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>{locale === "ar" ? "الخدمات اللوجستية القياسية" : "Standard Logistics"}</div>
          <strong style={{ fontSize: "20px", color: "var(--text-primary)" }}>{formatCurrency(item.transportation_per_unit)}</strong>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{locale === "ar" ? "تكلفة النقل المقدرة لكل وحدة" : "Est. transport cost per unit"}</div>
        </div>

        <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>{locale === "ar" ? "الحد الأدنى لكمية الطلب (MOQ)" : "Minimum Order Qty"}</div>
          <strong style={{ fontSize: "24px", color: "var(--text-primary)" }}>{item.moq}</strong>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{locale === "ar" ? "وحدات التعبئة القياسية" : "Standard pack units"}</div>
        </div>
      </div>

      {/* Main Grid: Price Trends Chart & Supplier Lists */}
      {role === "SA" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {sellingRows.length > 0 ? (
            <div className="panel" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 20px 0", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                {locale === "ar" ? "💰 سجل أسعار البيع المعتمدة" : "💰 Approved Selling Price History"}
              </h3>
              <div className="table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)", borderBottom: "1.5px solid var(--border-medium)" }}>
                      <th style={{ padding: "12px 16px", textAlign: locale === "ar" ? "right" : "left", fontWeight: 700, color: "var(--text-muted)" }}>{locale === "ar" ? "الشهر" : "Month"}</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)" }}>{locale === "ar" ? "الاستراتيجية" : "Strategy"}</th>
                      <th style={{ padding: "12px 16px", textAlign: locale === "ar" ? "left" : "right", fontWeight: 700, color: "var(--success)" }}>{locale === "ar" ? "الحد الأدنى للسعر" : "Minimum Price"}</th>
                      <th style={{ padding: "12px 16px", textAlign: locale === "ar" ? "left" : "right", fontWeight: 700, color: "var(--primary)" }}>{locale === "ar" ? "الحد الأقصى للسعر" : "Maximum Price"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellingRows.map((row) => (
                      <tr key={row.month} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700 }}>{formatMonthLabel(row.month)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span className="badge badge-strong">{row.strategy.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: locale === "ar" ? "left" : "right", fontWeight: 700, color: "var(--success)" }}>
                          {formatCurrency(row.sell_min)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: locale === "ar" ? "left" : "right", fontWeight: 700, color: "var(--primary)" }}>
                          {formatCurrency(row.sell_max)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
              <h3>{locale === "ar" ? "لم يتم نشر أسعار بيع لهذا الصنف بعد." : "No selling prices published yet for this item."}</h3>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }} className="grid-responsive">
          {/* Left column: Chart & Matrix */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Chart Section */}
            {chartData && (
              <div className="panel" style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 16px 0", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  {locale === "ar" ? "📈 متوسط اتجاه سعر السوق" : "📈 Average Market Price Trend"}
                </h3>
                <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
                  <svg width={chartData.W} height={chartData.H} viewBox={`0 0 ${chartData.W} ${chartData.H}`} style={{ display: "block", margin: "0 auto" }}>
                    <line x1={chartData.padding.left} y1={chartData.padding.top + chartData.chartH} x2={chartData.padding.left + chartData.chartW} y2={chartData.padding.top + chartData.chartH} stroke="var(--border-medium)" />
                    <line x1={chartData.padding.left} y1={chartData.padding.top} x2={chartData.padding.left} y2={chartData.padding.top + chartData.chartH} stroke="var(--border-medium)" />

                    {/* Y Axis Gridlines & Labels */}
                    {[0, 0.5, 1].map((ratio) => {
                      const price = chartData.minP + chartData.range * ratio;
                      const y = chartData.padding.top + chartData.chartH - ratio * chartData.chartH;
                      return (
                        <g key={ratio}>
                          <line x1={chartData.padding.left} y1={y} x2={chartData.padding.left + chartData.chartW} y2={y} stroke="var(--border-light)" strokeDasharray="3,3" />
                          <text x={chartData.padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                            {formatCurrency(price)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Chart Line Path */}
                    <path d={chartData.path} fill="none" stroke="var(--primary)" strokeWidth="2.5" />

                    {/* Data Points */}
                    {chartData.points.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-surface)" stroke="var(--primary)" strokeWidth="2" />
                        <text x={p.x} y={chartData.padding.top + chartData.chartH + 18} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                          {formatMonthLabel(p.month).slice(0, 3)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            )}

            {/* Matrix table */}
            <div className="panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  {locale === "ar" ? "📊 مصفوفة الأسعار التاريخية" : "📊 Historical Price Matrix"}
                </h3>
                <div className="no-print" style={{ display: "flex", gap: "4px", background: "var(--bg-muted)", padding: "3px", borderRadius: "6px" }}>
                  {([6, 12, "all"] as const).map((w) => (
                    <button
                      key={String(w)}
                      type="button"
                      onClick={() => setWindowSize(w)}
                      style={{
                        padding: "3px 10px",
                        fontSize: "10px",
                        fontWeight: 700,
                        borderRadius: "5px",
                        border: "none",
                        cursor: "pointer",
                        background: windowSize === w ? "var(--primary)" : "transparent",
                        color: windowSize === w ? "#fff" : "var(--text-muted)",
                        transition: "all 150ms"
                      }}
                    >
                      {w === "all" ? (locale === "ar" ? "الكل" : "All") : `${w}M`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "10px 12px", textAlign: locale === "ar" ? "right" : "left", fontWeight: 700, color: "var(--text-muted)" }}>{locale === "ar" ? "الشهر" : "Month"}</th>
                      {supplierNames.map((s, idx) => (
                        <th key={s} style={{ padding: "10px 12px", textAlign: "center", color: COLORS[idx % COLORS.length], fontWeight: 700 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS[idx % COLORS.length], display: "inline-block" }} />
                            {s}
                          </span>
                        </th>
                      ))}
                      <th style={{ padding: "10px 12px", textAlign: "center", color: "var(--primary)", fontWeight: 700 }}>{locale === "ar" ? "المتوسط" : "Avg"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMonths.map((m, mi) => {
                      const monthRow = serializedGrid[m];
                      const prices = supplierNames.map((s) => monthRow?.[s]?.price).filter((p): p is number => p !== undefined);
                      const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
                      const minPrice = prices.length ? Math.min(...prices) : null;
                      const isLatest = mi === 0;

                      return (
                        <tr key={m} style={{ borderBottom: "1px solid var(--border-light)", background: isLatest ? "rgba(99,102,241,0.03)" : "transparent" }}>
                          <td style={{ padding: "10px 12px", fontWeight: isLatest ? 700 : 500 }}>
                            {formatMonthLabel(m)}
                            {isLatest && <span style={{ fontSize: "9px", fontWeight: 800, color: "var(--primary)", marginLeft: "6px", marginRight: "6px" }}>{locale === "ar" ? "الأحدث" : "LATEST"}</span>}
                          </td>
                          {supplierNames.map((s) => {
                            const entry = monthRow?.[s];
                            const isBest = entry && minPrice !== null && entry.price === minPrice;
                            return (
                              <td key={s} style={{ padding: "10px 12px", textAlign: "center", fontWeight: isBest ? 700 : 400, color: isBest ? "var(--success)" : entry ? "var(--text-primary)" : "var(--text-dim)", background: isBest ? "rgba(16,185,129,0.06)" : "transparent" }}>
                                {entry ? formatCurrency(entry.price) : "—"}
                              </td>
                            );
                          })}
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "var(--primary)" }}>
                            {avg !== null ? formatCurrency(avg) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right column: Suppliers list & Selling Prices */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Supplier rankings */}
            <div className="panel" style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 16px 0", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                {locale === "ar" ? "🏬 تصنيف الموردين" : "🏬 Supplier Rankings"}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {supplierStats.map((s, idx) => {
                  const color = COLORS[idx % COLORS.length];
                  return (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-light)" }}>
                      <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color }}>
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {locale === "ar" ? `${s.quoteCount} عروض · المتوسط ${formatCurrency(s.avg)}` : `${s.quoteCount} quotes · Avg ${formatCurrency(s.avg)}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Published Selling Prices (SC only) */}
            {(role === "SC" || role === "SA") && sellingRows.length > 0 && (
              <div className="panel" style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 16px 0", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  {locale === "ar" ? "💰 قواعد الأسعار المنشورة" : "💰 Published Price Rules"}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {sellingRows.slice(0, 5).map((row) => (
                    <div key={row.month} style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border-light)", fontSize: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span className="badge" style={{ fontSize: "9px" }}>{row.month}</span>
                        <strong style={{ color: "var(--primary-dark)" }}>{row.strategy.toUpperCase()}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span style={{ color: "var(--success)" }}>{formatCurrency(row.sell_min)}</span>
                        <span style={{ color: "var(--text-muted)" }}>–</span>
                        <span style={{ color: "var(--primary)" }}>{formatCurrency(row.sell_max)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
