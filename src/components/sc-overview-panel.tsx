"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";

// ── Types ──────────────────────────────────────────────────────────────────
type CategoryStat = { id: number; name: string; totalItems: number; pricedItems: number; pct: number };
type SupplierStat = { id: number; name: string; quotesThisMonth: number };
type RecentChange = {
  item_name: string; category_name: string;
  new_sell_min: number; new_sell_max: number;
  prev_sell_min: number | null; prev_sell_max: number | null;
  changed_at: string; changed_by: string; is_update: number;
};

type Props = {
  month: string; username: string;
  pricedCount: number; totalActiveItems: number;
  pendingCount: number; quotesThisMonth: number; suppliersThisMonth: number;
  categoryStats: CategoryStat[]; supplierStats: SupplierStat[];
  recentChanges: RecentChange[];
};

// ── Helpers ────────────────────────────────────────────────────────────────
function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split("-").map(Number);
  const dt = new Date(y, mo - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر"
];

function shortDate(iso: string, isRTL: boolean) {
  try {
    const d = new Date(iso);
    if (isRTL) {
      const hr = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      const arMonth = ARABIC_MONTHS[d.getMonth()] || "";
      return `${d.getDate()} ${arMonth} ${hr}:${min}`;
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}
function pctDiff(next: number, prev: number | null) {
  if (!prev) return null;
  return ((next - prev) / prev * 100).toFixed(1);
}

const CAT_PALETTES = [
  { grad: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)", glow: "rgba(99,102,241,0.25)", light: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.2)", text: "#6366f1", bar: "#6366f1" },
  { grad: "linear-gradient(135deg,#10b981 0%,#059669 100%)", glow: "rgba(16,185,129,0.25)", light: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", text: "#059669", bar: "#10b981" },
  { grad: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)", glow: "rgba(245,158,11,0.25)",  light: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)",  text: "#d97706", bar: "#f59e0b" },
  { grad: "linear-gradient(135deg,#0891b2 0%,#0e7490 100%)", glow: "rgba(6,182,212,0.25)",   light: "rgba(6,182,212,0.08)",   border: "rgba(6,182,212,0.2)",   text: "#0891b2", bar: "#06b6d4" },
  { grad: "linear-gradient(135deg,#ec4899 0%,#db2777 100%)", glow: "rgba(236,72,153,0.25)",  light: "rgba(236,72,153,0.08)",  border: "rgba(236,72,153,0.2)",  text: "#db2777", bar: "#ec4899" },
  { grad: "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)", glow: "rgba(239,68,68,0.25)",   light: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)",   text: "#dc2626", bar: "#ef4444" },
  { grad: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)", glow: "rgba(132,204,22,0.25)",  light: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.2)",  text: "#4d7c0f", bar: "#84cc16" },
  { grad: "linear-gradient(135deg,#a855f7 0%,#9333ea 100%)", glow: "rgba(168,85,247,0.25)",  light: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.2)",  text: "#9333ea", bar: "#a855f7" },
];

