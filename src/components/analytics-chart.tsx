"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/format";

type DataPoint = {
  month: string;
  price: number;
  supplier_name: string;
  item_name: string;
  recorded_at: string;
};

type AnalyticsChartProps = {
  history: DataPoint[];
  months: string[]; // Selected months in chronological order
  groupMode: "supplier" | "item"; // Whether lines are grouped by supplier or by item
};

export default function AnalyticsChart({ history, months, groupMode }: AnalyticsChartProps) {
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [hoveredDot, setHoveredDot] = useState<{
    x: number;
    y: number;
    price: number;
    month: string;
    label: string; // supplier or item name
    recordedAt?: string;
  } | null>(null);

  const [showMinGuide, setShowMinGuide] = useState(false);
  const [showMaxGuide, setShowMaxGuide] = useState(false);
  const [showAvgGuide, setShowAvgGuide] = useState(false);

  // Group names present in history
  const allGroups = Array.from(
    new Set(history.map((h) => (groupMode === "supplier" ? h.supplier_name : h.item_name)))
  ).sort();

  // Sync active groups on history update
  useEffect(() => {
    setActiveGroups(allGroups);
  }, [history, groupMode]);

  if (history.length === 0) {
    return (
      <div
        className="summary-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "280px",
          color: "var(--text-muted)",
          fontSize: "14px",
          border: "1.5px dashed var(--border-medium)"
        }}
      >
        No historical price trend data found for the selected filters.
      </div>
    );
  }

  // Group data by supplier or item, then by month
  // If grouping by supplier: we get the latest price for that supplier in that month
  // If grouping by item: we get the average price of that item in that month (from active suppliers)
  const groupLines: Record<string, Array<{ month: string; price: number; recorded_at?: string }>> = {};

  allGroups.forEach((groupName) => {
    if (!activeGroups.includes(groupName)) return;

    groupLines[groupName] = [];

    months.forEach((month) => {
      const records = history.filter((h) => {
        const matchesGroup = groupMode === "supplier" ? h.supplier_name === groupName : h.item_name === groupName;
        return matchesGroup && h.month === month;
      });

      if (records.length > 0) {
        if (groupMode === "supplier") {
          // Get latest price entry for this supplier in this month (revisions)
          const sorted = [...records].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
          groupLines[groupName].push({
            month,
            price: sorted[0].price,
            recorded_at: sorted[0].recorded_at
          });
        } else {
          // Average price of the item in this month
          const sum = records.reduce((acc, r) => acc + r.price, 0);
          groupLines[groupName].push({
            month,
            price: sum / records.length
          });
        }
      }
    });
  });

  // Calculate pricing bounds for scaling Y axis
  const allPrices = Object.values(groupLines)
    .flatMap((line) => line.map((p) => p.price))
    .filter((p) => typeof p === "number" && !Number.isNaN(p));

  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 10;
  const priceRange = maxPrice - minPrice;

  // Add Y padding
  const yPad = priceRange === 0 ? 5 : priceRange * 0.2;
  const yMin = Math.max(0, minPrice - yPad);
  const yMax = maxPrice + yPad;
  const yRange = yMax - yMin;

  // SVG dimensions
  const width = 800;
  const height = 300;
  const paddingLeft = 65;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Function to get colors for different lines
  const getLineColor = (index: number, name: string) => {
    if (name.includes("Atlas")) return "#3b82f6"; // Blue
    if (name.includes("Nile")) return "#ef4444"; // Red
    if (name.includes("Prime")) return "#10b981"; // Emerald
    if (name.includes("Blue")) return "#f59e0b"; // Amber

    // Rainbow fallbacks
    const colors = ["#6366f1", "#06b6d4", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b"];
    return colors[index % colors.length];
  };

  // Convert (month, price) to SVG (x, y)
  const getCoordinates = (month: string, price: number) => {
    const mIndex = months.indexOf(month);
    const x =
      months.length <= 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (mIndex / (months.length - 1)) * chartWidth;

    const ratio = yRange === 0 ? 0.5 : (price - yMin) / yRange;
    const y = paddingTop + chartHeight - ratio * chartHeight;

    return { x, y };
  };

  // Calculate benchmarks
  const currentMin = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const currentMax = allPrices.length > 0 ? Math.max(...allPrices) : 0;
  const currentAvg = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;

  return (
    <div className="panel" style={{ padding: "28px", position: "relative" }}>
      <div className="panel-header" style={{ marginBottom: "20px" }}>
        <div>
          <p className="eyebrow">Interactive Trend Lines</p>
          <h2>{groupMode === "supplier" ? "Supplier Price Trends" : "Product Price Trends"}</h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "4px" }}>
            Visualizing price movements chronologically across {months.length} months. Hover over dots for precise rates and metadata.
          </p>
        </div>
        <span className="badge badge-strong">{allPrices.length} data points</span>
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
                  x={paddingLeft - 10}
                  y={y + 4}
                  fill="var(--text-muted)"
                  fontSize="11px"
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
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 20}
                  fill="var(--text-secondary)"
                  fontSize="11.5px"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {m}
                </text>
              </g>
            );
          })}

          {/* Guide lines */}
          {showMinGuide && allPrices.length > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight - ((currentMin - yMin) / yRange) * chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight - ((currentMin - yMin) / yRange) * chartHeight}
                stroke="var(--danger)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text
                x={width - paddingRight - 6}
                y={paddingTop + chartHeight - ((currentMin - yMin) / yRange) * chartHeight - 5}
                fill="var(--danger)"
                fontSize="10px"
                fontWeight="700"
                textAnchor="end"
              >
                Min: {formatCurrency(currentMin)}
              </text>
            </g>
          )}

          {showAvgGuide && allPrices.length > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight - ((currentAvg - yMin) / yRange) * chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight - ((currentAvg - yMin) / yRange) * chartHeight}
                stroke="var(--primary)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text
                x={width - paddingRight - 6}
                y={paddingTop + chartHeight - ((currentAvg - yMin) / yRange) * chartHeight - 5}
                fill="var(--indigo-600)"
                fontSize="10px"
                fontWeight="700"
                textAnchor="end"
              >
                Avg: {formatCurrency(currentAvg)}
              </text>
            </g>
          )}

          {showMaxGuide && allPrices.length > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight - ((currentMax - yMin) / yRange) * chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight - ((currentMax - yMin) / yRange) * chartHeight}
                stroke="var(--success)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text
                x={width - paddingRight - 6}
                y={paddingTop + chartHeight - ((currentMax - yMin) / yRange) * chartHeight - 5}
                fill="var(--success-color)"
                fontSize="10px"
                fontWeight="700"
                textAnchor="end"
              >
                Max: {formatCurrency(currentMax)}
              </text>
            </g>
          )}

          {/* Render lines and dots */}
          {Object.entries(groupLines).map(([groupName, points], groupIndex) => {
            const color = getLineColor(groupIndex, groupName);

            // Sort points by month chronologically to ensure lines are drawn left-to-right
            const sortedPoints = [...points].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

            // Generate Path D
            let pathD = "";
            sortedPoints.forEach((pt, idx) => {
              const { x, y } = getCoordinates(pt.month, pt.price);
              if (idx === 0) {
                pathD = `M ${x} ${y}`;
              } else {
                pathD += ` L ${x} ${y}`;
              }
            });

            return (
              <g key={groupName}>
                {/* Line Path */}
                {sortedPoints.length > 1 && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      filter: `drop-shadow(0px 2px 8px ${color}33)`
                    }}
                  />
                )}

                {/* Dots */}
                {sortedPoints.map((pt, idx) => {
                  const { x, y } = getCoordinates(pt.month, pt.price);
                  return (
                    <g key={idx}>
                      <circle
                        cx={x}
                        cy={y}
                        r={5.5}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={2}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() =>
                          setHoveredDot({
                            x,
                            y,
                            price: pt.price,
                            month: pt.month,
                            label: groupName,
                            recordedAt: pt.recorded_at
                          })
                        }
                        onMouseLeave={() => setHoveredDot(null)}
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={9}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.2}
                        opacity={0.3}
                        style={{ pointerEvents: "none" }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Chart Tooltip */}
        {hoveredDot && (
          <div
            className="chart-tooltip animate-fade-in"
            style={{
              position: "absolute",
              left: `calc(${(hoveredDot.x / width) * 100}% - 90px)`,
              top: `calc(${(hoveredDot.y / height) * 100}% - 105px)`,
              pointerEvents: "none",
              zIndex: 10
            }}
          >
            <strong style={{ fontSize: "13.5px", color: "var(--indigo-600)", display: "block" }}>
              {formatCurrency(hoveredDot.price)}
            </strong>
            <span style={{ fontSize: "11px", fontWeight: "700", display: "block" }}>{hoveredDot.label}</span>
            <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
              {hoveredDot.month}
              {hoveredDot.recordedAt ? ` · ${new Date(hoveredDot.recordedAt).toLocaleDateString()}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Legends & Checkboxes */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          marginTop: "20px",
          borderTop: "1px solid var(--border-light)",
          paddingTop: "18px"
        }}
      >
        {/* Toggle checkboxes */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Toggle {groupMode === "supplier" ? "Vendors" : "Products"}:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {allGroups.map((name, index) => {
              const color = getLineColor(index, name);
              const checked = activeGroups.includes(name);

              return (
                <label
                  key={name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setActiveGroups([...activeGroups, name]);
                      } else {
                        setActiveGroups(activeGroups.filter((g) => g !== name));
                      }
                    }}
                  />
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: color
                    }}
                  />
                  <span style={{ opacity: checked ? 1 : 0.6 }}>{name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Guide lines toggles */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Guides:
          </span>
          <div style={{ display: "flex", gap: "16px" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }}>
              <input type="checkbox" checked={showMinGuide} onChange={(e) => setShowMinGuide(e.target.checked)} />
              Show Min Price
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }}>
              <input type="checkbox" checked={showAvgGuide} onChange={(e) => setShowAvgGuide(e.target.checked)} />
              Show Average Price
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }}>
              <input type="checkbox" checked={showMaxGuide} onChange={(e) => setShowMaxGuide(e.target.checked)} />
              Show Max Price
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
