"use client";

import { formatCurrency, formatMonthLabel } from "@/lib/format";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-context";

// ── Types ──────────────────────────────────────────────────────────────────
type Insight = { icon: string; label: string; text: string };
type MonthlyStat = { month: string; count: number; min: number | null; max: number | null; avg: number | null };
type SupplierAvg = { id: number; name: string; avgPrice: number; avgDeviation: number; participationRate: number; quotesCount: number };
type ItemStat = { itemId: number; itemName: string; unit: string; quotesCount: number; min: number; avg: number; max: number; spreadPct: number; volatility: string };

export type AnalyticsDashboardProps = {
  viewMode: string;
  selectedItemName?: string;
  avgPrice: number; minPrice: number; maxPrice: number; stdDev: number;
  fluctuationPct: number; totalQuotes: number;
  volatilityLevel: string; volatilityAccent: string; activeVolatility: number;
  strategyTitle: string; strategyMarkup: string; strategyBadgeClass: string;
  insights: Insight[];
  momWithData: MonthlyStat[];
  momMax: number; momMin: number; momRange: number;
  supplierAverages: SupplierAvg[];
  maxAbsDev: number;
  itemsStats: ItemStat[];
  mostVolatileItemId?: number;
  mostStableItemId?: number;
  dashboardHref: string;
  chart?: React.ReactNode;
};

// ── Constants ──────────────────────────────────────────────────────────────
const SUP_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];
const RANK_MEDALS = ["🥇","🥈","🥉"];