// ── SVG Circular Progress ──────────────────────────────────────────────────
function CircleProgress({ pct, size = 128, stroke = 10, color = "#6366f1" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ScOverviewPanel({
  month, username, pricedCount, totalActiveItems, pendingCount,
  quotesThisMonth, suppliersThisMonth, categoryStats, supplierStats, recentChanges,
}: Props) {
  const { t, isRTL } = useI18n();
  const coveragePct     = totalActiveItems > 0 ? Math.round(pricedCount / totalActiveItems * 100) : 0;
  const catsDone        = categoryStats.filter(c => c.pct === 100).length;
  const catsPct         = categoryStats.length > 0 ? Math.round(catsDone / categoryStats.length * 100) : 0;
  const maxQuotes       = supplierStats[0]?.quotesThisMonth ?? 1;
  const overallStatus   = coveragePct === 100 ? t("sco.statusComplete") : coveragePct > 0 ? t("sco.statusInProgress") : t("sco.statusNotStarted");
  const statusColor     = coveragePct === 100 ? "#10b981" : coveragePct > 0 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Month Navigation ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 18px",
        background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "14px",
        flexWrap: "wrap",
      }}>
        <Link href={`/dashboard?month=${shiftMonth(month, -1)}`} style={{
          fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)",
          textDecoration: "none", padding: "6px 12px", borderRadius: "8px",
          background: "var(--bg-subtle)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: "4px",
          transition: "all 150ms",
        }}>
          {isRTL ? `${formatMonthLabel(shiftMonth(month, -1))} ←` : `← ${formatMonthLabel(shiftMonth(month, -1))}`}
        </Link>

        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            {formatMonthLabel(month)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
            {t("sco.title").replace("{user}", username)}
          </div>
        </div>

        <Link href={`/dashboard?month=${shiftMonth(month, +1)}`} style={{
          fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)",
          textDecoration: "none", padding: "6px 12px", borderRadius: "8px",
          background: "var(--bg-subtle)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: "4px",
          transition: "all 150ms",
        }}>
          {isRTL ? `→ ${formatMonthLabel(shiftMonth(month, +1))}` : `${formatMonthLabel(shiftMonth(month, +1))} →`}
        </Link>
      </div>

      {/* ── Hero Status Card ─────────────────────────────────────────────── */}
      <div style={{
        padding: "28px 32px",
        borderRadius: "18px",
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
        border: "1px solid rgba(99,102,241,0.3)",
        boxShadow: "0 8px 32px rgba(99,102,241,0.25), 0 2px 8px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap",
        position: "relative", overflow: "hidden",
      }}>
        {/* background glow orbs */}
        <div style={{ position: "absolute", top: "-40px", right: isRTL ? "auto" : "-40px", left: isRTL ? "-40px" : "auto", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(139,92,246,0.15)", filter: "blur(30px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-30px", left: isRTL ? "auto" : "200px", right: isRTL ? "200px" : "auto", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(99,102,241,0.12)", filter: "blur(24px)", pointerEvents: "none" }} />

        {/* Circular progress */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <CircleProgress pct={coveragePct} size={128} stroke={10} color="#a5b4fc" />
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "0px",
          }}>
            <div style={{ fontSize: "26px", fontWeight: 900, color: "#e0e7ff", lineHeight: 1 }}>{coveragePct}%</div>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("sco.priced")}</div>
          </div>
        </div>

        {/* Status text + stat chips */}
        <div style={{ flex: 1, minWidth: 0, textAlign: isRTL ? "right" : "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap", flexDirection: isRTL ? "row-reverse" : "row" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#e0e7ff", letterSpacing: "-0.02em" }}>
              {t("sco.pricedItemsCount")
                .replace("{priced}", String(pricedCount))
                .replace("{total}", String(totalActiveItems))}
            </span>
            <span style={{
              fontSize: "11px", fontWeight: 800, padding: "3px 10px", borderRadius: "99px",
              background: `${statusColor}22`, color: statusColor,
              border: `1px solid ${statusColor}55`,
            }}>{overallStatus}</span>
          </div>
          <div style={{ fontSize: "12px", color: "rgba(165,180,252,0.75)", marginBottom: "16px" }}>
            {t("sco.catsDoneDesc")
              .replace("{done}", String(catsDone))
              .replace("{total}", String(categoryStats.length))}
            &nbsp;·&nbsp;
            {t("sco.activeSuppliersDesc")
              .replace("{count}", String(suppliersThisMonth))}
          </div>

          {/* Mini stat chips */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flexDirection: isRTL ? "row-reverse" : "row" }}>
            {[
              { label: t("sco.chipCatsDone"), value: `${catsDone}/${categoryStats.length}`, color: "#6ee7b7" },
              { label: t("sco.chipQuotes"), value: String(quotesThisMonth), color: "#93c5fd" },
              { label: t("sco.chipSuppliers"), value: String(suppliersThisMonth), color: "#c4b5fd" },
              ...(pendingCount > 0 ? [{ label: t("sco.chipPending"), value: String(pendingCount), color: "#fcd34d" }] : []),
            ].map(chip => (
              <div key={chip.label} style={{
                padding: "8px 14px", borderRadius: "10px",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
                textAlign: isRTL ? "right" : "left",
              }}>
                <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(165,180,252,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>{chip.label}</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: chip.color, lineHeight: 1 }}>{chip.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending approvals alert (if any) */}
        {pendingCount > 0 && (
          <Link href="/dashboard/approvals" style={{ textDecoration: "none", flexShrink: 0, marginInlineStart: isRTL ? "0" : "auto", marginInlineEnd: isRTL ? "auto" : "0" }}>
            <div style={{
              padding: "12px 16px", borderRadius: "12px",
              background: "rgba(245,158,11,0.15)", border: "1.5px solid rgba(245,158,11,0.4)",
              textAlign: "center", cursor: "pointer",
              transition: "background 150ms",
            }}>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#fcd34d" }}>{pendingCount}</div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#fbbf24", marginTop: "2px" }}>{t("gen.pending")}</div>
              <div style={{ fontSize: "9px", color: "rgba(251,191,36,0.7)", marginTop: "1px" }}>{isRTL ? "← مراجعة" : "Review →"}</div>
            </div>
          </Link>
        )}
      </div>

      {/* ── Category Progress Grid ───────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexDirection: isRTL ? "row-reverse" : "row" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
            {t("sco.categoryProgressTitle")}
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "99px", padding: "1px 7px" }}>
            {t("sco.categoryProgressComplete")
              .replace("{done}", String(catsDone))
              .replace("{total}", String(categoryStats.length))}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {categoryStats.map((cat, i) => {
            const pal = CAT_PALETTES[i % CAT_PALETTES.length];
            const href = `/dashboard/pricing?categoryId=${cat.id}&month=${month}`;
            const isComplete = cat.pct === 100;
            const isEmpty    = cat.pct === 0;
            return (
              <Link key={cat.id} href={href} style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "18px 20px", borderRadius: "16px",
                  background: isComplete
                    ? "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.04) 100%)"
                    : pal.light,
                  border: `1.5px solid ${isComplete ? "rgba(16,185,129,0.3)" : pal.border}`,
                  boxShadow: isComplete ? "0 2px 12px rgba(16,185,129,0.1)" : `0 2px 12px ${pal.glow}22`,
                  transition: "transform 180ms, box-shadow 180ms",
                  cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: "10px",
                  textAlign: isRTL ? "right" : "left",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = isComplete ? "0 8px 24px rgba(16,185,129,0.2)" : `0 8px 24px ${pal.glow}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = isComplete ? "0 2px 12px rgba(16,185,129,0.1)" : `0 2px 12px ${pal.glow}22`; }}
                >
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                    <div>
                      <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isComplete ? "var(--success)" : pal.text, marginBottom: "3px" }}>
                        {t("gen.category")}
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{cat.name}</div>
                    </div>

                    {/* Status badge */}
                    <span style={{
                      fontSize: "10px", fontWeight: 800, padding: "3px 9px", borderRadius: "99px", whiteSpace: "nowrap" as const,
                      background: isComplete ? "rgba(16,185,129,0.15)" : isEmpty ? "rgba(239,68,68,0.1)" : `${pal.text}18`,
                      color: isComplete ? "var(--success)" : isEmpty ? "var(--danger)" : pal.text,
                      border: `1px solid ${isComplete ? "rgba(16,185,129,0.3)" : isEmpty ? "rgba(239,68,68,0.3)" : `${pal.text}40`}`,
                    }}>
                      {isComplete ? t("sco.catStatusDone") : isEmpty ? t("sco.catStatusPending") : `${cat.pct}%`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div style={{ height: "6px", borderRadius: "99px", background: "var(--bg-subtle)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: "99px",
                        width: `${cat.pct}%`,
                        background: isComplete ? "var(--success)" : pal.bar,
                        transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                    <div style={{ marginTop: "5px", fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", flexDirection: isRTL ? "row-reverse" : "row" }}>
                      <span>
                        {t("sco.catPricedCount")
                          .replace("{priced}", String(cat.pricedItems))
                          .replace("{total}", String(cat.totalItems))}
                      </span>
                      <span style={{ fontWeight: 700, color: isComplete ? "var(--success)" : pal.text }}>{cat.pct}%</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div style={{
                    paddingTop: "8px", borderTop: `1px solid ${isComplete ? "rgba(16,185,129,0.15)" : pal.border}`,
                    fontSize: "11px", fontWeight: 700,
                    color: isComplete ? "var(--success)" : pal.text,
                    display: "flex", alignItems: "center", gap: "4px",
                    flexDirection: isRTL ? "row-reverse" : "row",
                  }}>
                    {isComplete ? t("sco.ctaReview") : isEmpty ? t("sco.ctaStart") : t("sco.ctaContinue")}
                    <span style={{ marginInlineStart: isRTL ? "0" : "auto", marginInlineEnd: isRTL ? "auto" : "0" }}>{isRTL ? "←" : "→"}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Two-column Activity Section ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

        {/* Recent Price Changes */}
        <div style={{
          padding: "20px", borderRadius: "16px",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: "0",
          textAlign: isRTL ? "right" : "left",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexDirection: isRTL ? "row-reverse" : "row" }}>
            <span style={{ fontSize: "16px" }}>🔄</span>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
              {t("sco.recentChangesTitle")}
            </span>
            <span style={{
              marginInlineStart: isRTL ? "0" : "auto", marginInlineEnd: isRTL ? "auto" : "0", fontSize: "9.5px", fontWeight: 700,
              background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "99px",
              padding: "1px 7px", color: "var(--text-muted)",
            }}>{t("sco.recentChangesCount").replace("{count}", String(recentChanges.length))}</span>
          </div>

          {recentChanges.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
              {t("sco.noChanges")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto", paddingInlineEnd: "4px" }}>
              {recentChanges.slice(0, 8).map((rc, i) => {
                const up   = rc.prev_sell_min !== null && rc.new_sell_min > rc.prev_sell_min;
                const dn   = rc.prev_sell_min !== null && rc.new_sell_min < rc.prev_sell_min;
                const diff = pctDiff(rc.new_sell_min, rc.prev_sell_min);
                return (
                  <div key={i} style={{
                    padding: "10px 12px", borderRadius: "10px",
                    background: "var(--bg-surface)", border: "1px solid var(--border-light)",
                    display: "flex", gap: "10px", alignItems: "flex-start",
                    flexDirection: isRTL ? "row-reverse" : "row",
                  }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "9px", flexShrink: 0,
                      background: up ? "rgba(239,68,68,0.1)" : dn ? "rgba(16,185,129,0.1)" : "rgba(99,102,241,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                    }}>
                      {up ? "📈" : dn ? "📉" : "✨"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: isRTL ? "right" : "left" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                        {rc.item_name}
                      </div>
                      <div style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <span style={{ background: "var(--bg-subtle)", padding: "1px 6px", borderRadius: "4px", fontSize: "9.5px", fontWeight: 600 }}>{rc.category_name}</span>
                        {rc.prev_sell_min !== null && (
                          <span>{formatCurrency(rc.prev_sell_min)} {isRTL ? "←" : "→"}</span>
                        )}
                        <span style={{ fontWeight: 700, color: up ? "var(--danger)" : dn ? "var(--success)" : "var(--primary)" }}>
                          {formatCurrency(rc.new_sell_min)}
                        </span>
                        {diff && (
                          <span style={{
                            fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "4px",
                            background: up ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                            color: up ? "var(--danger)" : "var(--success)",
                          }}>
                            {up ? "+" : ""}{diff}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: "9.5px", color: "var(--text-dim)", flexShrink: 0, textAlign: isRTL ? "left" : "right" }}>
                      {shortDate(rc.changed_at, isRTL)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Supplier Quote Activity */}
        <div style={{
          padding: "20px", borderRadius: "16px",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          textAlign: isRTL ? "right" : "left",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexDirection: isRTL ? "row-reverse" : "row" }}>
            <span style={{ fontSize: "16px" }}>🚛</span>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
              {t("sco.quoteActivityTitle")}
            </span>
            <span style={{
              marginInlineStart: isRTL ? "0" : "auto", marginInlineEnd: isRTL ? "auto" : "0", fontSize: "9.5px", fontWeight: 700,
              background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "99px",
              padding: "1px 7px", color: "var(--text-muted)",
            }}>{t("sco.quoteActivityCount").replace("{count}", String(quotesThisMonth))}</span>
          </div>

          {supplierStats.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
              {t("sco.noQuotes")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              {supplierStats.slice(0, 7).map((s, i) => {
                const barW = Math.round(s.quotesThisMonth / maxQuotes * 100);
                const rankColors = ["#f59e0b", "#9ca3af", "#d97706", "#6366f1", "#10b981", "#ec4899", "#06b6d4"];
                return (
                  <div key={s.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexDirection: isRTL ? "row-reverse" : "row" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 900,
                        width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
                        background: i < 3 ? rankColors[i] : "var(--bg-subtle)",
                        color: i < 3 ? "#fff" : "var(--text-muted)",
                        border: i < 3 ? "none" : "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{i + 1}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: "var(--text-primary)", textAlign: isRTL ? "right" : "left" }}>
                        {s.name}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--primary)", flexShrink: 0 }}>
                        {t("sco.quoteActivityItem").replace("{count}", String(s.quotesThisMonth))}
                      </span>
                    </div>
                    <div style={{ height: "5px", borderRadius: "99px", background: "var(--bg-subtle)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: "99px", width: `${barW}%`,
                        background: i === 0 ? "linear-gradient(90deg,#f59e0b,#fcd34d)" : i === 1 ? "linear-gradient(90deg,#9ca3af,#d1d5db)" : "var(--primary)",
                        transition: "width 0.8s ease",
                        marginInlineStart: isRTL ? "auto" : "0",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Access ──────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)", marginBottom: "12px", textAlign: isRTL ? "right" : "left" }}>
          {t("sco.quickAccessTitle")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "12px" }}>
          {[
            {
              href: `/dashboard/pricing?month=${month}`,
              icon: "⚡", label: t("sco.qaPricingEngine"),
              sub: t("sco.qaPricingEngineSub"),
              grad: "linear-gradient(135deg,#4f46e5,#6366f1)",
              shadow: "rgba(99,102,241,0.35)",
            },
            {
              href: `/dashboard/pricing/category?month=${month}`,
              icon: "📊", label: t("sco.qaCategoryPricing"),
              sub: t("sco.qaCategoryPricingSub"),
              grad: "linear-gradient(135deg,#0e7490,#0891b2)",
              shadow: "rgba(6,182,212,0.35)",
            },
            {
              href: `/dashboard/reports?month=${month}`,
              icon: "📄", label: t("sco.qaReports"),
              sub: t("sco.qaReportsSub"),
              grad: "linear-gradient(135deg,#047857,#059669)",
              shadow: "rgba(16,185,129,0.35)",
            },
            {
              href: "/dashboard/approvals",
              icon: "📋", label: t("sco.qaApprovals"),
              sub: pendingCount > 0 ? t("sco.qaApprovalsPending").replace("{count}", String(pendingCount)) : t("sco.qaApprovalsAllApproved"),
              grad: pendingCount > 0 ? "linear-gradient(135deg,#b45309,#d97706)" : "linear-gradient(135deg,#374151,#4b5563)",
              shadow: pendingCount > 0 ? "rgba(245,158,11,0.35)" : "rgba(0,0,0,0.2)",
              badge: pendingCount > 0 ? String(pendingCount) : undefined,
            },
          ].map(q => (
            <Link key={q.href} href={q.href} style={{ textDecoration: "none" }}>
              <div style={{
                padding: "18px 20px", borderRadius: "16px",
                background: q.grad,
                boxShadow: `0 4px 20px ${q.shadow}`,
                display: "flex", flexDirection: "column", gap: "8px",
                transition: "transform 180ms, box-shadow 180ms",
                position: "relative", overflow: "hidden",
                textAlign: isRTL ? "right" : "left",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 30px ${q.shadow}`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${q.shadow}`; }}
              >
                <div style={{ position: "absolute", top: "-20px", right: isRTL ? "auto" : "-20px", left: isRTL ? "-20px" : "auto", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
                <div style={{ fontSize: "24px", lineHeight: 1 }}>{q.icon}</div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{q.label}</div>
                <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.7)" }}>{q.sub}</div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginTop: "4px" }}>
                  {isRTL ? "← الذهاب" : "Go →"}
                </div>
                {q.badge && (
                  <div style={{
                    position: "absolute", top: "12px", right: "12px",
                    background: "#fff", color: "#d97706",
                    fontSize: "11px", fontWeight: 900, borderRadius: "99px",
                    width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{q.badge}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
