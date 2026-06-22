"use client";

import { useState, useTransition } from "react";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import {
  approveAllSellingPricesAction,
  approveSingleSellingPriceAction,
  reconsiderSellingPriceAction
} from "@/app/actions/approval";

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
  } | null;
  buyingHistory: Array<{ month: string; min: number | null; max: number | null; avg: number | null }>;
  sellingHistory: Array<{ month: string; sell_min: number | null; sell_max: number | null }>;
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

  // Filter items
  const filtered = items.filter(item => {
    const matchesCategory = categoryId === "all" || String(item.categoryId) === categoryId;
    const matchesSearch = searchQuery.trim() === "" || item.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const pendingCount = filtered.filter(item => item.currentSp?.approvalStatus === "pending").length;

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
              <div key={item.itemId} style={{
                padding: "14px 20px",
                background: "var(--bg-elevated)",
                border: `1.5px solid ${
                  status === "approved" ? "var(--success)" :
                  status === "reconsidered" ? "var(--danger)" :
                  status === "pending" ? "var(--warning)" : "var(--border)"
                }`,
                borderRadius: "var(--radius-lg)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                transition: "all 0.2s ease"
              }}>
                {/* Clickable Header Row */}
                <div
                  onClick={() => toggleExpand(item.itemId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    flexWrap: "wrap",
                    gap: "16px",
                    flexDirection: isAr ? "row-reverse" : "row",
                    userSelect: "none"
                  }}
                >
                  {/* Column 1: Item Info */}
                  <div style={{ flex: "2 1 240px", display: "flex", alignItems: "center", gap: "8px", flexDirection: isAr ? "row-reverse" : "row" }}>
                    <span style={{ fontSize: "14px", fontWeight: 900, color: "var(--text-primary)" }}>{item.itemName}</span>
                    <span className="badge badge-strong" style={{ fontSize: "9px" }}>{item.unit}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: "10px", border: "1px solid var(--border-light)" }}>{item.categoryName}</span>
                  </div>
                  <div style={{ flex: "2.5 1 250px", display: "flex", gap: "16px", justifyContent: "space-between", flexDirection: isAr ? "row-reverse" : "row" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: isAr ? "flex-end" : "flex-start" }}>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {isAr ? "تكلفة الشهر السابق" : "Prev Month Cost"}
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                        {item.buyingHistory[0]?.min != null ? (
                          item.buyingHistory[0].min === item.buyingHistory[0].max
                            ? formatCurrency(item.buyingHistory[0].min)
                            : `${formatCurrency(item.buyingHistory[0].min)} – ${formatCurrency(item.buyingHistory[0].max)}`
                        ) : "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: isAr ? "flex-end" : "flex-start" }}>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {isAr ? "تكلفة الشهر الحالي" : "Current Month Cost"}
                      </span>
                      <div style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--text-primary)" }}>
                        {hasQuote && item.currentSp ? (
                          <>
                            <strong>{formatCurrency(item.currentSp.strategy === "min" ? item.currentSp.buyMin : item.currentSp.strategy === "max" ? item.currentSp.buyMax : item.currentSp.buyAvg)}</strong>
                            <span style={{ fontSize: "9px", color: "var(--text-muted)", marginLeft: "4px" }}>({item.currentSp.strategy})</span>
                          </>
                        ) : "—"}
                      </div>
                      <span style={{ fontSize: "10.5px", color: "var(--primary)", fontWeight: 700, marginTop: "1px" }}>
                        🏭 {item.confirmedSupplier || (isAr ? "غير محدد" : "Not set")}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: Selling Price Ranges (Prev vs Proposed) */}
                  <div style={{ flex: "2 1 220px", display: "flex", gap: "16px", justifyContent: "space-between", flexDirection: isAr ? "row-reverse" : "row" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: isAr ? "flex-end" : "flex-start" }}>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {isAr ? "سعر البيع السابق" : "Prev Month Sell"}
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                        {item.sellingHistory[0]?.sell_min != null ? `${formatCurrency(item.sellingHistory[0].sell_min)} – ${formatCurrency(item.sellingHistory[0].sell_max)}` : "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: isAr ? "flex-end" : "flex-start" }}>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {isAr ? "البيع المقترح" : "Proposed Sell"}
                      </span>
                      <span style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--success)" }}>
                        {hasQuote && item.currentSp ? `${formatCurrency(item.currentSp.sellMin)} – ${formatCurrency(item.currentSp.sellMax)}` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Column 4: Status and Toggle */}
                  <div style={{ flex: "1 1 140px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", flexDirection: isAr ? "row-reverse" : "row" }}>
                    <div>
                      {!hasQuote ? (
                        <span className="badge" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: "9.5px" }}>
                          {isAr ? "لم يقدم سعر" : "No price"}
                        </span>
                      ) : status === "approved" ? (
                        <span className="badge badge-success" style={{ fontSize: "9.5px" }}>
                          ✓ {isAr ? "معتمد" : "Approved"}
                        </span>
                      ) : status === "reconsidered" ? (
                        <span className="badge badge-danger" style={{ fontSize: "9.5px" }}>
                          ↩ {isAr ? "مرفوض" : "Returned"}
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: "9.5px", animation: "pulse-ring 2s infinite" }}>
                          ⏳ {isAr ? "معلق" : "Pending"}
                        </span>
                      )}
                    </div>

                    <span style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms ease",
                      display: "inline-block",
                    }}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Collapsible Details Body */}
                {isExpanded && (
                  <div className="animate-scale-in" style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    borderTop: "1.5px solid var(--border-light)",
                    paddingTop: "14px",
                    marginTop: "12px"
                  }}>
                    {/* Main 3 columns comparison: Purchasing history, selling history, proposed price */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: "16px" }}>
                      {/* Column 1: Purchasing quotes history */}
                      <div style={{ padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
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

                      {/* Column 2: Selling price history */}
                      <div style={{ padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", textAlign: isAr ? "right" : "left" }}>
                          💰 {isAr ? "تاريخ أسعار البيع المعتمدة" : "Approved Selling Price History"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {item.sellingHistory.map((h, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", flexDirection: isAr ? "row-reverse" : "row" }}>
                              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{formatMonthLabel(h.month)}</span>
                              <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                                {h.sell_min !== null ? `${formatCurrency(h.sell_min)} – ${formatCurrency(h.sell_max)}` : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Column 3: Proposed prices (Current month) */}
                      <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.03)", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.15)" }}>
                        <div style={{ fontSize: "11px", fontWeight: 900, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", textAlign: isAr ? "right" : "left" }}>
                          ⚡ {isAr ? "السعر المقترح والأساس" : "Proposed Pricing & Base"}
                        </div>
                        {hasQuote && item.currentSp ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", flexDirection: isAr ? "row-reverse" : "row" }}>
                              <span style={{ color: "var(--text-secondary)" }}>{isAr ? "الأساس المالي المعتمد:" : "Selected Cost Base:"}</span>
                              <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(item.currentSp.strategy === "min" ? item.currentSp.buyMin : item.currentSp.strategy === "max" ? item.currentSp.buyMax : item.currentSp.buyAvg)} ({item.currentSp.strategy})</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "4px", borderTop: "1px dashed var(--border-light)", paddingTop: "4px", flexDirection: isAr ? "row-reverse" : "row" }}>
                              <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{isAr ? "سعر البيع المقترح:" : "Proposed Sell Price:"}</span>
                              <strong style={{ color: "var(--success)", fontSize: "14px", fontWeight: 900 }}>{formatCurrency(item.currentSp.sellMin)} – {formatCurrency(item.currentSp.sellMax)}</strong>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
                            {isAr ? "لم يقم مسؤول التسعير بتقديم أي اقتراح لهذا الشهر بعد." : "No proposed prices submitted by the SC yet."}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reconsideration Note display (if returned) */}
                    {status === "reconsidered" && item.currentSp?.reconsiderNote && (
                      <div style={{
                        padding: "8px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: "8px", fontSize: "11.5px", color: "var(--danger)", display: "flex", gap: "6px",
                        flexDirection: isAr ? "row-reverse" : "row", marginTop: "2px"
                      }}>
                        <strong>{isAr ? "سبب الإرجاع للمراجعة:" : "Reconsideration Reason:"}</strong>
                        <span>{item.currentSp.reconsiderNote}</span>
                      </div>
                    )}

                    {/* Action Buttons for Manager */}
                    {hasQuote && status !== "approved" && (
                      <div style={{
                        display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px",
                        borderTop: "1px solid var(--border-light)", paddingTop: "10px",
                        flexDirection: isAr ? "row-reverse" : "row"
                      }}>
                        <button
                          type="button"
                          onClick={() => handleOpenReconsider(item.itemId)}
                          disabled={pending}
                          className="button button-danger"
                          style={{
                            padding: "6px 14px", fontSize: "12px", cursor: pending ? "not-allowed" : "pointer",
                            display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700
                          }}
                        >
                          <span>↩</span>
                          <span>{isAr ? "إعادة للنظر" : "Reconsider"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApproveItem(item.itemId)}
                          disabled={pending}
                          className="button button-success"
                          style={{
                            padding: "6px 18px", fontSize: "12px", cursor: pending ? "not-allowed" : "pointer",
                            display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700
                          }}
                        >
                          <span>✓</span>
                          <span>{isAr ? "اعتماد السعر" : "Approve Price"}</span>
                        </button>
                      </div>
                    )}

                    {/* Undo option if approved to allow returning to SC */}
                    {hasQuote && status === "approved" && (
                      <div style={{
                        display: "flex", justifyContent: "flex-end", marginTop: "4px",
                        borderTop: "1px solid var(--border-light)", paddingTop: "10px",
                        flexDirection: isAr ? "row-reverse" : "row"
                      }}>
                        <button
                          type="button"
                          onClick={() => handleOpenReconsider(item.itemId)}
                          disabled={pending}
                          className="button button-secondary"
                          style={{
                            padding: "4px 10px", fontSize: "11px", cursor: pending ? "not-allowed" : "pointer",
                            display: "inline-flex", alignItems: "center", gap: "4px"
                          }}
                        >
                          <span>↩</span>
                          <span>{isAr ? "تعديل السعر المعتمد (إعادة للنظر)" : "Revise Approved Price (Reconsider)"}</span>
                        </button>
                      </div>
                    )}
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
