"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/format";

type HistoryRecord = {
  month: string;
  price: number;
  recorded_at: string;
  supplier_name: string;
};

type PriceTrendChartProps = {
  history: HistoryRecord[];
  itemName: string;
};

export default function PriceTrendChart({ history, itemName }: PriceTrendChartProps) {
  const [activeSuppliers, setActiveSuppliers] = useState<string[]>([]);
  const [hoveredDot, setHoveredDot] = useState<{
    x: number;
    y: number;
    price: number;
    month: string;
    supplier: string;
    recordedAt: string;
  } | null>(null);

  const [showMinGuide, setShowMinGuide] = useState(false);
  const [showMaxGuide, setShowMaxGuide] = useState(false);
  const [showAvgGuide, setShowAvgGuide] = useState(false);

  // Sync active suppliers on history update
  useEffect(() => {
    if (history && history.length > 0) {
      const suppliers = Array.from(new Set(history.map((h) => h.supplier_name)));
      setActiveSuppliers(suppliers);
    }
  }, [history]);

  if (!history || history.length === 0) {
    return (
      <div
        className="summary-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "200px",
          color: "var(--text-muted)",
          fontSize: "13px",
          border: "1px dashed var(--border-light)"
        }}
      >
        No historical price trend data found for this item yet.
      </div>
    );
  }

  // Filter history based on active toggles
  const filteredHistory = history.filter((h) => activeSuppliers.includes(h.supplier_name));

  // Reverse history so it flows chronologically (oldest to newest)
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (a.month !== b.month) {
      return a.month.localeCompare(b.month);
    }
    return a.recorded_at.localeCompare(b.recorded_at);
  });

  // Calculate unique months represented
  const months = Array.from(new Set(history.map((h) => h.month))).sort();

  // Calculate the average price per month to draw the macro trend line
  const monthlyAverages = months.map((m) => {
    const records = sortedHistory.filter((h) => h.month === m);
    if (records.length === 0) return { month: m, avgPrice: 0 };
    const sum = records.reduce((acc, curr) => acc + curr.price, 0);
    return {
      month: m,
      avgPrice: sum / records.length
    };
  }).filter(avg => avg.avgPrice > 0);

  // Scale calculations for Y-axis (based on full history so scale is consistent)
  const prices = history.map((h) => h.price);
  const maxPrice = Math.max(...prices, 10);
  const minPrice = Math.min(...prices, 0);
  const priceRange = maxPrice - minPrice;
  
  // Pad Y-axis bounds slightly for visual breathing room
  const yPad = priceRange === 0 ? 5 : priceRange * 0.25;
  const yMin = Math.max(0, minPrice - yPad);
  const yMax = maxPrice + yPad;
  const yRange = yMax - yMin;

  // SVG dimensions
  const width = 600;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Map monthly average data points to SVG coordinates
  const points = monthlyAverages.map((avg, index) => {
    const mIndex = months.indexOf(avg.month);
    const x =
      months.length <= 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (mIndex / (months.length - 1)) * chartWidth;
    
    const ratio = yRange === 0 ? 0.5 : (avg.avgPrice - yMin) / yRange;
    const y = paddingTop + chartHeight - ratio * chartHeight;

    return { x, y, ...avg };
  });

  // Generate SVG path string for the average line
  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  }

  // Map individual quotes for supplier dots
  const quoteDots = sortedHistory.map((h) => {
    const mIndex = months.indexOf(h.month);
    const x =
      months.length <= 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (mIndex / (months.length - 1)) * chartWidth;

    const ratio = yRange === 0 ? 0.5 : (h.price - yMin) / yRange;
    const y = paddingTop + chartHeight - ratio * chartHeight;

    // Pick distinct supplier colors
    let dotColor = "var(--primary)";
    if (h.supplier_name.includes("Atlas")) dotColor = "#3b82f6"; // Blue
    else if (h.supplier_name.includes("Nile")) dotColor = "#ef4444"; // Red
    else if (h.supplier_name.includes("Prime")) dotColor = "#10b981"; // Emerald
    else if (h.supplier_name.includes("Blue")) dotColor = "#f59e0b"; // Amber

    return { x, y, color: dotColor, ...h };
  });

  // Calculate references if they exist
  const currentPrices = sortedHistory.map((h) => h.price);
  const currentMin = currentPrices.length > 0 ? Math.min(...currentPrices) : 0;
  const currentMax = currentPrices.length > 0 ? Math.max(...currentPrices) : 0;
  const currentAvg = currentPrices.length > 0 ? currentPrices.reduce((a,b)=>a+b,0) / currentPrices.length : 0;

  return (
    <div className="panel" style={{ padding: "24px", position: "relative" }}>
      <div className="panel-header" style={{ marginBottom: "16px" }}>
        <div>
          <p className="eyebrow">Visual dashboard</p>
          <h2>Price Trends over Time</h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Connecting average monthly prices (line) alongside individual supplier quotes (dots) for {itemName}. Hover over dots for details.
          </p>
        </div>
        <span className="badge badge-strong">{sortedHistory.length} quotes shown</span>
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
          {/* Horizontal Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + chartHeight - ratio * chartHeight;
            const gridVal = yMin + ratio * yRange;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--border-light)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="var(--text-muted)"
                  fontSize="10px"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {formatCurrency(gridVal)}
                </text>
              </g>
            );
          })}

          {/* X Axis Month Labels */}
          {months.map((m, idx) => {
            const x =
              months.length <= 1
                ? paddingLeft + chartWidth / 2
                : paddingLeft + (idx / (months.length - 1)) * chartWidth;
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={paddingTop + chartHeight}
                  stroke="var(--border-light)"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 18}
                  fill="var(--text-secondary)"
                  fontSize="11px"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {m}
                </text>
              </g>
            );
          })}

          {/* Strategy Guides */}
          {showMinGuide && currentPrices.length > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight - ((currentMin - yMin) / yRange) * chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight - ((currentMin - yMin) / yRange) * chartHeight}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text
                x={width - paddingRight - 4}
                y={paddingTop + chartHeight - ((currentMin - yMin) / yRange) * chartHeight - 4}
                fill="#fca5a5"
                fontSize="9px"
                fontWeight="700"
                textAnchor="end"
              >
                Min: {formatCurrency(currentMin)}
              </text>
            </g>
          )}

          {showAvgGuide && currentPrices.length > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight - ((currentAvg - yMin) / yRange) * chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight - ((currentAvg - yMin) / yRange) * chartHeight}
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text
                x={width - paddingRight - 4}
                y={paddingTop + chartHeight - ((currentAvg - yMin) / yRange) * chartHeight - 4}
                fill="#a5b4fc"
                fontSize="9px"
                fontWeight="700"
                textAnchor="end"
              >
                Avg: {formatCurrency(currentAvg)}
              </text>
            </g>
          )}

          {showMaxGuide && currentPrices.length > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight - ((currentMax - yMin) / yRange) * chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight - ((currentMax - yMin) / yRange) * chartHeight}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text
                x={width - paddingRight - 4}
                y={paddingTop + chartHeight - ((currentMax - yMin) / yRange) * chartHeight - 4}
                fill="#34d399"
                fontSize="9px"
                fontWeight="700"
                textAnchor="end"
              >
                Max: {formatCurrency(currentMax)}
              </text>
            </g>
          )}

          {/* Average Trend Area Fill (Gradient) */}
          {points.length > 1 && (
            <path
              d={
                `M ${points[0].x} ${paddingTop + chartHeight} ` +
                points.map((p) => `L ${p.x} ${p.y}`).join(" ") +
                ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} Z`
              }
              fill="url(#trend-gradient)"
              opacity={0.06}
            />
          )}

          {/* Average Trend Line */}
          {points.length > 0 && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0px 2px 4px rgba(99, 102, 241, 0.15))" }}
            />
          )}

          {/* Supplier Price Dots */}
          {quoteDots.map((dot, idx) => (
            <g key={idx}>
              <circle
                cx={dot.x}
                cy={dot.y}
                r={6}
                fill={dot.color}
                stroke="#111827"
                strokeWidth={2.5}
                style={{ cursor: "pointer" }}
                onMouseEnter={() =>
                  setHoveredDot({
                    x: dot.x,
                    y: dot.y,
                    price: dot.price,
                    month: dot.month,
                    supplier: dot.supplier_name,
                    recordedAt: dot.recorded_at
                  })
                }
                onMouseLeave={() => setHoveredDot(null)}
              />
              <circle
                cx={dot.x}
                cy={dot.y}
                r={10}
                fill="none"
                stroke={dot.color}
                strokeWidth={1}
                opacity={0.25}
                style={{ pointerEvents: "none" }}
              />
            </g>
          ))}

          {/* Gradients and Filters Definition */}
          <defs>
            <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredDot && (
          <div
            className="chart-tooltip animate-fade-in"
            style={{
              left: `calc(${(hoveredDot.x / width) * 100}% - 90px)`,
              top: `calc(${(hoveredDot.y / height) * 100}% - 105px)`
            }}
          >
            <strong style={{ fontSize: "13px", color: "var(--primary)" }}>
              {formatCurrency(hoveredDot.price)}
            </strong>
            <span style={{ fontSize: "11px", fontWeight: "700" }}>{hoveredDot.supplier}</span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {hoveredDot.month} · {new Date(hoveredDot.recordedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Supplier Legend & Interactive Detail controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px", borderTop: "1px solid var(--border-light)", paddingTop: "16px" }}>
        {/* Checkbox Toggles */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Filter Vendors:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {Array.from(new Set(history.map((h) => h.supplier_name))).map((supplierName) => {
              let color = "var(--primary)";
              if (supplierName.includes("Atlas")) color = "#3b82f6";
              else if (supplierName.includes("Nile")) color = "#ef4444";
              else if (supplierName.includes("Prime")) color = "#10b981";
              else if (supplierName.includes("Blue")) color = "#f59e0b";

              return (
                <label key={supplierName} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={activeSuppliers.includes(supplierName)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setActiveSuppliers([...activeSuppliers, supplierName]);
                      } else {
                        setActiveSuppliers(activeSuppliers.filter((s) => s !== supplierName));
                      }
                    }}
                  />
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                  {supplierName}
                </label>
              );
            })}
          </div>
        </div>

        {/* Reference Guides Toggles */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Guides:
          </span>
          <div style={{ display: "flex", gap: "16px" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showMinGuide}
                onChange={(e) => setShowMinGuide(e.target.checked)}
              />
              Show Min Quote
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showAvgGuide}
                onChange={(e) => setShowAvgGuide(e.target.checked)}
              />
              Show Average
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showMaxGuide}
                onChange={(e) => setShowMaxGuide(e.target.checked)}
              />
              Show Max Quote
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