// ── Sub-components ─────────────────────────────────────────────────────────
function KpiChip({
  icon, label, value, note, clarification, color, bg, border, progress,
}: {
  icon: string; label: string; value: string; note: string; clarification: string;
  color: string; bg: string; border: string; progress?: number;
}) {
  const { isRTL } = useI18n();
  return (
    <div style={{
      padding: "16px 18px", borderRadius: "14px",
      background: bg, border: `1.5px solid ${border}`,
      display: "flex", flexDirection: "column", gap: "4px",
      transition: "transform 150ms, box-shadow 150ms",
      textAlign: isRTL ? "right" : "left",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${color}30`; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "15px", lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.08em", color }}>{label}</span>
      </div>
      <div style={{ fontSize: "22px", fontWeight: 900, color, lineHeight: 1, marginTop: "2px" }}>{value}</div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{note}</div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic" as const }}>{clarification}</div>
      {progress !== undefined && (
        <div style={{ height: "3px", borderRadius: "99px", background: "var(--bg-subtle)", overflow: "hidden", marginTop: "4px" }}>
          <div style={{ height: "100%", width: `${Math.min(100, progress)}%`, borderRadius: "99px", background: color, transition: "width 0.9s ease" }} />
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AnalyticsDashboard({
  viewMode, selectedItemName,
  avgPrice, minPrice, maxPrice, stdDev, fluctuationPct, totalQuotes,
  volatilityLevel, volatilityAccent, activeVolatility,
  strategyTitle, strategyMarkup, strategyBadgeClass,
  insights, momWithData, momMax, momMin, momRange,
  supplierAverages, maxAbsDev,
  itemsStats, mostVolatileItemId, mostStableItemId,
  dashboardHref,
  chart,
}: AnalyticsDashboardProps) {
  const { t, isRTL } = useI18n();

  const volColor = activeVolatility > 15 ? "#ef4444" : activeVolatility > 5 ? "#f59e0b" : "#10b981";
  const volGaugePct = Math.min(100, activeVolatility * 4);

  const displayVolLevel = volatilityLevel === "Stable" ? t("an.volStable") : volatilityLevel === "Moderate" ? t("an.volModerate") : volatilityLevel === "Volatile" ? t("an.volVolatile") : volatilityLevel;

  // ── KPI strip data ──
  const kpis = [
    {
      icon: "📊", label: viewMode === "single" ? t("an.avgMarketPrice") : t("an.catAvgPrice"),
      value: totalQuotes > 0 ? formatCurrency(avgPrice) : "—",
      note: t("an.quotesCaptured").replace("{count}", String(totalQuotes)),
      clarification: t("an.meanBuyingPrice"),
      color: "#6366f1", bg: "rgba(99,102,241,0.07)", border: "rgba(99,102,241,0.2)",
    },
    {
      icon: "📉", label: t("an.priceSpread"),
      value: minPrice > 0 ? (isRTL ? `${formatCurrency(maxPrice)} ← ${formatCurrency(minPrice)}` : `${formatCurrency(minPrice)} → ${formatCurrency(maxPrice)}`) : "—",
      note: t("an.lowestVsHighest"),
      clarification: t("an.bestVsWorst"),
      color: "#0891b2", bg: "rgba(6,182,212,0.07)", border: "rgba(6,182,212,0.2)",
    },
    {
      icon: "🌊", label: t("an.marketVolatility"),
      value: totalQuotes > 0 ? `${fluctuationPct.toFixed(1)}%` : "—",
      note: t("an.riskLevel").replace("{level}", displayVolLevel),
      clarification: t("an.fluctuateDesc"),
      color: activeVolatility > 15 ? "#ef4444" : activeVolatility > 5 ? "#f59e0b" : "#10b981",
      bg: activeVolatility > 15 ? "rgba(239,68,68,0.07)" : activeVolatility > 5 ? "rgba(245,158,11,0.07)" : "rgba(16,185,129,0.07)",
      border: activeVolatility > 15 ? "rgba(239,68,68,0.2)" : activeVolatility > 5 ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)",
      progress: volGaugePct,
    },
    {
      icon: "📐", label: t("an.stdDev"),
      value: totalQuotes > 0 ? `± ${formatCurrency(stdDev)}` : "—",
      note: viewMode === "single" ? t("an.stdDevConsistency") : t("an.stdDevAcrossItems"),
      clarification: t("an.stdDevDesc"),
      color: "#8b5cf6", bg: "rgba(139,92,246,0.07)", border: "rgba(139,92,246,0.2)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── 1. KPI Strip ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {kpis.map(k => (
          <KpiChip key={k.label} {...k} />
        ))}
      </div>

      {/* ── 2. Primary Trend Chart ───────────────────────────────────────── */}
      {chart}

      {/* ── 3. Two-Column Dashboard Layout ───────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: "20px",
        alignItems: "start",
        width: "100%"
      }}>

        {/* Left Column: Data Breakdowns (MoM, Scorecard, Category Matrix) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
          
          {/* Month-over-Month breakdown */}
          <div style={{ padding: "20px", borderRadius: "16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: isRTL ? "right" : "left" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px", flexDirection: isRTL ? "row-reverse" : "row" }}>
              <div>
                <p style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 4px" }}>{t("an.momTitle")}</p>
                <h2 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 3px" }}>{t("an.priceBreakdown")}</h2>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                  {t("an.momDesc")}
                </p>
              </div>
              <span style={{ fontSize: "10px", fontWeight: 700, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "99px", padding: "2px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {t("an.monthsCount").replace("{count}", String(momWithData.length))}
              </span>
            </div>
            {momWithData.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>{t("an.noDataInRange")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {momWithData.map((ms) => {
                  const avgBarW = ms.avg ? Math.max(4, ((ms.avg - momMin) / momRange) * 100) : 0;
                  return (
                    <div key={ms.month} style={{
                      padding: "11px 13px", borderRadius: "10px",
                      background: "var(--bg-surface)", border: "1px solid var(--border-light)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <span style={{ fontSize: "12px", fontWeight: 800 }}>{formatMonthLabel(ms.month)}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "1px 6px", borderRadius: "4px" }}>
                          {t("an.quotesCount").replace("{count}", String(ms.count))}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <span style={{ width: "26px", fontSize: "9.5px", color: "var(--text-muted)", flexShrink: 0, fontWeight: 600 }}>{t("an.avg")}</span>
                        <div style={{ flex: 1, height: "7px", borderRadius: "4px", background: "var(--bg-subtle)", overflow: "hidden" }}>
                          <div style={{ width: `${avgBarW}%`, height: "100%", borderRadius: "4px", background: "var(--primary)", transition: "width 400ms", marginInlineStart: isRTL ? "auto" : "0" }} />
                        </div>
                        <span style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--primary)", minWidth: "52px", textAlign: isRTL ? "left" : "right" }}>{formatCurrency(ms.avg)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", paddingLeft: isRTL ? "0" : "34px", paddingRight: isRTL ? "34px" : "0", flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <span style={{ color: "var(--success)", fontWeight: 600 }}>↓ {formatCurrency(ms.min)}</span>
                        <span style={{ color: "var(--danger)", fontWeight: 600 }}>↑ {formatCurrency(ms.max)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Supplier Scorecard */}
          <div style={{ padding: "20px 24px", borderRadius: "16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: isRTL ? "right" : "left" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "16px", flexDirection: isRTL ? "row-reverse" : "row" }}>
              <div>
                <p style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 4px" }}>{t("an.competitiveness")}</p>
                <h2 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 3px" }}>{t("an.supplierScorecard")}</h2>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                  {t("an.scorecardDesc")}
                </p>
              </div>
              <span style={{ fontSize: "10px", fontWeight: 700, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "99px", padding: "3px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {t("an.suppliersCount").replace("{count}", String(supplierAverages.length))}
              </span>
            </div>

            {supplierAverages.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px 0", fontSize: "13px" }}>{t("an.noSupplierData")}</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "12px" }}>
                {supplierAverages.map((sup, idx) => {
                  const color = SUP_COLORS[idx % SUP_COLORS.length];
                  const isLeader = idx === 0;
                  const devPct = Math.min(100, (Math.abs(sup.avgDeviation) / maxAbsDev) * 100);
                  const devColor = sup.avgDeviation < 0 ? "#10b981" : "#ef4444";
                  const devBg   = sup.avgDeviation < 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)";
                  const medal   = RANK_MEDALS[idx] || null;
                  return (
                    <div key={sup.id} style={{
                      padding: "16px", borderRadius: "14px",
                      background: isLeader ? `${color}10` : "var(--bg-surface)",
                      border: `${isLeader ? "2px" : "1px"} solid ${isLeader ? `${color}40` : "var(--border-light)"}`,
                      boxShadow: isLeader ? `0 4px 16px ${color}20` : "none",
                      display: "flex", flexDirection: "column", gap: "10px",
                      position: "relative",
                      transition: "transform 150ms, box-shadow 150ms",
                      textAlign: isRTL ? "right" : "left",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${color}25`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = isLeader ? `0 4px 16px ${color}20` : "none"; }}
                    >
                      {isLeader && (
                        <span style={{
                          position: "absolute", top: "10px", right: isRTL ? "auto" : "10px", left: isRTL ? "10px" : "auto",
                          fontSize: "9px", fontWeight: 900,
                          background: `linear-gradient(135deg,${color},${color}cc)`,
                          color: "#fff", padding: "2px 8px", borderRadius: "99px",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>{t("an.costLeader")}</span>
                      )}

                      {/* Rank + Name */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <span style={{ fontSize: "18px", lineHeight: 1 }}>{medal ?? `#${idx + 1}`}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 800, fontSize: "13px", color: "var(--text-primary)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{sup.name}</div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {t("an.quotesLoggedCount").replace("{count}", String(sup.quotesCount))}
                          </div>
                        </div>
                      </div>

                      {/* Deviation from market avg */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "5px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{t("an.vsMarketAvg")}</span>
                          <span style={{
                            fontWeight: 900, fontSize: "11px",
                            padding: "1px 6px", borderRadius: "4px",
                            background: devBg, color: devColor,
                          }}>{sup.avgDeviation < 0 ? "" : "+"}{sup.avgDeviation.toFixed(1)}%</span>
                        </div>
                        <div style={{ height: "6px", borderRadius: "3px", background: "var(--bg-subtle)", overflow: "hidden" }}>
                          <div style={{ width: `${devPct}%`, height: "100%", borderRadius: "3px", background: devColor, transition: "width 600ms", marginInlineStart: isRTL ? "auto" : "0" }} />
                        </div>
                        <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginTop: "3px", fontStyle: "italic" }}>
                          {sup.avgDeviation < 0 
                            ? t("an.costLeaderDesc") 
                            : sup.avgDeviation > 5 
                            ? t("an.aboveAvgDesc") 
                            : t("an.closeAvgDesc")}
                        </div>
                      </div>

                      {/* Mini stats row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={{ background: "var(--bg-elevated)", borderRadius: "8px", padding: "8px 10px" }}>
                          <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>{t("an.avgPrice")}</div>
                          <div style={{ fontWeight: 900, fontSize: "13px", color }}>
                            {formatCurrency(sup.avgPrice)}
                          </div>
                        </div>
                        <div style={{ background: "var(--bg-elevated)", borderRadius: "8px", padding: "8px 10px" }}>
                          <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>{t("an.coverage")}</div>
                          <div style={{ fontWeight: 900, fontSize: "13px", color: sup.participationRate < 80 ? "var(--warning)" : "var(--success)" }}>
                            {sup.participationRate.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category Matrix (category mode only) */}
          {itemsStats.length > 0 && (
            <div style={{ padding: "20px 24px", borderRadius: "16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: isRTL ? "right" : "left" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "16px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <div>
                  <p style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 4px" }}>{t("an.categoryMatrix")}</p>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 3px" }}>{t("an.productsVolatility")}</h2>
                  <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                    {t("an.matrixDesc")}
                  </p>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "99px", padding: "3px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {t("an.itemsCount").replace("{count}", String(itemsStats.length))}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {itemsStats.map((row) => {
                  const isMostVolatile = mostVolatileItemId !== undefined && row.itemId === mostVolatileItemId;
                  const isMostStable   = mostStableItemId   !== undefined && row.itemId === mostStableItemId;
                  const riskColor = row.spreadPct > 15 ? "#ef4444" : row.spreadPct > 5 ? "#f59e0b" : "#10b981";
                  const riskBg    = row.spreadPct > 15 ? "rgba(239,68,68,0.07)" : row.spreadPct > 5 ? "rgba(245,158,11,0.07)" : "rgba(16,185,129,0.07)";
                  const barW = Math.max(2, Math.min(100, row.spreadPct * 3));
                  
                  const translatedVol = row.volatility === "Stable" ? t("an.volStable") : row.volatility === "Moderate" ? t("an.volModerate") : row.volatility === "Volatile" ? t("an.volVolatile") : row.volatility;

                  return (
                    <div key={row.itemId} style={{
                      display: "grid", gridTemplateColumns: "1fr auto auto auto auto",
                      gap: "12px", alignItems: "center",
                      padding: "12px 16px", borderRadius: "10px",
                      background: isMostVolatile ? "rgba(239,68,68,0.04)" : isMostStable ? "rgba(16,185,129,0.04)" : "var(--bg-surface)",
                      border: `1px solid ${isMostVolatile ? "rgba(239,68,68,0.2)" : isMostStable ? "rgba(16,185,129,0.2)" : "var(--border-light)"}`,
                    }}>
                      <div style={{ textAlign: isRTL ? "right" : "left" }}>
                        <div style={{ fontWeight: 700, fontSize: "13px" }}>{row.itemName}</div>
                        <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <div style={{ height: "5px", borderRadius: "3px", background: "var(--bg-subtle)", overflow: "hidden", width: "80px" }}>
                            <div style={{ width: `${barW}%`, height: "100%", borderRadius: "3px", background: riskColor, transition: "width 0.6s", marginInlineStart: isRTL ? "auto" : "0" }} />
                          </div>
                          <span style={{ fontSize: "9.5px", color: riskColor, fontWeight: 700 }}>
                            {t("an.spreadPct").replace("{pct}", row.spreadPct.toFixed(1))}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: isRTL ? "left" : "right", fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>{row.unit}</div>
                      <div style={{ textAlign: isRTL ? "left" : "right" }}>
                        <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("an.minMax")}</div>
                        <div style={{ fontSize: "12px", fontWeight: 700 }}>
                          <span style={{ color: "var(--success)" }}>{formatCurrency(row.min)}</span>
                          <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>{isRTL ? "←" : "→"}</span>
                          <span style={{ color: "var(--danger)" }}>{formatCurrency(row.max)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: isRTL ? "left" : "right" }}>
                        <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>{t("an.avg")}</div>
                        <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--primary)" }}>{formatCurrency(row.avg)}</div>
                      </div>
                      <div style={{ textAlign: isRTL ? "left" : "right" }}>
                        {isMostVolatile ? (
                          <span style={{ fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "99px", background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", whiteSpace: "nowrap" }}>{t("an.mostVolatile")}</span>
                        ) : isMostStable ? (
                          <span style={{ fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "99px", background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", whiteSpace: "nowrap" }}>{t("an.mostStable")}</span>
                        ) : (
                          <span style={{ fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "99px", background: riskBg, color: riskColor, border: `1px solid ${riskColor}30`, whiteSpace: "nowrap" }}>{translatedVol}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Insights & Strategy */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
          
          {/* Strategy Advisor */}
          <div style={{ padding: "20px", borderRadius: "16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: isRTL ? "right" : "left" }}>
            <div style={{ marginBottom: "14px" }}>
              <p style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 4px" }}>{t("an.markupAdvisor")}</p>
              <h2 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 3px" }}>{t("an.pricingStrategy")}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                {t("an.suggestedRange")}
              </p>
            </div>

            {/* Volatility Gauge */}
            <div style={{
              padding: "14px", borderRadius: "12px", marginBottom: "10px",
              background: `${volColor}0f`, border: `1.5px solid ${volColor}30`,
              textAlign: isRTL ? "right" : "left",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>{t("an.volatilityGauge")}</span>
                <span style={{ fontSize: "12px", fontWeight: 900, color: volColor }}>
                  {activeVolatility.toFixed(1)}% — {displayVolLevel}
                </span>
              </div>
              <div style={{ height: "10px", borderRadius: "5px", background: "var(--bg-subtle)", overflow: "hidden", position: "relative" }}>
                <div style={{
                  position: "absolute", top: 0, [isRTL ? "right" : "left"]: 0, height: "100%",
                  width: `${volGaugePct}%`, borderRadius: "5px",
                  background: `linear-gradient(${isRTL ? "270deg" : "90deg"}, #10b981, ${volColor})`,
                  transition: "width 800ms cubic-bezier(0.4,0,0.2,1)",
                } as any} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "var(--text-muted)", marginTop: "4px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <span>{t("an.volStable")}</span><span>{t("an.volModerate")}</span><span>{t("an.volVolatile")}</span>
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "12px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", marginBottom: "10px" }}>
              <div style={{ fontWeight: 800, fontSize: "13px", marginBottom: "6px" }}>{strategyTitle}</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t("an.suggestedMarkup")}</span>
                <span style={{
                  fontSize: "11px", fontWeight: 800, padding: "2px 10px", borderRadius: "99px",
                  background: strategyBadgeClass === "badge-success" ? "rgba(16,185,129,0.15)" : strategyBadgeClass === "badge-warning" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                  color: strategyBadgeClass === "badge-success" ? "var(--success)" : strategyBadgeClass === "badge-warning" ? "var(--warning)" : "var(--danger)",
                }}>{strategyMarkup}</span>
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                {activeVolatility > 15
                  ? t("an.volHighDesc")
                  : activeVolatility > 5
                  ? t("an.volModDesc")
                  : t("an.volStableDesc")}
              </p>
            </div>

            <Link href={dashboardHref} style={{
              display: "block", textAlign: "center",
              padding: "10px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
              background: "linear-gradient(135deg,#4f46e5,#6366f1)",
              color: "#fff", textDecoration: "none",
              boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
              transition: "box-shadow 150ms, transform 150ms",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 16px rgba(99,102,241,0.4)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px rgba(99,102,241,0.3)"; }}
            >
              {t("an.priceItemDashboard")}
            </Link>
          </div>

          {/* Market Insights */}
          <div style={{ padding: "20px", borderRadius: "16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: isRTL ? "right" : "left" }}>
            <div style={{ marginBottom: "14px" }}>
              <p style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 4px" }}>{t("an.autoGenerated")}</p>
              <h2 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 3px" }}>{t("an.marketInsights")}</h2>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                {t("an.signalsFilter")}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {insights.map((ins, idx) => {
                const insColors = ["rgba(99,102,241,0.08)","rgba(16,185,129,0.08)","rgba(245,158,11,0.08)"];
                const insBorders = ["rgba(99,102,241,0.2)","rgba(16,185,129,0.2)","rgba(245,158,11,0.2)"];
                const insLeftBorders = ["#6366f1","#10b981","#f59e0b"];
                return (
                  <div key={idx} style={{
                    display: "flex", gap: "10px", alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: "10px",
                    background: insColors[idx % insColors.length],
                    border: `1px solid ${insBorders[idx % insBorders.length]}`,
                    borderInlineStart: `3px solid ${insLeftBorders[idx % insLeftBorders.length]}`,
                    flexDirection: isRTL ? "row-reverse" : "row",
                    textAlign: isRTL ? "right" : "left",
                  }}>
                    <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0, marginTop: "1px" }}>{ins.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "9.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: insLeftBorders[idx % insLeftBorders.length], marginBottom: "3px" }}>{ins.label}</div>
                      <div style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--text-primary)" }}>{ins.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
