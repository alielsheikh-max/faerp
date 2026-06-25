"use client";

import { useState, useTransition, useEffect } from "react";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import {
  approveAllSellingPricesAction,
  approveSingleSellingPriceAction,
  reconsiderSellingPriceAction
} from "@/app/actions/approval";

const roundUp5 = (n: number | null | undefined) => n != null ? Math.ceil(n / 5) * 5 : n;

function calcItemTierPrices(sp: any) {
  if (!sp) return [];
  const baseCost = sp.strategy === "min" ? (sp.buyMin ?? 0) : sp.strategy === "max" ? (sp.buyMax ?? 0) : (sp.buyAvg ?? 0);
  const buyAvg = baseCost;
  const transport = sp.transportation ?? 0;
  const other = sp.otherExpenses ?? 0;
  const sellMin = sp.sellMin;
  const r5 = (n: number) => Math.ceil(n / 5) * 5;

  function getPriceForDiscount(discount: number | null | undefined) {
    if (discount == null || discount <= 0 || buyAvg <= 0) return null;
    if (discount < 1) {
      return r5(buyAvg / discount + transport + other);
    }
    const baseSellMin = sellMin !== null ? (sellMin - transport - other) : buyAvg;
    return r5(baseSellMin * (1 - discount / 100) + transport + other);
  }

  return [
    { label: "B",  range: `1–${sp.tier1Max}`,  price: sellMin !== null ? r5(sellMin) : getPriceForDiscount(sp.tier1Discount) },
    { label: "T2", range: `${(sp.tier1Max ?? 0) + 1}–${sp.tier2Max}`, price: getPriceForDiscount(sp.tier2Discount) },
    { label: "T3", range: `${(sp.tier2Max ?? 0) + 1}–${sp.tier3Max}`, price: getPriceForDiscount(sp.tier3Discount) },
    { label: "T4", range: `>${sp.tier3Max}`,   price: getPriceForDiscount(sp.tier4Discount) },
  ].filter(t => t.price !== null);
}

function calcLastApprovedTierPrices(sp: any) {
  if (!sp || sp.lastApprovedSellMin == null) return [];
  const mockSp = {
    ...sp,
    sellMin: sp.lastApprovedSellMin,
    sellMax: sp.lastApprovedSellMax,
    transportation: sp.lastApprovedTransportation !== undefined && sp.lastApprovedTransportation !== null ? sp.lastApprovedTransportation : sp.transportation,
    otherExpenses: sp.lastApprovedOtherExpenses !== undefined && sp.lastApprovedOtherExpenses !== null ? sp.lastApprovedOtherExpenses : sp.otherExpenses,
  };
  return calcItemTierPrices(mockSp);
}

type ItemView = {
  itemId: number;
  itemName: string;
  unit: string;
  categoryId: number;
  categoryName: string;
  confirmedSupplier: string | null;
  currentSp: {
    strategy: string;
    sellMin: number;
    sellMax: number;
    buyAvg: number;
    buyMin: number;
    buyMax: number;
    approvalStatus: "pending" | "approved" | "reconsidered";
    reconsiderNote: string | null;
    lastApprovedSellMin: number | null;
    lastApprovedSellMax: number | null;
    lastApprovedTransportation?: number | null;
    lastApprovedOtherExpenses?: number | null;
    transportation: number;
    otherExpenses: number;
    tierPricingEnabled: number;
    tier1Max: number; tier1Discount: number;
    tier2Max: number; tier2Discount: number;
    tier3Max: number; tier3Discount: number;
    tier4Max: number; tier4Discount: number;
  } | null;
  buyingHistory: Array<{ month: string; min: number | null; max: number | null; avg: number | null }>;
  sellingHistory: Array<{ month: string; sell_min: number | null; sell_max: number | null }>;
  recommendedSupplierName?: string | null;
};

type Props = {
  items: ItemView[];
  categories: Array<{ id: number; name: string }>;
  month: string;
  username: string;
};

