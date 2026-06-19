"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatCurrency, formatMonthLabel } from "@/lib/format";

// ── Types ──────────────────────────────────────────────────────────────────

type CategoryStat = { id: number; name: string; totalItems: number; pricedItems: number; pct: number };
type SupplierStat = { id: number; name: string; quotesThisMonth: number };
type RecentChange = {
  item_name: string; category_name: string;
  new_sell_min: number; prev_sell_min: number | null;
  changed_at: string; changed_by: string;
  new_tier_pricing_enabled?: number;
};

type KpiStripProps = {
  pricedCount: number; totalActiveItems: number;
  pendingCount: number; quotesThisMonth: number;
  suppliersThisMonth: number; categoriesComplete: number;
  totalCategories: number;
};

type SidebarProps = {
  month: string;
  categoryStats: CategoryStat[];
  supplierStats: SupplierStat[];
  recentChanges: RecentChange[];
};

// ── Helper ─────────────────────────────────────────────────────────────────

function formatShortDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

const CAT_BARS = ["#6366f1","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16","#a855f7"];

// ── KPI Strip ──────────────────────────────────────────────────────────────

export function ScKpiStrip({ pricedCount, totalActiveItems, pendingCount, quotesThisMonth, suppliersThisMonth, categoriesComplete, totalCategories }: KpiStripProps) {
  const coveragePct = totalActiveItems > 0 ? Math.round(pricedCount / totalActiveItems * 100) : 0;
  const catPct = totalCategories > 0 ? Math.round(categoriesComplete / totalCategories * 100) : 0;

  const chips = [
    {
      icon: "📦", label: "Items Priced", value: `${pricedCount}/${totalActiveItems}`,
      sub: `${coveragePct}% coverage`, progress: coveragePct,
      color: "#6366f1", bg: "rgba(99,102,241,0.07)", border: "rgba(99,102,241,0.2)",
    },
    {
      icon: "📂", label: "Categories", value: `${categoriesComplete}/${totalCategories}`,
      sub: categoriesComplete === totalCategories ? "All priced ✅" : `${catPct}% complete`,
      progress: catPct,
      color: "#10b981", bg: "rgba(16,185,129,0.07)", border: "rgba(16,185,129,0.2)",
    },
    {
      icon: "🗣️", label: "Supplier Quotes", value: String(quotesThisMonth),
      sub: `${suppliersThisMonth} supplier${suppliersThisMonth !== 1 ? "s" : ""} active`,
      color: "#8b5cf6", bg: "rgba(139,92,246,0.07)", border: "rgba(139,92,246,0.2)",
    },
    pendingCount > 0
      ? { icon: "🔔", label: "Pending Approval", value: String(pendingCount), sub: "click to review",
          color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)",
          href: "/dashboard/approvals" }
      : { icon: "✅", label: "Approvals", value: "Clear", sub: "no pending requests",
          color: "#10b981", bg: "rgba(16,185,129,0.07)", border: "rgba(16,185,129,0.2)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
      {chips.map((c, i) => {
        const inner = (
          <div style={{
            padding: "12px 14px", borderRadius: "12px",
            background: c.bg, border: `1.5px solid ${c.border}`,
            display: "flex", flexDirection: "column", gap: "4px",
            transition: "transform 150ms, box-shadow 150ms", cursor: (c as any).href ? "pointer" : "default",
          }}
          onMouseEnter={e => { if ((c as any).href) { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${c.color}22`; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "16px", lineHeight: 1 }}>{c.icon}</span>
              <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: c.color }}>{c.label}</span>
            </div>
            <div style={{ fontSize: "20px", fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{c.sub}</div>
            {(c as any).progress !== undefined && (
              <div style={{ height: "3px", borderRadius: "99px", background: "var(--bg-subtle)", overflow: "hidden", marginTop: "2px" }}>
                <div style={{ height: "100%", borderRadius: "99px", width: `${(c as any).progress}%`, background: c.color, transition: "width 0.8s ease" }} />
              </div>
            )}
          </div>
        );
        return (c as any).href
          ? <Link key={i} href={(c as any).href} style={{ textDecoration: "none" }}>{inner}</Link>
          : <div key={i}>{inner}</div>;
      })}
    </div>
  );
}

// ── Insights Sidebar ───────────────────────────────────────────────────────

export function ScInsightsSidebar({ month, categoryStats, supplierStats, recentChanges }: SidebarProps) {
  const maxQuotes = supplierStats[0]?.quotesThisMonth ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* ── Category Coverage ── */}
      <div style={{
        padding: "14px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
          <span style={{ fontSize: "14px" }}>📂</span>
          <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
            Category Coverage
          </span>
          <span style={{ marginInlineStart: "auto", fontSize: "9.5px", color: "var(--text-muted)" }}>
            {categoryStats.filter(c => c.pct === 100).length}/{categoryStats.length} done
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {categoryStats.map((cat, i) => (
            <Link
              key={cat.id}
              href={`/dashboard/pricing?categoryId=${cat.id}&month=${month}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div style={{
                padding: "7px 10px", borderRadius: "8px",
                background: cat.pct === 100 ? "rgba(16,185,129,0.06)" : "var(--bg-surface)",
                border: `1px solid ${cat.pct === 100 ? "rgba(16,185,129,0.2)" : "var(--border-light)"}`,
                transition: "background 150ms",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = cat.pct === 100 ? "rgba(16,185,129,0.1)" : "var(--bg-subtle)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = cat.pct === 100 ? "rgba(16,185,129,0.06)" : "var(--bg-surface)"}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "120px" }}>
                    {cat.name}
                  </span>
                  <span style={{ fontSize: "9.5px", fontWeight: 800, color: cat.pct === 100 ? "var(--success)" : cat.pct === 0 ? "var(--danger)" : "#b45309", whiteSpace: "nowrap" as const, marginInlineStart: "6px" }}>
                    {cat.pricedItems}/{cat.totalItems}
                    {cat.pct === 100 ? " ✅" : cat.pct === 0 ? " ⚠️" : ""}
                  </span>
                </div>
                <div style={{ height: "3px", borderRadius: "99px", background: "var(--bg-subtle)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "99px", width: `${cat.pct}%`, background: CAT_BARS[i % CAT_BARS.length], transition: "width 0.7s ease" }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Price Changes ── */}
      {recentChanges.length > 0 && (
        <div style={{
          padding: "14px 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px" }}>🔄</span>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
              Recent Price Changes
            </span>
            <span style={{
              marginInlineStart: "auto", fontSize: "9px", fontWeight: 700,
              background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "99px",
              padding: "1px 5px", color: "var(--text-muted)",
            }}>{recentChanges.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", maxHeight: "200px", overflowY: "auto" }}>
            {recentChanges.slice(0, 6).map((rc, i) => {
              const up = rc.prev_sell_min !== null && rc.new_sell_min > rc.prev_sell_min;
              const dn = rc.prev_sell_min !== null && rc.new_sell_min < rc.prev_sell_min;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 6px", borderRadius: "6px", background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: "12px", flexShrink: 0 }}>{up ? "📈" : dn ? "📉" : "✨"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                      {rc.item_name}
                    </div>
                    <div style={{ fontSize: "9.5px", color: "var(--text-muted)" }}>
                      {rc.prev_sell_min !== null && <span>{formatCurrency(rc.prev_sell_min)} → </span>}
                      <span style={{ fontWeight: 700, color: up ? "var(--danger)" : dn ? "var(--success)" : "var(--primary)" }}>
                        {formatCurrency(rc.new_sell_min)}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: "9px", color: "var(--text-dim)", flexShrink: 0 }}>{formatShortDate(rc.changed_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Supplier Activity ── */}
      {supplierStats.length > 0 && (
        <div style={{
          padding: "14px 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px" }}>🚛</span>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
              Supplier Quotes
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {supplierStats.slice(0, 6).map((s, i) => {
              const barPct = Math.round((s.quotesThisMonth / maxQuotes) * 100);
              return (
                <div key={s.id} style={{ padding: "5px 6px", borderRadius: "6px", background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span style={{
                      fontSize: "8.5px", fontWeight: 900, width: "16px", height: "16px",
                      borderRadius: "50%", background: "var(--primary)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: "var(--text-primary)" }}>
                      {s.name}
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--primary)", flexShrink: 0 }}>
                      {s.quotesThisMonth}
                    </span>
                  </div>
                  <div style={{ height: "2px", borderRadius: "99px", background: "var(--bg-subtle)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "99px", width: `${barPct}%`, background: "var(--primary)", transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick link to category pricing ── */}
      <Link
        href={`/dashboard/pricing/category?month=${month}`}
        style={{ textDecoration: "none", display: "block" }}
      >
        <div style={{
          padding: "12px 16px", borderRadius: "12px",
          background: "rgba(6,182,212,0.07)",
          border: "1.5px solid rgba(6,182,212,0.25)",
          display: "flex", alignItems: "center", gap: "10px",
          transition: "transform 150ms, box-shadow 150ms",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(6,182,212,0.15)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
        >
          <span style={{ fontSize: "20px" }}>📊</span>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#0891b2" }}>Category Pricing</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Bulk markup by category →</div>
          </div>
        </div>
      </Link>

    </div>
  );
}
