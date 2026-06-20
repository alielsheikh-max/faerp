"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import Link from "next/link";

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
  supplier: {
    id: number;
    name: string;
    fame_name: string | null;
    contact_person: string;
    phone: string;
    code: string | null;
    contact_job_title: string | null;
    represented_products: string | null;
    email: string | null;
    region: string | null;
    address: string | null;
    total_quotes: number;
  };
  itemStats: Array<{
    itemId: number;
    itemName: string;
    unit: string;
    categoryName: string;
    categoryId: number;
    avg: number;
    min: number;
    max: number;
    quoteCount: number;
    latestPrice: number;
    latestMonth: string;
    avgDeviation: number;
  }>;
  monthStats: Array<{
    month: string;
    avg: number;
    count: number;
  }>;
  months: string[];
  quotesHistory: QuoteRow[];
  role: string;
};

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function SupplierDetailClient({
  supplier,
  itemStats,
  monthStats,
  months,
  quotesHistory,
  role,
}: Props) {
  const [catFilter, setCatFilter] = useState("all");
  const categories = useMemo(() => {
    return Array.from(new Set(itemStats.map((i) => i.categoryName))).sort();
  }, [itemStats]);

  const filteredItems = useMemo(() => {
    return catFilter === "all" ? itemStats : itemStats.filter((i) => i.categoryName === catFilter);
  }, [itemStats, catFilter]);

  const totalQuotes = useMemo(() => itemStats.reduce((s, i) => s + i.quoteCount, 0), [itemStats]);
  const avgDev = useMemo(() => {
    return itemStats.length ? itemStats.reduce((s, i) => s + i.avgDeviation, 0) / itemStats.length : 0;
  }, [itemStats]);

  const maxCount = useMemo(() => Math.max(...monthStats.map((m) => m.count), 1), [monthStats]);

  // Product Quote Line Chart
  const [selectedProduct, setSelectedProduct] = useState("");
  const productNames = useMemo(() => {
    return Array.from(new Set(quotesHistory.map((q) => q.item_name))).sort();
  }, [quotesHistory]);

  useEffect(() => {
    if (productNames.length > 0 && !selectedProduct) {
      setSelectedProduct(productNames[0]);
    }
  }, [productNames, selectedProduct]);

  const chartData = useMemo(() => {
    if (!selectedProduct) return null;
    const itemQuotes = quotesHistory
      .filter((q) => q.item_name === selectedProduct)
      .sort((a, b) => a.month.localeCompare(b.month));

    if (itemQuotes.length === 0) return null;

    const prices = itemQuotes.map((q) => q.price);
    const minP = Math.min(...prices) * 0.92;
    const maxP = Math.max(...prices) * 1.08;
    const range = maxP - minP || 1;

    const W = 700;
    const H = 220;
    const padding = { top: 20, right: 30, bottom: 40, left: 60 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const points = itemQuotes.map((q, i) => {
      const x = padding.left + (itemQuotes.length === 1 ? chartW / 2 : (i / (itemQuotes.length - 1)) * chartW);
      const y = padding.top + chartH - ((q.price - minP) / range) * chartH;
      return { x, y, price: q.price, month: q.month };
    });

    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    return { W, H, padding, points, path, minP, maxP, range, chartW, chartH, quotes: itemQuotes };
  }, [quotesHistory, selectedProduct]);

  if (role === "SA") {
    return (
      <div style={{ padding: "20px 0" }}>
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <h2>Access Denied</h2>
          <p>You do not have permissions to view supplier profiles.</p>
          <div style={{ marginTop: "20px" }}>
            <Link href="/dashboard" className="button button-primary">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: ".08em" }}>Enterprise ERP · On-Premises</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "4px", color: "#111827" }}>Supplier Profile Details</div>
            <div style={{ fontSize: "11px", color: "#6b7280" }}>Generated {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/dashboard/admin/suppliers" className="button button-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          ← Back to Suppliers
        </Link>
        <button
          type="button"
          onClick={() => typeof window !== "undefined" && window.print()}
          className="button button-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          🖨️ Print Profile
        </button>
      </div>

      {/* Supplier Profile Card */}
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
          <div style={{ width: "54px", height: "54px", borderRadius: "16px", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#fff" }}>
            🏭
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "#3b82f6", marginBottom: "4px" }}>
              Supplier Profile
            </div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>{supplier.fame_name || supplier.name}</h1>
            {supplier.fame_name && supplier.fame_name !== supplier.name && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{supplier.name}</div>
            )}
            {supplier.contact_person && (
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                👤 {supplier.contact_person} {supplier.contact_job_title ? `(${supplier.contact_job_title})` : ""} · 📞 {supplier.phone}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span className="badge badge-strong" style={{ fontSize: "12px", padding: "4px 10px" }}>{totalQuotes} quotes</span>
          <span className="badge" style={{ fontSize: "12px", padding: "4px 10px" }}>{itemStats.length} items</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>Avg vs Market</div>
          <strong style={{ fontSize: "24px", color: avgDev < -1 ? "var(--success)" : avgDev > 1 ? "var(--danger)" : "var(--text-secondary)" }}>
            {avgDev > 0 ? "+" : ""}{avgDev.toFixed(1)}%
          </strong>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {avgDev < -1 ? "Highly competitive" : "Average market rates"}
          </div>
        </div>

        <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>Best-Price Items</div>
          <strong style={{ fontSize: "24px", color: "var(--success)" }}>
            {itemStats.filter(i => i.avgDeviation < 0).length} / {itemStats.length}
          </strong>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Items priced under market average</div>
        </div>

        <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>Contact Email</div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {supplier.email || "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>For official communication</div>
        </div>

        <div style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>Region / Address</div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {supplier.region || "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{supplier.address || "No address provided."}</div>
        </div>
      </div>

      {/* Quote Activity Sparkline */}
      {monthStats.length > 0 && (
        <div className="panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "13px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, margin: "0 0 12px 0" }}>
            📊 Historical Quote Activity
          </h3>
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "40px" }}>
            {[...monthStats].reverse().map((ms) => (
              <div key={ms.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }} title={`${ms.month}: ${ms.count} quotes`}>
                <div style={{ width: "100%", height: `${Math.max(6, (ms.count / maxCount) * 30)}px`, borderRadius: "3px 3px 0 0", background: "var(--primary)" }} />
                <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{formatMonthLabel(ms.month).slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Quote Charts & Quoted Items */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }} className="grid-responsive">
        {/* Left Column: Product Quotes Price Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Chart View */}
          {chartData && (
            <div className="panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  📈 Product Price Trends
                </h3>
                
                {/* Product selector dropdown */}
                {productNames.length > 1 && (
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
                  >
                    {productNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
                <svg width={chartData.W} height={chartData.H} viewBox={`0 0 ${chartData.W} ${chartData.H}`} style={{ display: "block", margin: "0 auto" }}>
                  <line x1={chartData.padding.left} y1={chartData.padding.top + chartData.chartH} x2={chartData.padding.left + chartData.chartW} y2={chartData.padding.top + chartData.chartH} stroke="var(--border-medium)" />
                  <line x1={chartData.padding.left} y1={chartData.padding.top} x2={chartData.padding.left} y2={chartData.padding.top + chartData.chartH} stroke="var(--border-medium)" />

                  {/* Y Axis Gridlines */}
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

                  {/* Main Line */}
                  <path d={chartData.path} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

                  {/* Points */}
                  {chartData.points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-surface)" stroke="#3b82f6" strokeWidth="2" />
                      <text x={p.x} y={chartData.padding.top + chartData.chartH + 18} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                        {formatMonthLabel(p.month).slice(0, 3)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          )}

          {/* Items Quoted Table */}
          <div className="panel" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                📦 Quoted Catalog Items
              </h3>
              <div className="no-print" style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Filter:</span>
                {["all", ...categories].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFilter(cat)}
                    style={{
                      padding: "3px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: "20px",
                      border: `1.5px solid ${catFilter === cat ? "var(--primary)" : "var(--border)"}`,
                      background: catFilter === cat ? "var(--primary-light)" : "var(--bg-elevated)",
                      color: catFilter === cat ? "var(--primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 150ms"
                    }}
                  >
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}>Item Name</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>Latest Price</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>Avg Price</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>vs Market</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const devColor = item.avgDeviation < -1 ? "var(--success)" : item.avgDeviation > 1 ? "var(--danger)" : "var(--text-muted)";
                    return (
                      <tr key={item.itemId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.itemName}</div>
                          <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                            {item.categoryName} · {item.unit} · {item.quoteCount} quotes
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatCurrency(item.latestPrice)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                          {formatCurrency(item.avg)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: devColor }}>
                          {item.avgDeviation > 0 ? "+" : ""}
                          {item.avgDeviation.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Profile Summary Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="panel" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 16px 0", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              📋 Profile Details
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Supplier Code</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                  {supplier.code || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Represented Catalog Products</div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                  {supplier.represented_products || "No product classes listed."}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