export default function MGWorkstationClient({ items, categories, month, username }: Props) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const [categoryId, setCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [reconsiderItemId, setReconsiderItemId] = useState<number | null>(null);
  const [reconsiderNote, setReconsiderNote] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "reconsidered" | "none">("all");

  useEffect(() => {
    const handleFilterPending = () => {
      setStatusFilter("pending");
    };
    window.addEventListener("filter-pending-approvals", handleFilterPending);
    return () => window.removeEventListener("filter-pending-approvals", handleFilterPending);
  }, []);

  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter items by category + search
  const baseFiltered = items.filter(item => {
    const matchesCategory = categoryId === "all" || String(item.categoryId) === categoryId;
    const matchesSearch = searchQuery.trim() === "" || item.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Status counts (computed before status filter)
  const statusCounts = {
    all: baseFiltered.length,
    pending: baseFiltered.filter(i => i.currentSp?.approvalStatus === "pending").length,
    approved: baseFiltered.filter(i => i.currentSp?.approvalStatus === "approved").length,
    reconsidered: baseFiltered.filter(i => i.currentSp?.approvalStatus === "reconsidered").length,
    none: baseFiltered.filter(i => i.currentSp === null).length,
  };

  // Apply status filter
  const filtered = baseFiltered.filter(item => {
    if (statusFilter === "all") return true;
    if (statusFilter === "none") return item.currentSp === null;
    return item.currentSp?.approvalStatus === statusFilter;
  });

  const pendingCount = statusCounts.pending;

  const handleApproveAll = () => {
    if (categoryId === "all") {
      alert(isAr ? "يرجى تحديد فئة معينة لاعتماد الكل" : "Please select a specific category to approve all.");
      return;
    }
    if (confirm(isAr ? "هل أنت متأكد من اعتماد جميع الأسعار المعلقة في هذه الفئة؟" : "Are you sure you want to approve all pending prices in this category?")) {
      setActionError(null);
      startTransition(async () => {
        const fd = new FormData();
        fd.set("categoryId", categoryId);
        fd.set("month", month);
        const res = await approveAllSellingPricesAction(fd);
        if (!res.ok) {
          setActionError(res.error || "Failed to approve all.");
        } else {
          alert(isAr ? "تم اعتماد جميع أسعار الفئة بنجاح!" : "All category prices approved successfully!");
        }
      });
    }
  };

  const handleApproveItem = (itemId: number) => {
    setActionError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("itemId", String(itemId));
      fd.set("month", month);
      const res = await approveSingleSellingPriceAction(fd);
      if (!res.ok) {
        setActionError(res.error || "Failed to approve item.");
      }
    });
  };

  const handleOpenReconsider = (itemId: number) => {
    setReconsiderItemId(itemId);
    setReconsiderNote("");
  };

  const handleSaveReconsider = () => {
    if (!reconsiderNote.trim()) {
      alert(isAr ? "يرجى كتابة سبب إعادة النظر" : "Please write a reconsideration note.");
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("itemId", String(reconsiderItemId));
      fd.set("month", month);
      fd.set("reconsiderNote", reconsiderNote.trim());
      const res = await reconsiderSellingPriceAction(fd);
      if (res.ok) {
        setReconsiderItemId(null);
        setReconsiderNote("");
      } else {
        setActionError(res.error || "Failed to reconsider.");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: isAr ? "right" : "left" }}>
      
      {/* Header controls card */}
      <div style={{
        padding: "16px 20px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "14px",
        flexDirection: isAr ? "row-reverse" : "row"
      }}>
        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flexDirection: isAr ? "row-reverse" : "row", flex: 1 }}>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-primary)", fontSize: "13px", minWidth: "180px" }}
          >
            <option value="all">{isAr ? "جميع الفئات" : "All Categories"}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Search bar */}
          <div style={{ minWidth: "240px", position: "relative" }}>
            <span style={{ position: "absolute", left: isAr ? "auto" : "10px", right: isAr ? "10px" : "auto", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "12px", pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              placeholder={isAr ? "ابحث عن صنف..." : "Search items..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: "100%",
                padding: isAr ? "7px 30px 7px 12px" : "7px 12px 7px 30px",
                borderRadius: "20px",
                border: searchFocused ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                fontSize: "12.5px",
                outline: "none",
                boxShadow: searchFocused ? "0 0 0 3px rgba(99, 102, 241, 0.12)" : "none",
                transition: "all 0.2s ease"
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: isAr ? "auto" : "8px",
                  left: isAr ? "8px" : "auto",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  padding: "2px 6px"
                }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Bulk approval */}
        {categoryId !== "all" && pendingCount > 0 && (
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={pending}
            className="button button-success"
            style={{
              padding: "8px 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: pending ? "not-allowed" : "pointer",
              opacity: pending ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              flexDirection: isAr ? "row-reverse" : "row"
            }}
          >
            <span>✅</span>
            <span>{isAr ? `اعتماد جميع أسعار الفئة (${pendingCount})` : `Approve All in Category (${pendingCount})`}</span>
          </button>
        )}
      </div>

      {actionError && (
        <div style={{ padding: "10px 14px", background: "var(--danger-light)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* Status Filter Pills */}
      <div style={{
        display: "flex", gap: "8px", flexWrap: "wrap",
        flexDirection: isAr ? "row-reverse" : "row",
      }}>
        {([
          { key: "all",           label: isAr ? "الكل" : "All",            icon: "",  color: "var(--primary)" },
          { key: "pending",       label: isAr ? "معلق" : "Pending",        icon: "⏳", color: "#f59e0b" },
          { key: "approved",      label: isAr ? "معتمد" : "Approved",      icon: "✅", color: "var(--success)" },
          { key: "reconsidered",  label: isAr ? "مرفوض" : "Reconsidered",  icon: "🔄", color: "var(--danger)" },
          { key: "none",          label: isAr ? "بدون سعر" : "No Quote",   icon: "❓", color: "var(--text-muted)" },
        ] as const).map(pill => {
          const isActive = statusFilter === pill.key;
          const count = statusCounts[pill.key];
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => setStatusFilter(pill.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "99px",
                fontSize: "12px", fontWeight: 700,
                cursor: "pointer",
                border: `1.5px solid ${pill.color}`,
                background: isActive ? pill.color : "transparent",
                color: isActive ? "#fff" : pill.color,
                transition: "all 0.15s ease",
                flexDirection: isAr ? "row-reverse" : "row",
              }}
            >
              {pill.icon && <span style={{ fontSize: "12px" }}>{pill.icon}</span>}
              <span>{pill.label}</span>
              <span style={{
                background: isActive ? "rgba(255,255,255,0.25)" : pill.color,
                color: isActive ? "#fff" : "#fff",
                fontSize: "10px", fontWeight: 800,
                padding: "1px 7px", borderRadius: "99px",
                minWidth: "20px", textAlign: "center" as const,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Main Items Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px", borderRadius: "12px", textAlign: "center", background: "var(--bg-elevated)", border: "1px solid var(--border-light)" }}>
            <span style={{ fontSize: "36px" }}>🔍</span>
            <h3 style={{ color: "var(--text-secondary)", marginTop: "12px" }}>{isAr ? "لم يتم العثور على أي نتائج" : "No items match your search"}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>{isAr ? "حاول تغيير خيارات البحث أو تحديد فئة أخرى" : "Try adjusting your search query or category filters."}</p>
          </div>
        ) : (
          filtered.map(item => {
            const hasQuote = item.currentSp !== null;
            const status = item.currentSp?.approvalStatus;

            const isExpanded = expandedItems.has(item.itemId);

            return (
              <div key={item.itemId} data-status={status || "none"} style={{
                background: "var(--bg-elevated)",
                border: `1.5px solid ${
                  status === "approved" ? "rgba(34,197,94,0.35)" :
                  status === "reconsidered" ? "rgba(239,68,68,0.35)" :
                  status === "pending" ? "rgba(245,158,11,0.35)" : "var(--border-light)"
                }`,
                borderRadius: "var(--radius-lg)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.2s ease"
              }}>
                {/* Accent status line at the top */}
                <div style={{
                  height: "4px",
                  background: status === "approved" ? "var(--success)" :
                             status === "reconsidered" ? "var(--danger)" :
                             status === "pending" ? "var(--warning)" : "var(--border-light)",
                }} />

                {/* 1. CARD HEADER (Always visible) */}
                <div
                  onClick={() => toggleExpand(item.itemId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--border-light)",
                    background: "rgba(0, 0, 0, 0.01)",
                    cursor: "pointer",
                    userSelect: "none",
                    flexDirection: isAr ? "row-reverse" : "row"
                  }}
                >
                  {/* Left: Item Name + Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flexDirection: isAr ? "row-reverse" : "row" }}>
                    <h4 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                      {item.itemName}
                    </h4>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap", flexDirection: isAr ? "row-reverse" : "row" }}>
                      <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "var(--bg-subtle)", border: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                        {item.categoryName}
                      </span>
                      <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px", background: "rgba(99,102,241,0.08)", color: "var(--primary)", border: "1px solid rgba(99,102,241,0.15)" }}>
                        {item.unit}
                      </span>
                      {item.confirmedSupplier && (
                        <span style={{ fontSize: "9.5px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px", background: "rgba(34,197,94,0.08)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.15)" }}>
                          🏭 {item.confirmedSupplier}
                        </span>
                      )}
                      {item.recommendedSupplierName && (
                        <span style={{ fontSize: "9.5px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px", background: "rgba(234,179,8,0.10)", color: "#a16207", border: "1px solid rgba(234,179,8,0.25)" }}>
                          ⭐ {item.recommendedSupplierName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Status badge + Expand Chevron */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: isAr ? "row-reverse" : "row" }}>
                    {!hasQuote ? (
                      <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border-light)" }}>
                        {isAr ? "بدون سعر" : "No quote"}
                      </span>
                    ) : status === "approved" ? (
                      <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.25)" }}>
                        ✓ {isAr ? "معتمد" : "Approved"}
                      </span>
                    ) : status === "reconsidered" ? (
                      <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", background: "rgba(239,68,68,0.10)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.25)" }}>
                        ↩ {isAr ? "مرفوض للمراجعة" : "Returned for Review"}
                      </span>
                    ) : (
                      <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)", animation: "pulse-ring 2s infinite" }}>
                        ⏳ {isAr ? "معلق للاعتماد" : "Pending Approval"}
                      </span>
                    )}

                    <span style={{
                      color: "var(--text-muted)",
                      fontSize: "11px",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms ease",
                      display: "inline-block"
                    }}>▼</span>
                  </div>
                </div>

                {/* 2. MAIN DETAILS ROW (Always visible, clean grid) */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  padding: "16px 18px",
                  gap: "16px",
                  background: "var(--bg-elevated)",
                  direction: isAr ? "rtl" : "ltr",
                  textAlign: isAr ? "right" : "left"
                }}>
                  {/* Card Col 1: Cost Base Info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      📊 {isAr ? "أساس التكلفة والاستراتيجية" : "Cost Base & Strategy"}
                    </div>
                    {hasQuote && item.currentSp ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexDirection: isAr ? "row-reverse" : "row" }}>
                          <span style={{ color: "var(--text-secondary)" }}>{isAr ? "استراتيجية الشراء:" : "Buying Strategy:"}</span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            {item.currentSp.strategy === "min" ? (isAr ? "الأقل (Min)" : "Cheapest (Min)") :
                             item.currentSp.strategy === "max" ? (isAr ? "الأعلى (Max)" : "Highest (Max)") :
                             (isAr ? "المتوسط (Avg)" : "Average (Avg)")}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", flexDirection: isAr ? "row-reverse" : "row" }}>
                          <span style={{ color: "var(--text-secondary)" }}>{isAr ? "تكلفة الشراء الأساسية:" : "Base Buying Cost:"}</span>
                          <strong style={{ color: "var(--text-primary)" }}>
                            {formatCurrency(item.currentSp.strategy === "min" ? item.currentSp.buyMin : item.currentSp.strategy === "max" ? item.currentSp.buyMax : item.currentSp.buyAvg)}
                          </strong>
                        </div>
                        {(item.currentSp.transportation > 0 || item.currentSp.otherExpenses > 0) && (
                          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "11.5px", flexDirection: isAr ? "row-reverse" : "row" }}>
                            <span>{isAr ? "النقل والمصاريف الأخرى:" : "Transport & Expenses:"}</span>
                            <span>
                              +{formatCurrency(item.currentSp.transportation + item.currentSp.otherExpenses)}
                            </span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border-light)", paddingTop: "4px", marginTop: "2px", fontWeight: 700, flexDirection: isAr ? "row-reverse" : "row" }}>
                          <span style={{ color: "var(--text-primary)" }}>{isAr ? "إجمالي تكلفة الأساس:" : "Total Cost Base:"}</span>
                          <span style={{ color: "var(--primary)" }}>
                            {formatCurrency((item.currentSp.strategy === "min" ? item.currentSp.buyMin : item.currentSp.strategy === "max" ? item.currentSp.buyMax : item.currentSp.buyAvg) + item.currentSp.transportation + item.currentSp.otherExpenses)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "12px", fontStyle: "italic" }}>
                        {isAr ? "لا توجد أسعار مقدمة" : "No pricing data submitted"}
                      </span>
                    )}
                  </div>

                  {/* Card Col 2: Current Approved Price */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      ↩ {isAr ? "السعر الحالي المعتمد" : "Current Approved Price"}
                    </div>
                    {hasQuote && item.currentSp ? (
                      item.currentSp.lastApprovedSellMin != null ? (
                        (() => {
                          const lastApprovedTiers = calcLastApprovedTierPrices(item.currentSp);
                          const isTiered = item.currentSp.tierPricingEnabled === 1 && lastApprovedTiers.length > 0;
                          if (isTiered) {
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px" }}>
                                  {lastApprovedTiers.map((t, idx) => (
                                    <div key={t.label} style={{
                                      padding: "4px 6px",
                                      background: "var(--bg-subtle)",
                                      borderRadius: "6px",
                                      border: "1px solid var(--border-light)",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center"
                                    }}>
                                      <span style={{ fontSize: "9px", fontWeight: 800, color: "var(--text-muted)" }}>{t.label} ({t.range})</span>
                                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textDecoration: "line-through" }}>
                                        {formatCurrency(t.price)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", justifyContent: "center", height: "100%" }}>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {isAr ? "الحد الأدنى المعتمد:" : "Approved Min:"}{" "}
                                <span style={{ fontWeight: 700, textDecoration: "line-through" }}>
                                  {formatCurrency(roundUp5(item.currentSp.lastApprovedSellMin))}
                                </span>
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {isAr ? "الحد الأقصى المعتمد:" : "Approved Max:"}{" "}
                                <span style={{ fontWeight: 700, textDecoration: "line-through" }}>
                                  {formatCurrency(roundUp5(item.currentSp.lastApprovedSellMax))}
                                </span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                          <span className="badge badge-warning" style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px" }}>
                            ✨ {isAr ? "صنف جديد لأول مرة" : "New item (First time)"}
                          </span>
                        </div>
                      )
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</span>
                    )}
                  </div>

                  {/* Card Col 3: Proposed Selling Price */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    padding: "8px 12px",
                    background: status === "pending" ? "rgba(245,158,11,0.03)" : "rgba(34,197,94,0.03)",
                    border: `1.5px solid ${status === "pending" ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)"}`,
                    borderRadius: "10px"
                  }}>
                    <div style={{
                      fontSize: "10.5px",
                      fontWeight: 900,
                      color: status === "pending" ? "#b45309" : "var(--success)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      ⚡ {isAr ? "السعر المقترح الجديد" : "New Proposed Price"}
                    </div>
                    {hasQuote && item.currentSp ? (
                      (() => {
                        const proposedTiers = calcItemTierPrices(item.currentSp);
                        const isTiered = item.currentSp.tierPricingEnabled === 1 && proposedTiers.length > 0;
                        if (isTiered) {
                          const TIER_COLORS = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)"];
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px" }}>
                                {proposedTiers.map((t, idx) => (
                                  <div key={t.label} style={{
                                    padding: "4px 6px",
                                    background: "var(--bg-elevated)",
                                    borderRadius: "6px",
                                    border: `1px solid ${TIER_COLORS[idx]}`,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center"
                                  }}>
                                    <span style={{ fontSize: "9px", fontWeight: 800, color: TIER_COLORS[idx] }}>{t.label} ({t.range})</span>
                                    <span style={{ fontSize: "12px", fontWeight: 900, color: TIER_COLORS[idx] }}>
                                      {formatCurrency(t.price)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", justifyContent: "center", height: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
                              <span style={{
                                display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                                background: status === "pending" ? "#059669" : "var(--success)",
                                boxShadow: `0 0 6px ${status === "pending" ? "rgba(5,150,105,0.4)" : "rgba(34,197,94,0.4)"}`,
                                flexShrink: 0,
                              }} />
                              {isAr ? "الحد الأدنى المقترح:" : "Proposed Min:"}{" "}
                              <strong style={{ fontSize: "13px", color: status === "pending" ? "#059669" : "var(--success)", fontWeight: 900 }}>
                                {formatCurrency(roundUp5(item.currentSp.sellMin))}
                              </strong>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
                              <span style={{
                                display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                                background: status === "pending" ? "#4f46e5" : "var(--primary)",
                                boxShadow: `0 0 6px ${status === "pending" ? "rgba(79,70,229,0.4)" : "rgba(99,102,241,0.4)"}`,
                                flexShrink: 0,
                              }} />
                              {isAr ? "الحد الأقصى المقترح:" : "Proposed Max:"}{" "}
                              <strong style={{ fontSize: "13px", color: status === "pending" ? "#4f46e5" : "var(--primary)", fontWeight: 900 }}>
                                {formatCurrency(roundUp5(item.currentSp.sellMax))}
                              </strong>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</span>
                    )}
                  </div>

                  {/* Card Col 4: Quick Actions */}
                  {hasQuote && (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: "8px",
                      alignItems: "stretch",
                      paddingInlineStart: "12px",
                      borderInlineStart: "1.5px solid var(--border-light)"
                    }}>
                      {status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveItem(item.itemId)}
                            disabled={pending}
                            className="button button-success"
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              fontSize: "12.5px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              cursor: pending ? "not-allowed" : "pointer"
                            }}
                          >
                            <span>✓</span>
                            <span>{isAr ? "اعتماد السعر" : "Approve Price"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReconsider(item.itemId)}
                            disabled={pending}
                            className="button button-danger"
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              fontSize: "12.5px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              cursor: pending ? "not-allowed" : "pointer"
                            }}
                          >
                            <span>↩</span>
                            <span>{isAr ? "إعادة للنظر" : "Return for Review"}</span>
                          </button>
                        </>
                      )}
                      {status === "approved" && (
                        <button
                          type="button"
                          onClick={() => handleOpenReconsider(item.itemId)}
                          disabled={pending}
                          className="button button-secondary"
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            fontSize: "11.5px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            cursor: pending ? "not-allowed" : "pointer"
                          }}
                        >
                          <span>↩</span>
                          <span>{isAr ? "طلب مراجعة" : "Return to SC"}</span>
                        </button>
                      )}
                      {status === "reconsidered" && (
                        <div style={{
                          padding: "6px 8px",
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.15)",
                          borderRadius: "6px",
                          textAlign: "center",
                          fontSize: "11px",
                          color: "var(--danger)",
                          fontWeight: 600
                        }}>
                          {isAr ? "بانتظار تعديل السعر من Pricing Control" : "Awaiting SC revision"}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Reconsideration Note display (if returned) - always visible if active */}
                {status === "reconsidered" && item.currentSp?.reconsiderNote && (
                  <div style={{
                    padding: "8px 14px",
                    background: "rgba(239,68,68,0.06)",
                    borderTop: "1px solid rgba(239,68,68,0.15)",
                    fontSize: "12px",
                    color: "var(--danger)",
                    display: "flex",
                    gap: "6px",
                    flexDirection: isAr ? "row-reverse" : "row"
                  }}>
                    <strong>{isAr ? "سبب الإرجاع للمراجعة:" : "Reconsideration Reason:"}</strong>
                    <span>{item.currentSp.reconsiderNote}</span>
                  </div>
                )}

                {/* 3. COLLAPSIBLE HISTORIES (Only visible when expanded) */}
                {isExpanded && (
                  <div className="animate-scale-in" style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    borderTop: "1.5px solid var(--border-light)",
                    padding: "14px 18px 16px",
                    background: "var(--bg-subtle)"
                  }}>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "16px"
                    }}>
                      {/* History Col 1: Supplier Quotes Cost History */}
                      <div style={{ padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", textAlign: isAr ? "right" : "left" }}>
                          🏭 {isAr ? "تاريخ تكاليف الموردين" : "Supplier Quotes Cost History"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {item.buyingHistory.map((h, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", flexDirection: isAr ? "row-reverse" : "row" }}>
                              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{formatMonthLabel(h.month)}</span>
                              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                {h.avg !== null ? `${formatCurrency(h.avg)} (avg)` : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* History Col 2: Selling Price History */}
                      <div style={{ padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", textAlign: isAr ? "right" : "left" }}>
                          💰 {isAr ? "تاريخ أسعار البيع المعتمدة" : "Approved Selling Price History"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {item.sellingHistory.map((h, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", flexDirection: isAr ? "row-reverse" : "row" }}>
                              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{formatMonthLabel(h.month)}</span>
                              <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                                {h.sell_min !== null
                                  ? (isAr
                                      ? `الأدنى: ${formatCurrency(roundUp5(h.sell_min))} · الأقصى: ${formatCurrency(roundUp5(h.sell_max))}`
                                      : `Min: ${formatCurrency(roundUp5(h.sell_min))} · Max: ${formatCurrency(roundUp5(h.sell_max))}`
                                    )
                                  : "—"
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Reconsider Note Dialog/Modal */}
      {reconsiderItemId !== null && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div className="panel animate-scale-in" style={{ width: "100%", maxWidth: "460px", padding: "20px 24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "12px" }}>
              {isAr ? "إرجاع السعر للمراجعة والتعديل" : "Return to Pricing Control for Review"}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
              {isAr ? "يرجى كتابة ملاحظة توضح لـ Pricing Control سبب إرجاع هذا السعر للتعديل (مثال: هامش مرتفع جداً)."
                    : "Please explain to Pricing Control why you are returning this price for review (e.g. T2 divisor is too low)."}
            </p>
            <textarea
              rows={4}
              value={reconsiderNote}
              onChange={e => setReconsiderNote(e.target.value)}
              placeholder={isAr ? "اكتب الملاحظة هنا..." : "Type review reason here..."}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)",
                background: "var(--bg-subtle)", color: "var(--text-primary)", fontSize: "13px", resize: "none",
                outline: "none", fontFamily: "inherit"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px", flexDirection: isAr ? "row-reverse" : "row" }}>
              <button
                type="button"
                onClick={() => setReconsiderItemId(null)}
                className="button button-secondary"
                style={{ padding: "6px 14px", fontSize: "12.5px" }}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSaveReconsider}
                className="button button-danger"
                style={{ padding: "6px 18px", fontSize: "12.5px", fontWeight: 700 }}
              >
                {isAr ? "إرجاع للتعديل" : "Return for Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
