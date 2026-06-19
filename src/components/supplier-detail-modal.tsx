"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n-context";
import { getSupplierQuotesHistoryAction } from "@/app/actions/admin";

type Supplier = {
  id: number;
  name: string;
  fame_name?: string | null;
  contact_person: string | null;
  phone: string | null;
  code: string | null;
  contact_job_title: string | null;
  represented_products: string | null;
  email: string | null;
  region: string | null;
  address: string | null;
  quote_count: number;
  quoted_item_names?: string | null;
};

type QuoteRow = {
  id: number;
  price: number;
  currency: string;
  month: string;
  notes: string | null;
  collected_by: string;
  recorded_at: string;
  item_name: string;
  item_id: number;
  category_name: string;
};

type Props = {
  supplier: Supplier;
  onClose: () => void;
};

// ─────────────────────────────────────────────────────
// SVG Line Chart
// ─────────────────────────────────────────────────────
function PriceLineChart({ quotes, locale }: { quotes: QuoteRow[]; locale: string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>("");

  const itemNames = Array.from(new Set(quotes.map((q) => q.item_name))).sort();

  useEffect(() => {
    if (itemNames.length > 0 && !selectedItem) setSelectedItem(itemNames[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemNames.join(",")]);

  const itemQuotes = quotes
    .filter((q) => q.item_name === selectedItem)
    .sort((a, b) => a.month.localeCompare(b.month));

  const formatMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const en = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const ar = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const idx = parseInt(mo) - 1;
    return locale === "ar" ? `${ar[idx]} ${y}` : `${en[idx]} '${y.slice(2)}`;
  };

  if (itemQuotes.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        {locale === "ar" ? "لا توجد بيانات أسعار لعرضها." : "No price data available for this product."}
      </div>
    );
  }

  const W = 620, H = 250;
  const PAD = { top: 24, right: 20, bottom: 44, left: 72 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const prices = itemQuotes.map((q) => q.price);
  const minP = Math.min(...prices) * 0.92;
  const maxP = Math.max(...prices) * 1.08;
  const pRange = maxP - minP || 1;
  const n = itemQuotes.length;

  const xS = (i: number) => PAD.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
  const yS = (p: number) => PAD.top + cH - ((p - minP) / pRange) * cH;

  const pts = itemQuotes.map((q, i) => ({ x: xS(i), y: yS(q.price), price: q.price, month: q.month }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = [
    `M${pts[0].x},${PAD.top + cH}`,
    ...pts.map((p) => `L${p.x},${p.y}`),
    `L${pts[pts.length - 1].x},${PAD.top + cH}Z`,
  ].join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minP + pRange * t);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const peak = Math.max(...prices);
  const low = Math.min(...prices);

  return (
    <div>
      {/* Product selector pills */}
      {itemNames.length > 1 && (
        <div style={{ marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", paddingTop: "5px", flexShrink: 0 }}>
            {locale === "ar" ? "المنتج:" : "Product:"}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {itemNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedItem(name)}
                title={name}
                style={{
                  padding: "4px 12px", fontSize: "11px", borderRadius: "20px", border: "1px solid",
                  borderColor: selectedItem === name ? "var(--primary)" : "var(--border-medium)",
                  backgroundColor: selectedItem === name ? "var(--primary)" : "transparent",
                  color: selectedItem === name ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer", fontWeight: selectedItem === name ? "700" : "500",
                  transition: "all 150ms", maxWidth: "220px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {name.length > 32 ? name.slice(0, 32) + "…" : name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SVG Chart */}
      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", maxWidth: "100%", fontFamily: "var(--font-sans)" }}>
          <defs>
            <linearGradient id="sgChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines + Y labels */}
          {yTicks.map((tick, i) => {
            const y = yS(tick);
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={PAD.left + cW} y2={y}
                  stroke="var(--border-light)" strokeWidth="1" strokeDasharray="4,4" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                  {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#sgChartGrad)" />

          {/* Average dashed line */}
          {n > 1 && (
            <line
              x1={PAD.left} y1={yS(avg)}
              x2={PAD.left + cW} y2={yS(avg)}
              stroke="#f59e0b" strokeWidth="1" strokeDasharray="6,3" opacity="0.65"
            />
          )}

          {/* Main line */}
          <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" />

          {/* Data points */}
          {pts.map((p, i) => (
            <g key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "crosshair" }}>
              <circle cx={p.x} cy={p.y} r="16" fill="transparent" />
              <circle cx={p.x} cy={p.y} r={hoveredIdx === i ? 6 : 4}
                fill={hoveredIdx === i ? "var(--primary)" : "var(--bg-surface)"}
                stroke="var(--primary)" strokeWidth="2.5" />
            </g>
          ))}

          {/* X-axis month labels */}
          {pts.map((p, i) => {
            const every = Math.max(1, Math.ceil(n / 7));
            if (n > 7 && i % every !== 0 && i !== n - 1) return null;
            return (
              <text key={i} x={p.x} y={PAD.top + cH + 18} textAnchor="middle" fontSize="9.5" fill="var(--text-muted)">
                {formatMonth(p.month)}
              </text>
            );
          })}

          {/* Y axis label */}
          <text x={14} y={PAD.top + cH / 2} textAnchor="middle" fontSize="10" fill="var(--text-muted)"
            transform={`rotate(-90,14,${PAD.top + cH / 2})`}>
            {locale === "ar" ? "ج.م" : "EGP"}
          </text>
        </svg>

        {/* Hover tooltip */}
        {hoveredIdx !== null && pts[hoveredIdx] && (
          <div style={{
            position: "absolute",
            top: Math.max(4, pts[hoveredIdx].y - 62),
            left: Math.min(pts[hoveredIdx].x - 50, W - 160),
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-medium)",
            borderRadius: "8px", padding: "8px 14px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap",
          }}>
            <div style={{ fontWeight: "800", color: "var(--primary)", fontSize: "14px" }}>
              EGP {pts[hoveredIdx].price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
              {formatMonth(pts[hoveredIdx].month)}
            </div>
          </div>
        )}
      </div>

      {/* Stats summary row */}
      {n > 1 && (
        <div style={{
          display: "flex", gap: "20px", marginTop: "12px", flexWrap: "wrap",
          paddingTop: "12px", borderTop: "1px solid var(--border-light)",
        }}>
          {[
            { label: locale === "ar" ? "أعلى سعر" : "Peak", value: peak, color: "#ef4444" },
            { label: locale === "ar" ? "أدنى سعر" : "Lowest", value: low, color: "#22c55e" },
            { label: locale === "ar" ? "المتوسط" : "Average", value: avg, color: "var(--primary)" },
          ].map((s) => (
            <div key={s.label} style={{ fontSize: "12px", display: "flex", gap: "7px", alignItems: "center" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: s.color, flexShrink: 0, display: "inline-block" }} />
              <span style={{ color: "var(--text-muted)" }}>{s.label}:</span>
              <strong style={{ color: s.color }}>
                EGP {s.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Main Modal Export
// ─────────────────────────────────────────────────────
export default function SupplierDetailModal({ supplier, onClose }: Props) {
  const { locale } = useI18n();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "chart" | "history">("overview");

  useEffect(() => {
    setLoading(true);
    getSupplierQuotesHistoryAction(supplier.id).then((res) => {
      if (res.success && res.quotes) setQuotes(res.quotes as QuoteRow[]);
      setLoading(false);
    });
  }, [supplier.id]);

  const uniqueItems = Array.from(new Set(quotes.map((q) => q.item_name)));
  const totalPriceSum = quotes.reduce((s, q) => s + q.price, 0);
  const sortedByMonth = [...quotes].sort((a, b) => b.month.localeCompare(a.month));
  const latestMonth = sortedByMonth[0]?.month ?? null;

  const formatDate = (dt: string) => {
    try {
      const d = new Date(dt);
      return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
    } catch { return dt; }
  };

  const formatMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const en = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const ar = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const idx = parseInt(mo) - 1;
    return locale === "ar" ? `${ar[idx]} ${y}` : `${en[idx]} ${y}`;
  };

  const tabs = [
    { id: "overview" as const, label: locale === "ar" ? "نظرة عامة" : "Overview", icon: "🏢" },
    { id: "chart"    as const, label: locale === "ar" ? "سجل الأسعار" : "Price Chart", icon: "📈" },
    { id: "history"  as const, label: locale === "ar" ? "جميع العروض" : "All Quotes", icon: "🧾" },
  ];

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const uniqueItemsHtml = uniqueItems.map(item => {
      const iq = quotes.filter(q => q.item_name === item);
      const last = [...iq].sort((a, b) => b.month.localeCompare(a.month))[0];
      return `
        <div style="padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; min-width: 140px; margin-bottom: 6px; background: #ffffff;">
          <div style="font-weight: bold; color: #1e3a8a; font-size: 13px;">${item}</div>
          <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 8px; align-items: center;">
            <span style="color: #2563eb; font-weight: 700;">EGP ${last.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span style="color: #6b7280; font-size: 11px;">${formatMonth(last.month)} (${iq.length} ${locale === "ar" ? "مرة" : "entries"})</span>
          </div>
        </div>
      `;
    }).join("");

    const tableRowsHtml = sortedByMonth.map((q, i) => `
      <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f9fafb"}; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 10px; font-weight: bold; color: #111827;">${formatMonth(q.month)}</td>
        <td style="padding: 8px 10px; font-weight: 600;">${q.item_name}</td>
        <td style="padding: 8px 10px; color: #4b5563;">${q.category_name}</td>
        <td style="padding: 8px 10px; font-weight: bold; color: #2563eb;">EGP ${q.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td style="padding: 8px 10px; color: #4b5563;">${q.notes || "—"}</td>
        <td style="padding: 8px 10px; color: #6b7280;">${q.collected_by}</td>
        <td style="padding: 8px 10px; color: #6b7280;">${formatDate(q.recorded_at)}</td>
      </tr>
    `).join("");

    const title = locale === "ar" ? `تقرير المورد: ${supplier.name}` : `Supplier Report: ${supplier.name}`;
    const dir = locale === "ar" ? "rtl" : "ltr";

    const content = `
      <!DOCTYPE html>
      <html dir="${dir}">
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          @font-face {
            font-family: 'Readex Pro Variable';
            font-style: normal;
            font-weight: 160 700;
            src: url('/fonts/readex-pro-arabic-wght-normal.woff2') format('woff2');
            unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF, U+0000-007F;
          }
          @font-face {
            font-family: 'Readex Pro Variable';
            font-style: normal;
            font-weight: 160 700;
            src: url('/fonts/readex-pro-latin-wght-normal.woff2') format('woff2');
            unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+FEFF, U+FFFD;
          }
          body {
            font-family: 'Readex Pro Variable', -apple-system, sans-serif;
            color: #111827;
            margin: 20px;
            line-height: 1.4;
          }
          h1, h2, h3 {
            margin: 0;
            color: #1e3a8a;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          .card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px;
            background-color: #f9fafb;
          }
          .card-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            margin-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
          }
          .info-row {
            margin-bottom: 8px;
          }
          .info-label {
            font-size: 9px;
            color: #6b7280;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .info-value {
            font-size: 12px;
            font-weight: 600;
          }
          .stats-strip {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background-color: #f9fafb;
            margin-bottom: 20px;
          }
          .stat-item {
            padding: 10px;
            text-align: center;
            border-right: 1px solid #e5e7eb;
          }
          .stat-item:last-child {
            border-right: none;
          }
          .stat-val {
            font-size: 15px;
            font-weight: bold;
            color: #1e3a8a;
          }
          .stat-lbl {
            font-size: 9px;
            color: #6b7280;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 10px;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: bold;
            text-align: ${locale === "ar" ? "right" : "left"};
            padding: 6px 8px;
            border-bottom: 2px solid #d1d5db;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px;">
          <div>
            <h1>${supplier.name}</h1>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">
              ${supplier.code ? `<span><strong>${locale === "ar" ? "كود المورد:" : "Supplier Code:"}</strong> ${supplier.code}</span> · ` : ""}
              ${supplier.region ? `<span><strong>${locale === "ar" ? "المنطقة:" : "Region:"}</strong> ${supplier.region}</span>` : ""}
            </div>
          </div>
          <div class="no-print">
            <button onclick="window.print();" style="padding: 6px 12px; font-weight: bold; background-color: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              ${locale === "ar" ? "طباعة التقرير" : "Print Report"}
            </button>
          </div>
        </div>

        <div class="stats-strip">
          <div class="stat-item" style="${locale === "ar" ? "border-left: 1px solid #e5e7eb; border-right: none;" : ""}">
            <div class="stat-val">${uniqueItems.length}</div>
            <div class="stat-lbl">${locale === "ar" ? "منتجات مسعرة" : "Products Priced"}</div>
          </div>
          <div class="stat-item" style="${locale === "ar" ? "border-left: 1px solid #e5e7eb; border-right: none;" : ""}">
            <div class="stat-val">${quotes.length}</div>
            <div class="stat-lbl">${locale === "ar" ? "إجمالي العروض" : "Total Quotes"}</div>
          </div>
          <div class="stat-item" style="${locale === "ar" ? "border-left: 1px solid #e5e7eb; border-right: none;" : ""}">
            <div class="stat-val">EGP ${totalPriceSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div class="stat-lbl">${locale === "ar" ? "مجموع الأسعار" : "Price Total"}</div>
          </div>
          <div class="stat-item">
            <div class="stat-val">${latestMonth ? formatMonth(latestMonth) : "—"}</div>
            <div class="stat-lbl">${locale === "ar" ? "آخر تسعير" : "Last Quote"}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">${locale === "ar" ? "بيانات التواصل" : "Contact Information"}</div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "المسؤول" : "Contact Person"}</div>
              <div class="info-value">${supplier.contact_person || "—"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "المنصب" : "Job Title"}</div>
              <div class="info-value">${supplier.contact_job_title || "—"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "الهاتف" : "Phone"}</div>
              <div class="info-value">${supplier.phone || "—"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "البريد الإلكتروني" : "Email"}</div>
              <div class="info-value">${supplier.email || "—"}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">${locale === "ar" ? "البيانات التجارية" : "Business Details"}</div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "كود المورد" : "Supplier Code"}</div>
              <div class="info-value">${supplier.code || "—"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "المنطقة" : "Region"}</div>
              <div class="info-value">${supplier.region || "—"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "العنوان" : "Address"}</div>
              <div class="info-value">${supplier.address || "—"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">${locale === "ar" ? "المنتجات التي يمثلها" : "Represented Products"}</div>
              <div class="info-value">${supplier.represented_products || "—"}</div>
            </div>
          </div>
        </div>

        ${uniqueItems.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 8px; font-size: 13px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">${locale === "ar" ? "المنتجات المسعرة مع المورد" : "Products Quoted with Supplier"}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
              ${uniqueItemsHtml}
            </div>
          </div>
        ` : ""}

        <div>
          <h3 style="margin-bottom: 8px; font-size: 13px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">${locale === "ar" ? "سجل عروض الأسعار" : "Quotes History"}</h3>
          <table>
            <thead>
              <tr>
                <th style="${locale === "ar" ? "text-align: right;" : "text-align: left;"}">${locale === "ar" ? "الشهر" : "Month"}</th>
                <th style="${locale === "ar" ? "text-align: right;" : "text-align: left;"}">${locale === "ar" ? "المنتج" : "Item"}</th>
                <th style="${locale === "ar" ? "text-align: right;" : "text-align: left;"}">${locale === "ar" ? "القسم" : "Category"}</th>
                <th style="${locale === "ar" ? "text-align: right;" : "text-align: left;"}">${locale === "ar" ? "السعر" : "Price"}</th>
                <th style="${locale === "ar" ? "text-align: right;" : "text-align: left;"}">${locale === "ar" ? "ملاحظات" : "Notes"}</th>
                <th style="${locale === "ar" ? "text-align: right;" : "text-align: left;"}">${locale === "ar" ? "جُمع بواسطة" : "Collected By"}</th>
                <th style="${locale === "ar" ? "text-align: right;" : "text-align: left;"}">${locale === "ar" ? "التاريخ" : "Date"}</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="modal-overlay sdm-print-root" onClick={onClose}>
        <div
          className="modal-container"
          style={{ maxWidth: "840px", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Modal Header ─────────────────────────────────── */}
          <div
            className="modal-header"
            style={{
              background: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)",
              borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
              padding: "20px 24px",
              border: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1 }}>
              <div style={{
                width: "50px", height: "50px", borderRadius: "12px",
                backgroundColor: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px", flexShrink: 0,
              }}>
                🏭
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: "19px", fontWeight: "800", color: "#fff", letterSpacing: "-0.02em" }}>
                  {supplier.fame_name || supplier.name}
                </h2>
                {supplier.fame_name && supplier.fame_name !== supplier.name && (
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", marginTop: "2px", fontStyle: "italic" }}>
                    {supplier.name}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "7px" }}>
                  {supplier.code && (
                    <span style={{
                      fontSize: "10px", fontWeight: "700", padding: "2px 10px",
                      borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.2)",
                      color: "#fff", letterSpacing: "0.07em",
                    }}>
                      {supplier.code}
                    </span>
                  )}
                  {supplier.region && (
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                      📍 {supplier.region}
                    </span>
                  )}
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                    📊 {supplier.quote_count} {locale === "ar" ? "عرض سعر" : "quotes"}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }} className="sdm-no-print">
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  padding: "8px 16px", fontSize: "12px", fontWeight: "700",
                  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.4)",
                  backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                  transition: "background 150ms",
                }}
              >
                🖨️ {locale === "ar" ? "طباعة" : "Print"}
              </button>
              <button
                className="modal-close-btn"
                onClick={onClose}
                style={{ color: "rgba(255,255,255,0.85)", fontSize: "26px" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* ── Stats Strip ──────────────────────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            backgroundColor: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-light)",
            flexShrink: 0,
          }}>
            {[
              { icon: "📦", label: locale === "ar" ? "منتجات مُسعَّرة" : "Products Priced",  value: loading ? "…" : String(uniqueItems.length) },
              { icon: "🧾", label: locale === "ar" ? "إجمالي العروض"    : "Total Quotes",     value: loading ? "…" : String(quotes.length) },
              { icon: "💰", label: locale === "ar" ? "مجموع الأسعار"   : "Price Total",      value: loading ? "…" : `EGP ${totalPriceSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
              { icon: "🗓️", label: locale === "ar" ? "آخر تسعير"       : "Last Quote",       value: loading ? "…" : (latestMonth ? formatMonth(latestMonth) : "—") },
            ].map((stat) => (
              <div key={stat.label} style={{ padding: "14px 12px", borderRight: "1px solid var(--border-light)", textAlign: "center" }}>
                <div style={{ fontSize: "20px", marginBottom: "5px" }}>{stat.icon}</div>
                <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-primary)", lineHeight: 1.1 }}>{stat.value}</div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ── Tab Bar ──────────────────────────────────────── */}
          <div className="sdm-tab-bar" style={{
            display: "flex",
            borderBottom: "1px solid var(--border-light)",
            backgroundColor: "var(--bg-surface)",
            flexShrink: 0,
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "13px 22px", fontSize: "13px",
                  fontWeight: activeTab === tab.id ? "700" : "500",
                  color: activeTab === tab.id ? "var(--primary)" : "var(--text-secondary)",
                  borderBottom: `2px solid ${activeTab === tab.id ? "var(--primary)" : "transparent"}`,
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "7px",
                  transition: "all 150ms",
                }}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* ── Body ─────────────────────────────────────────── */}
          <div className="modal-body" style={{ padding: "24px", overflowY: "auto", flex: 1 }}>

            {/* ═══════ OVERVIEW TAB ═══════ */}
            {activeTab === "overview" && (
              <div className="sdm-overview-section" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                  {/* Contact Info Card */}
                  <div style={{ backgroundColor: "var(--bg-subtle)", borderRadius: "12px", padding: "18px", border: "1px solid var(--border-light)" }}>
                    <p style={{ margin: "0 0 14px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)" }}>
                      {locale === "ar" ? "بيانات التواصل" : "Contact Information"}
                    </p>
                    {[
                      { icon: "👤", lbl: locale === "ar" ? "المسؤول"            : "Contact Person",      val: supplier.contact_person,      href: undefined as string | undefined },
                      { icon: "💼", lbl: locale === "ar" ? "المنصب"             : "Job Title",            val: supplier.contact_job_title,   href: undefined as string | undefined },
                      { icon: "📞", lbl: locale === "ar" ? "الهاتف"             : "Phone",                val: supplier.phone,               href: supplier.phone ? `tel:${supplier.phone}` : undefined },
                      { icon: "✉️", lbl: locale === "ar" ? "البريد الإلكتروني"  : "Email",                val: supplier.email,               href: supplier.email ? `mailto:${supplier.email}` : undefined },
                    ].map((row) => (
                      <div key={row.lbl} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "12px" }}>
                        <span style={{ fontSize: "17px", flexShrink: 0, lineHeight: "1.5" }}>{row.icon}</span>
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.lbl}</div>
                          {row.href ? (
                            <a href={row.href} style={{ fontSize: "13px", color: "var(--primary)", textDecoration: "none", fontWeight: "600" }}>{row.val || "—"}</a>
                          ) : (
                            <div style={{ fontSize: "13px", color: row.val ? "var(--text-primary)" : "var(--text-muted)", fontWeight: "600" }}>{row.val || "—"}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Business Details Card */}
                  <div style={{ backgroundColor: "var(--bg-subtle)", borderRadius: "12px", padding: "18px", border: "1px solid var(--border-light)" }}>
                    <p style={{ margin: "0 0 14px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)" }}>
                      {locale === "ar" ? "البيانات التجارية" : "Business Details"}
                    </p>
                    {[
                      { icon: "🔖", lbl: locale === "ar" ? "كود المورد"              : "Supplier Code",          val: supplier.code },
                      { icon: "📍", lbl: locale === "ar" ? "المنطقة"                 : "Region",                 val: supplier.region },
                      { icon: "🏠", lbl: locale === "ar" ? "العنوان"                 : "Address",                val: supplier.address },
                      { icon: "🏷️", lbl: locale === "ar" ? "المنتجات التي يمثلها"   : "Represented Products",   val: supplier.represented_products },
                    ].map((row) => (
                      <div key={row.lbl} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "12px" }}>
                        <span style={{ fontSize: "17px", flexShrink: 0, lineHeight: "1.5" }}>{row.icon}</span>
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.lbl}</div>
                          <div style={{ fontSize: "13px", color: row.val ? "var(--text-primary)" : "var(--text-muted)", fontWeight: "600", lineHeight: "1.5" }}>{row.val || "—"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* T14: 3-month price trend grid */}
                {!loading && uniqueItems.length > 0 && (() => {
                  // Collect the last 3 unique months across all quotes
                  const allMonths = Array.from(new Set(quotes.map(q => q.month))).sort().slice(-3);
                  return (
                    <div style={{ backgroundColor: "var(--bg-subtle)", borderRadius: "12px", padding: "18px", border: "1px solid var(--border-light)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)" }}>
                        {locale === "ar"
                          ? `المنتجات المُسعَّرة — آخر ${allMonths.length} أشهر (${uniqueItems.length})`
                          : `Products Quoted — Last ${allMonths.length} Months (${uniqueItems.length})`}
                      </p>
                      {/* Header row */}
                      <div style={{ display: "grid", gridTemplateColumns: `2fr repeat(${allMonths.length}, 1fr) 80px 64px`, gap: "6px", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", padding: "0 6px" }}>
                        <span>{locale === "ar" ? "المنتج" : "Item"}</span>
                        {allMonths.map(m => {
                          const [y, mo] = m.split("-");
                          const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                          return <span key={m} style={{ textAlign: "center" }}>{names[parseInt(mo)-1]} {y.slice(2)}</span>;
                        })}
                        <span style={{ textAlign: "center" }}>Trend</span>
                        <span style={{ textAlign: "center" }}>Chart</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {uniqueItems.map(item => {
                          const iq = quotes.filter(q => q.item_name === item);
                          // Price per month (avg if multiple)
                          const priceByMonth: Record<string, number> = {};
                          for (const m of allMonths) {
                            const entries = iq.filter(q => q.month === m);
                            if (entries.length > 0) {
                              priceByMonth[m] = entries.reduce((s, e) => s + e.price, 0) / entries.length;
                            }
                          }
                          const prices = allMonths.map(m => priceByMonth[m] ?? null);
                          const validPrices = prices.filter((p): p is number => p !== null);
                          const first = validPrices[0] ?? null;
                          const last = validPrices[validPrices.length - 1] ?? null;
                          const trendPct = first && last && first > 0 ? ((last - first) / first) * 100 : null;
                          const trendColor = trendPct === null ? "var(--text-muted)" : trendPct > 1 ? "var(--danger)" : trendPct < -1 ? "var(--success)" : "var(--text-muted)";
                          const trendIcon = trendPct === null ? "—" : trendPct > 1 ? "↑" : trendPct < -1 ? "↓" : "→";

                          // Sparkline SVG
                          const svgW = 52, svgH = 22;
                          const sparkPrices = validPrices;
                          const minP = Math.min(...sparkPrices), maxP = Math.max(...sparkPrices);
                          const range = maxP - minP || 1;
                          const pts = sparkPrices.map((p, i) => {
                            const x = sparkPrices.length === 1 ? svgW / 2 : (i / (sparkPrices.length - 1)) * svgW;
                            const y = svgH - ((p - minP) / range) * (svgH - 4) - 2;
                            return `${x},${y}`;
                          }).join(" ");

                          return (
                            <div key={item} style={{
                              display: "grid", gridTemplateColumns: `2fr repeat(${allMonths.length}, 1fr) 80px 64px`,
                              gap: "6px", alignItems: "center",
                              padding: "7px 6px", borderRadius: "8px", fontSize: "12px",
                              background: "var(--bg-surface)", border: "1px solid var(--border)"
                            }}>
                              <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "11.5px" }}>{item}</span>
                              {allMonths.map(m => (
                                <span key={m} style={{ textAlign: "center", fontWeight: 600, color: priceByMonth[m] ? "var(--text-primary)" : "var(--text-muted)", fontSize: "11px" }}>
                                  {priceByMonth[m] ? `${priceByMonth[m].toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                                </span>
                              ))}
                              <span style={{ textAlign: "center", fontWeight: 800, color: trendColor, fontSize: "12px" }}>
                                {trendIcon}{trendPct !== null ? ` ${Math.abs(trendPct).toFixed(1)}%` : ""}
                              </span>
                              <span style={{ display: "flex", justifyContent: "center" }}>
                                {sparkPrices.length > 1 ? (
                                  <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
                                    <polyline
                                      points={pts}
                                      fill="none"
                                      stroke={trendPct !== null && trendPct > 1 ? "#ef4444" : trendPct !== null && trendPct < -1 ? "#10b981" : "#6366f1"}
                                      strokeWidth="1.8"
                                      strokeLinejoin="round"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                ) : <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>·</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {!loading && uniqueItems.length === 0 && (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-subtle)", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>📭</div>
                    <div style={{ fontWeight: "700", color: "var(--text-secondary)" }}>
                      {locale === "ar" ? "لم يتم تسجيل أي عروض أسعار من هذا المورد بعد." : "No quotes recorded from this supplier yet."}
                    </div>
                    <div style={{ fontSize: "12px", marginTop: "6px", color: "var(--text-muted)" }}>
                      {locale === "ar" ? "أسعار المورد تُسجَّل عبر نماذج تجميع الأسعار." : "Supplier quotes are recorded via the WH price-collection forms."}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════ CHART TAB ═══════ */}
            {activeTab === "chart" && (
              <div>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--text-muted)" }}>
                  {locale === "ar"
                    ? "تتبع تطور أسعار المورد لكل منتج عبر الأشهر. مرّر المؤشر فوق النقاط لرؤية القيم."
                    : "Track how this supplier's prices evolved per product across months. Hover over data points to see exact values."}
                </p>
                {loading ? (
                  <div style={{ padding: "70px", textAlign: "center", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>⏳</div>
                    <div>{locale === "ar" ? "جارٍ تحميل البيانات..." : "Loading price data..."}</div>
                  </div>
                ) : quotes.length === 0 ? (
                  <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-subtle)", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
                    <div style={{ fontWeight: "700", color: "var(--text-secondary)" }}>
                      {locale === "ar" ? "لا توجد بيانات أسعار لعرضها." : "No pricing data available yet."}
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: "var(--bg-subtle)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border-light)" }}>
                    <PriceLineChart quotes={quotes} locale={locale} />
                  </div>
                )}
              </div>
            )}

            {/* ═══════ HISTORY TABLE TAB ═══════ */}
            {activeTab === "history" && (
              <div>
                {loading ? (
                  <div style={{ padding: "70px", textAlign: "center", color: "var(--text-muted)" }}>
                    ⏳ {locale === "ar" ? "جارٍ تحميل السجل..." : "Loading history..."}
                  </div>
                ) : quotes.length === 0 ? (
                  <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-subtle)", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
                    <div style={{ fontWeight: "700" }}>
                      {locale === "ar" ? "لا توجد عروض أسعار مسجلة." : "No quotes recorded."}
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--text-muted)" }}>
                      {locale === "ar"
                        ? `${quotes.length} إدخال سعر — مرتبة من الأحدث إلى الأقدم`
                        : `${quotes.length} price entries — sorted newest first`}
                    </p>
                    <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "var(--bg-elevated)" }}>
                            {[
                              locale === "ar" ? "الشهر"               : "Month",
                              locale === "ar" ? "المنتج"               : "Item",
                              locale === "ar" ? "القسم"                : "Category",
                              locale === "ar" ? "السعر (ج.م)"          : "Price (EGP)",
                              locale === "ar" ? "ملاحظات"              : "Notes",
                              locale === "ar" ? "جُمع بواسطة"          : "Collected By",
                              locale === "ar" ? "التاريخ"              : "Date",
                            ].map((h) => (
                              <th key={h} style={{
                                padding: "11px 14px", textAlign: "left", fontWeight: "700",
                                fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase",
                                letterSpacing: "0.07em", borderBottom: "2px solid var(--border-medium)",
                                whiteSpace: "nowrap",
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedByMonth.map((q, i) => (
                            <tr key={q.id} style={{
                              backgroundColor: i % 2 === 0 ? "transparent" : "var(--bg-subtle)",
                              borderBottom: "1px solid var(--border-light)",
                            }}>
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontWeight: "700", color: "var(--text-primary)" }}>
                                {formatMonth(q.month)}
                              </td>
                              <td style={{ padding: "10px 14px", maxWidth: "200px" }}>
                                <span style={{ display: "block", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  title={q.item_name}>
                                  {q.item_name}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                {q.category_name}
                              </td>
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                <strong style={{ color: "var(--primary)", fontSize: "13px" }}>
                                  {q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </strong>
                                <span style={{ color: "var(--text-muted)", fontSize: "10px", marginLeft: "4px" }}>{q.currency}</span>
                              </td>
                              <td style={{ padding: "10px 14px", color: "var(--text-secondary)", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                title={q.notes || ""}>
                                {q.notes || <span style={{ color: "var(--text-muted)" }}>—</span>}
                              </td>
                              <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                {q.collected_by}
                              </td>
                              <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: "11px" }}>
                                {formatDate(q.recorded_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
  );
}
