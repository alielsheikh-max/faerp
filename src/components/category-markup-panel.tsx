"use client";

import { useState, useTransition, useEffect } from "react";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { applyCategoryMarkupAction, publishSellingPriceAction } from "@/app/actions/pricing";
import { useI18n } from "@/lib/i18n-context";

type Category = { id: number; name: string };
type Item = {
  id: number;
  category_id: number;
  name: string;
  unit: string;
  is_tiered?: number;
  tier1_max?: number;
  tier1_discount?: number;
  tier2_max?: number;
  tier2_discount?: number;
  tier3_max?: number;
  tier3_discount?: number;
  tier4_max?: number;
  tier4_discount?: number;
  transportation_per_unit?: number;
};
type Props = {
  categories: Category[];
  month: string;
  items?: Item[];
  username?: string;
  defaultCategoryId?: string;
  salesCatalog?: any[];
  prevCatalog?: any[];
  suppliers?: any[];
  priceEntries?: any[];
};

export default function CategoryMarkupPanel({
  categories,
  month,
  items = [],
  username,
  defaultCategoryId,
  salesCatalog = [],
  prevCatalog = [],
  suppliers = [],
  priceEntries = [],
}: Props) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const [categoryId, setCategoryId] = useState<string>(
    defaultCategoryId || (categories[0]?.id ? String(categories[0].id) : "")
  );
  const [strategy, setStrategy]     = useState<"min" | "avg" | "max">("max");
  const [markupType, setMarkupType] = useState<"percent" | "amount" | "divisor">("divisor");
  const [markupMin, setMarkupMin]   = useState("15");
  const [markupMax, setMarkupMax]   = useState("25");
  const [divisor, setDivisor]       = useState("0.77");

  const [pending, startTransition] = useTransition();
  const [result, setResult]         = useState<{ applied: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // Per-item local state overrides (transportation, checked status, divisors)
  type ItemState = {
    itemId: number;
    checked: boolean;
    transportation: number;
    tier1_discount: number;
    tier2_discount: number;
    tier3_discount: number;
    tier4_discount: number;
  };
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>({});
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const selectedCat = categories.find(c => String(c.id) === categoryId);

  // Initialize itemStates when category or items change
  useEffect(() => {
    const selectedCategoryIdNum = categoryId ? parseInt(categoryId, 10) : null;
    const itemsInCat = (items || []).filter(item => item.category_id === selectedCategoryIdNum);
    
    const newStates: Record<number, ItemState> = {};
    for (const item of itemsInCat) {
      const existingSp = salesCatalog?.find(s => s.item_id === item.id);
      
      const transportation = existingSp !== undefined 
        ? existingSp.transportation 
        : (item as any).transportation_per_unit ?? 0;

      const getValidDiv = (val: any, fallback: number): number => {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0 && n < 1) return n;
        return fallback;
      };

      const t1 = existingSp !== undefined 
        ? getValidDiv(existingSp.tier1_discount, getValidDiv(item.tier1_discount, 0.77))
        : getValidDiv(item.tier1_discount, 0.77);
      const t2 = existingSp !== undefined
        ? getValidDiv(existingSp.tier2_discount, getValidDiv(item.tier2_discount, 0.83))
        : getValidDiv(item.tier2_discount, 0.83);
      const t3 = existingSp !== undefined
        ? getValidDiv(existingSp.tier3_discount, getValidDiv(item.tier3_discount, 0.85))
        : getValidDiv(item.tier3_discount, 0.85);
      const t4 = existingSp !== undefined
        ? getValidDiv(existingSp.tier4_discount, getValidDiv(item.tier4_discount, 0.89))
        : getValidDiv(item.tier4_discount, 0.89);

      newStates[item.id] = {
        itemId: item.id,
        checked: true,
        transportation,
        tier1_discount: t1,
        tier2_discount: t2,
        tier3_discount: t3,
        tier4_discount: t4,
      };
    }
    setItemStates(newStates);
  }, [categoryId, items, salesCatalog]);

  // Synchronize global divisor changes to checked items
  useEffect(() => {
    const dVal = parseFloat(divisor);
    if (!isNaN(dVal) && dVal > 0 && dVal < 1) {
      setItemStates(prev => {
        const next = { ...prev };
        let changed = false;
        for (const itemId in next) {
          if (next[itemId].checked && next[itemId].tier1_discount !== dVal) {
            next[itemId] = { ...next[itemId], tier1_discount: dVal };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [divisor]);

  const handleUpdateItemTier = (itemId: number, field: string, val: string) => {
    setItemStates(prev => {
      const next = { ...prev };
      if (next[itemId]) {
        const num = parseFloat(val) || 0;
        next[itemId] = {
          ...next[itemId],
          [field]: num,
        };
      }
      return next;
    });
  };

  const handleToggleItemChecked = (itemId: number) => {
    setItemStates(prev => {
      const next = { ...prev };
      if (next[itemId]) {
        next[itemId] = {
          ...next[itemId],
          checked: !next[itemId].checked,
        };
      }
      return next;
    });
  };

  const handlePublishSingleItem = async (itemId: number) => {
    const state = itemStates[itemId];
    if (!state) return;
    
    setError(null);
    const fd = new FormData();
    fd.set("itemId", String(itemId));
    fd.set("month", month);
    fd.set("strategy", strategy);
    fd.set("markupType", markupType === "divisor" ? "divisor" : markupType === "amount" ? "amount" : "percent");
    fd.set("markupMin", String(state.tier1_discount));
    fd.set("markupMax", String(state.tier2_discount));
    fd.set("createdBy", username || "SC Manager");
    fd.set("tierPricingEnabled", "on");
    fd.set("transportOverride", String(state.transportation));
    fd.set("tier1Max", "100");
    fd.set("tier1Discount", String(state.tier1_discount));
    fd.set("tier2Max", "200");
    fd.set("tier2Discount", String(state.tier2_discount));
    fd.set("tier3Max", "800");
    fd.set("tier3Discount", String(state.tier3_discount));
    fd.set("tier4Discount", String(state.tier4_discount));
    fd.set("changeReason", `Published single item from category workstation by ${username}`);

    try {
      const res = await publishSellingPriceAction(fd);
      if (res?.ok) {
        alert(isAr ? "تم نشر السعر بنجاح!" : "Selling price published successfully!");
      } else {
        alert(res?.error || (isAr ? "فشل النشر" : "Failed to publish"));
      }
    } catch (err) {
      alert(String(err));
    }
  };

  const handleResetItem = (itemId: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setItemStates(prev => {
      const next = { ...prev };
      if (next[itemId]) {
        next[itemId] = {
          ...next[itemId],
          transportation: (item as any).transportation_per_unit ?? 0,
          tier1_discount: (item as any).tier1_discount || 0.77,
          tier2_discount: (item as any).tier2_discount || 0.83,
          tier3_discount: (item as any).tier3_discount || 0.85,
          tier4_discount: (item as any).tier4_discount || 0.89,
        };
      }
      return next;
    });
  };

  const handleApply = () => {
    if (!categoryId) {
      setError(isAr ? "يرجى تحديد فئة مستهدفة" : "Please select a target category.");
      return;
    }
    setError(null);
    setResult(null);

    const minVal = parseFloat(markupMin);
    const maxVal = parseFloat(markupMax);
    const divVal = parseFloat(divisor);

    if (markupType === "divisor") {
      if (isNaN(divVal) || divVal <= 0 || divVal > 1) {
        setError(isAr ? "المقسوم يجب أن يكون بين 0 و 1." : "Divisor value must be between 0 and 1.");
        return;
      }
    } else {
      if (isNaN(minVal) || isNaN(maxVal) || minVal < 0 || maxVal < 0) {
        setError(isAr ? "قيم الهامش يجب أن تكون أرقاماً غير سالبة." : "Markup values must be non-negative numbers.");
        return;
      }
      if (maxVal < minVal) {
        setError(isAr ? "الحد الأقصى للهامش يجب أن يكون أكبر من أو يساوي الحد الأدنى." : "Max markup must be greater than or equal to min markup.");
        return;
      }
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("categoryId", String(categoryId));
      fd.set("month", month);
      fd.set("strategy", strategy);
      fd.set("markupType", markupType);
      if (markupType === "divisor") {
        fd.set("markupMin", String(divVal));
        fd.set("markupMax", String(divVal));
      } else {
        fd.set("markupMin", String(minVal));
        fd.set("markupMax", String(maxVal));
      }
      fd.set("createdBy", username || "SC Manager");

      // Serialize checked items and overrides as itemsData JSON
      const itemsData = Object.values(itemStates).map(s => ({
        itemId: s.itemId,
        checked: s.checked,
        transportation: s.transportation,
        tier1Discount: s.tier1_discount,
        tier2Discount: s.tier2_discount,
        tier3Discount: s.tier3_discount,
        tier4Discount: s.tier4_discount,
      }));
      fd.set("itemsData", JSON.stringify(itemsData));

      const res = await applyCategoryMarkupAction(fd);

      if (res.ok) {
        setResult({
          applied: res.applied ?? 0,
          skipped: res.skipped ?? 0,
          errors: res.errors || [],
        });
      } else {
        setError(res.error || (isAr ? "فشل تطبيق الهامش." : "Failed to apply markup."));
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: isAr ? "right" : "left" }}>
      {/* Context banner */}
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, var(--primary-light), transparent)",
        border: "1.5px solid var(--border-accent)",
        borderRadius: "var(--radius-lg)",
        display: "flex", alignItems: "center", gap: "12px",
        flexDirection: isAr ? "row-reverse" : "row",
      }}>
        <span style={{ fontSize: "22px" }}>⚡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {isAr ? "تسعير الفئات بالجملة" : "Bulk Category Pricing"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {isAr ? (
              <>تطبيق نفس الهامش على <strong>جميع الأصناف</strong> في الفئة لـ <strong>{formatMonthLabel(month)}</strong> بنقرة واحدة. يتم تخطي الأصناف التي لا تحتوي على عروض أسعار موردين هذا الشهر تلقائياً.</>
            ) : (
              <>Apply the same markup to <strong>all items</strong> in a category for <strong>{formatMonthLabel(month)}</strong> in one click. Items with no supplier quotes this month are skipped automatically.</>
            )}
          </div>
        </div>
      </div>

      {/* Form grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        {/* Category */}
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>{isAr ? "الفئة المستهدفة" : "Target Category"}</span>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        {/* Strategy */}
        <label className="field">
          <span>{isAr ? "قاعدة التسعير" : "Pricing Base"}</span>
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value as "min" | "avg" | "max")}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            <option value="min">{isAr ? "أرخص مورد (الأدنى)" : "Cheapest Supplier (Min)"}</option>
            <option value="avg">{isAr ? "متوسط الموردين (المتوسط)" : "Average Supplier (Avg)"}</option>
            <option value="max">{isAr ? "أغلى مورد (الأقصى)" : "Highest Supplier (Max)"}</option>
          </select>
        </label>

        {/* Markup mode */}
        <label className="field">
          <span>{isAr ? "وضع الهامش" : "Markup Mode"}</span>
          <div style={{ display: "flex", gap: "4px", background: "var(--bg-subtle)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)", flexDirection: isAr ? "row-reverse" : "row" }}>
            {(["percent", "amount", "divisor"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMarkupType(m)}
                className={`button ${markupType === m ? "button-primary" : "button-secondary"}`}
                style={{ flex: 1, padding: "6px", fontSize: "11px", borderRadius: "6px", cursor: "pointer" }}
              >
                {m === "percent" ? (isAr ? "% نسبة مئوية" : "% Percent") : m === "amount" ? (isAr ? "ج.م ثابت" : "EGP Fixed") : (isAr ? "÷ مقسوم" : "÷ Divisor")}
              </button>
            ))}
          </div>
        </label>

        {/* Divisor inputs */}
        {markupType === "divisor" ? (
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>{isAr ? "قيمة المقسوم" : "Divisor Value"} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "10px" }}>{isAr ? "(البيع = التكلفة ÷ المقسوم، مثال: 0.77 = هامش 30%)" : "(sell = cost ÷ divisor, e.g. 0.77 = 30% margin)"}</span></span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", flexDirection: isAr ? "row-reverse" : "row" }}>
              <input
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={divisor}
                onChange={e => setDivisor(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 800, fontSize: "16px", width: "120px" }}
              />
              {/* Quick-select tier divisors */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", flexDirection: isAr ? "row-reverse" : "row" }}>
                {[
                  { label: "0.77", desc: "T1" },
                  { label: "0.83", desc: "T2" },
                  { label: "0.85", desc: "T3" },
                  { label: "0.89", desc: "T4" },
                ].map(d => (
                  <button key={d.label} type="button" onClick={() => setDivisor(d.label)}
                    className={`button ${divisor === d.label ? "button-primary" : "button-secondary"}`}
                    style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "6px" }}>
                    {d.desc} {d.label}
                  </button>
                ))}
              </div>
              {parseFloat(divisor) > 0 && parseFloat(divisor) <= 1 && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  ≈ {((1 / parseFloat(divisor) - 1) * 100).toFixed(1)}% {isAr ? "هامش ضمني" : "implied margin"}
                </span>
              )}
            </div>
          </label>
        ) : (
          <>
            {/* Min markup */}
            <label className="field">
              <span>{isAr ? "أقل هامش" : "Min Markup"} {markupType === "percent" ? "%" : `(${locale === "ar" ? "ج.م" : "EGP"})`}</span>
              <input type="number" min="0" step="any" value={markupMin} onChange={e => setMarkupMin(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--success)", fontWeight: 700, fontSize: "14px" }} />
            </label>
            {/* Max markup */}
            <label className="field">
              <span>{isAr ? "أقصى هامش" : "Max Markup"} {markupType === "percent" ? "%" : `(${locale === "ar" ? "ج.م" : "EGP"})`}</span>
              <input type="number" min="0" step="any" value={markupMax} onChange={e => setMarkupMax(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 700, fontSize: "14px" }} />
            </label>
          </>
        )}
      </div>

      {/* Volume Tier Workstation (Permanently visible for info) */}
      <div style={{
        padding: "16px",
        border: "1.5px dashed var(--border-accent)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginTop: "-6px"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", flexDirection: isAr ? "row-reverse" : "row" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: isAr ? "row-reverse" : "row" }}>
            <span style={{ fontSize: "18px" }}>⚡</span>
            <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {isAr ? "خصومات الحجم النشطة للعناصر" : "Active Item Volume Tiers"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>
            {strategy === "min" ? (isAr ? "مظلل: السعر الأدنى" : "Highlighted: Min Price") : strategy === "max" ? (isAr ? "مظلل: السعر الأقصى" : "Highlighted: Max Price") : (isAr ? "مظلل: متوسط السعر" : "Highlighted: Avg Price")}
          </div>
        </div>

        {(() => {
          const selectedCategoryIdNum = categoryId ? parseInt(categoryId, 10) : null;
          const tieredItemsOfCategory = (items || []).filter(
            (item) => item.category_id === selectedCategoryIdNum && item.is_tiered === 1
          );

          if (tieredItemsOfCategory.length === 0) {
            return (
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontStyle: "italic" }}>
                {isAr 
                  ? "لا توجد عناصر ذات تسعير حجمي مكوّنة في هذه الفئة." 
                  : "No volume tiered items configured in this category."}
              </div>
            );
          }

          return (
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "12px", 
              maxHeight: "540px", 
              overflowY: "auto",
              overflowX: "hidden",
              paddingRight: "4px",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(99,102,241,0.3) transparent",
            }}>
              {tieredItemsOfCategory.map((item) => {
                const itemState = itemStates[item.id] || {
                  checked: true,
                  transportation: (item as any).transportation_per_unit ?? 0,
                  tier1_discount: item.tier1_discount || 0.77,
                  tier2_discount: item.tier2_discount || 0.83,
                  tier3_discount: item.tier3_discount || 0.85,
                  tier4_discount: item.tier4_discount || 0.89,
                };

                const itemQuotes = priceEntries
                  .filter(pe => pe.item_id === item.id && pe.month === month && pe.price > 0)
                  .map(pe => ({
                    supplierId: pe.supplier_id,
                    supplierName: pe.supplier_name || suppliers.find(s => s.id === pe.supplier_id)?.name || `Supplier #${pe.supplier_id}`,
                    price: pe.negotiated_price && pe.negotiated_price > 0 ? pe.negotiated_price : pe.price
                  }));

                const prices = itemQuotes.map(q => q.price);
                const buyMin = prices.length > 0 ? Math.min(...prices) : 0;
                const buyMax = prices.length > 0 ? Math.max(...prices) : 0;
                const buyAvg = prices.length > 0 ? parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)) : 0;

                const costBase = strategy === "min" ? buyMin : strategy === "max" ? buyMax : buyAvg;

                const prevItemSp = prevCatalog?.find(s => s.item_id === item.id);

                const getPrevTierPrice = (idx: number) => {
                  if (!prevItemSp) return null;
                  const prevCost = prevItemSp.strategy === "min" ? prevItemSp.buy_min 
                    : prevItemSp.strategy === "max" ? prevItemSp.buy_max 
                    : prevItemSp.buy_avg;
                  if (!prevCost) return null;
                  
                  if (idx === 0) return prevItemSp.sell_min;

                  const prevDiv = idx === 1 ? prevItemSp.tier2_discount
                    : idx === 2 ? prevItemSp.tier3_discount
                    : prevItemSp.tier4_discount;

                  if (!prevDiv) return null;

                  const raw = prevDiv < 1
                    ? (prevCost / prevDiv) + prevItemSp.transportation
                    : (prevItemSp.sell_min - prevItemSp.transportation) * (1 - prevDiv / 100) + prevItemSp.transportation;
                  return Math.ceil(raw / 5) * 5;
                };

                const getTierPrice = (div: number, transport: number) => {
                  if (costBase <= 0 || div <= 0) return 0;
                  const raw = div < 1 
                    ? (costBase / div) + transport
                    : (costBase * (1 - div / 100)) + transport;
                  return Math.ceil(raw / 5) * 5;
                };

                const t1Max = item.tier1_max ?? 100;
                const t2Max = item.tier2_max ?? 200;
                const t3Max = item.tier3_max ?? 300;
                
                const has4 = itemState.tier4_discount > 0 || (item.tier4_discount && item.tier4_discount > 0);

                const tierCells = [
                  { label: isAr ? `T1 (١-${t1Max})` : `T1 (1-${t1Max})`, val: itemState.tier1_discount, field: "tier1_discount", color: "var(--success)" },
                  { label: isAr ? `T2 (${t1Max+1}-${t2Max})` : `T2 (${t1Max+1}-${t2Max})`, val: itemState.tier2_discount, field: "tier2_discount", color: "var(--primary)" },
                  { label: isAr ? `T3 (${t2Max+1}-${t3Max})` : `T3 (${t2Max+1}-${t3Max})`, val: itemState.tier3_discount, field: "tier3_discount", color: "var(--warning)" },
                  ...(has4 ? [{ label: isAr ? `T4 (${t3Max+1}+)` : `T4 (${t3Max+1}+)`, val: itemState.tier4_discount, field: "tier4_discount", color: "var(--danger)" }] : []),
                ];

                return (
                  <div key={item.id} style={{
                    padding: "14px 16px",
                    background: "var(--bg-elevated)",
                    border: `1.5px solid ${itemState.checked ? "var(--border-accent)" : "var(--border-light)"}`,
                    opacity: itemState.checked ? 1 : 0.65,
                    borderRadius: "var(--radius-lg)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    position: "relative",
                  }}>
                    {/* Checkbox and header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: isAr ? "row-reverse" : "row" }}>
                      <input
                        type="checkbox"
                        checked={itemState.checked}
                        onChange={() => handleToggleItemChecked(item.id)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                      
                      <span
                        onClick={() => window.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: item.id } }))}
                        style={{
                          fontSize: "13.5px", fontWeight: 800, color: "var(--text-primary)", cursor: "pointer",
                          textDecoration: "underline", textDecorationStyle: "dotted", flex: 1
                        }}
                        title={isAr ? "انقر لعرض تفاصيل الصنف" : "Click to view item details"}
                      >
                        {item.name}
                      </span>
                      
                      <span className="badge badge-strong" style={{ fontSize: "9px" }}>{item.unit}</span>
                      
                      {/* 3-Dots dropdown menu */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-muted)", padding: "0 8px"
                          }}
                        >⋮</button>
                        {activeMenuId === item.id && (
                          <div style={{
                            position: "absolute", right: isAr ? "auto" : 0, left: isAr ? 0 : "auto", top: "24px", zIndex: 10,
                            background: "var(--bg-elevated)", border: "1px solid var(--border)",
                            borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            display: "flex", flexDirection: "column", minWidth: "150px", padding: "4px"
                          }}>
                            <button
                              type="button"
                              onClick={() => {
                                handlePublishSingleItem(item.id);
                                setActiveMenuId(null);
                              }}
                              style={{ padding: "8px 12px", fontSize: "12px", border: "none", background: "none", textAlign: isAr ? "right" : "left", cursor: "pointer", borderRadius: "6px", color: "var(--primary)", fontWeight: 700 }}
                            >⚡ {isAr ? "نشر الصنف منفصلاً" : "Publish Item Only"}</button>
                            <button
                              type="button"
                              onClick={() => {
                                handleResetItem(item.id);
                                setActiveMenuId(null);
                              }}
                              style={{ padding: "8px 12px", fontSize: "12px", border: "none", background: "none", textAlign: isAr ? "right" : "left", cursor: "pointer", borderRadius: "6px", color: "var(--text-secondary)" }}
                            >🔄 {isAr ? "إعادة تعيين الافتراضيات" : "Reset to Presets"}</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Supplier Quotes & Active Strategy highlight */}
                    {itemQuotes.length === 0 ? (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                        ⚠️ {isAr ? "لا توجد أسعار موردين نشطة هذا الشهر" : "No active supplier quotes for this month"}
                      </div>
                    ) : (
                      <div style={{
                        display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center",
                        background: "var(--bg-subtle)", padding: "6px 10px", borderRadius: "6px",
                        fontSize: "11px", flexDirection: isAr ? "row-reverse" : "row"
                      }}>
                        <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>{isAr ? "عروض الأسعار:" : "Quotes:"}</span>
                        {/* Min quote */}
                        <span style={{
                          padding: "2px 6px", borderRadius: "4px",
                          border: strategy === "min" ? "1.5px solid var(--success)" : "1px solid var(--border)",
                          background: strategy === "min" ? "rgba(16,185,129,0.08)" : "transparent",
                          fontWeight: strategy === "min" ? 800 : 500
                        }}>
                          Min: {formatCurrency(buyMin)}
                        </span>
                        {/* Avg quote */}
                        <span style={{
                          padding: "2px 6px", borderRadius: "4px",
                          border: strategy === "avg" ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                          background: strategy === "avg" ? "rgba(99,102,241,0.08)" : "transparent",
                          fontWeight: strategy === "avg" ? 800 : 500
                        }}>
                          Avg: {formatCurrency(buyAvg)}
                        </span>
                        {/* Max quote */}
                        <span style={{
                          padding: "2px 6px", borderRadius: "4px",
                          border: strategy === "max" ? "1.5px solid var(--warning)" : "1px solid var(--border)",
                          background: strategy === "max" ? "rgba(245,158,11,0.08)" : "transparent",
                          fontWeight: strategy === "max" ? 800 : 500
                        }}>
                          Max: {formatCurrency(buyMax)}
                        </span>
                        
                        {/* Suppliers click details */}
                        <span style={{ marginInlineStart: "auto", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {itemQuotes.map(q => (
                            <span
                              key={q.supplierId}
                              onClick={() => window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: q.supplierId } }))}
                              style={{
                                cursor: "pointer", textDecoration: "underline", color: "var(--primary)",
                                fontSize: "10px", fontWeight: 600
                              }}
                              title={isAr ? "انقر لعرض تفاصيل المورد" : "Click to view supplier details"}
                            >
                              {q.supplierName}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}

                    {/* Editable Transportation and Note */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", flexDirection: isAr ? "row-reverse" : "row" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                        <span>🚚 {isAr ? "تكلفة النقل (ج.م):" : "Transportation (EGP):"}</span>
                        <input
                          type="number"
                          value={itemState.transportation}
                          onChange={e => handleUpdateItemTier(item.id, "transportation", e.target.value)}
                          style={{
                            width: "70px", padding: "4px 8px", borderRadius: "6px",
                            border: "1px solid var(--border)", background: "var(--bg-elevated)",
                            color: "var(--text-primary)", fontWeight: 800, fontSize: "12px", textAlign: "center"
                          }}
                        />
                      </label>
                      
                      {costBase > 0 && (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                          {isAr ? "تكلفة الأساس المحددة:" : "Active Cost Base:"} <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(costBase)}</strong>
                        </span>
                      )}
                    </div>

                    {/* Tier grid */}
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${tierCells.length}, 1fr)`, gap: "8px" }}>
                      {tierCells.map((tc, idx) => {
                        const prevPrice = getPrevTierPrice(idx);
                        const newPrice = getTierPrice(tc.val, itemState.transportation);
                        return (
                          <div key={idx} style={{
                            background: "var(--bg-subtle)",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid var(--border-light)",
                            borderLeft: isAr ? "none" : `4px solid ${tc.color}`,
                            borderRight: isAr ? `4px solid ${tc.color}` : "none",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}>
                            <div style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 800, textAlign: "center" }}>{tc.label}</div>
                            
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px", flexDirection: isAr ? "row-reverse" : "row" }}>
                              {/* Prev price */}
                              <div style={{ fontSize: "10px", color: "var(--text-secondary)", textAlign: isAr ? "right" : "left" }}>
                                <div style={{ scale: "0.8", transformOrigin: isAr ? "right" : "left", color: "var(--text-muted)", marginBottom: "2px" }}>PREV</div>
                                <strong>{prevPrice !== null && prevPrice > 0 ? formatCurrency(prevPrice) : "—"}</strong>
                              </div>

                              {/* Input divisor */}
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={tc.val}
                                  onChange={e => handleUpdateItemTier(item.id, tc.field, e.target.value)}
                                  style={{
                                    width: "50px", padding: "3px 4px", fontSize: "11px", fontWeight: 800,
                                    textAlign: "center", borderRadius: "6px", border: "1px solid var(--border)",
                                    background: "var(--bg-elevated)", color: tc.color
                                  }}
                                />
                              </div>

                              {/* New price */}
                              <div style={{ textAlign: isAr ? "left" : "right" }}>
                                <div style={{ scale: "0.8", transformOrigin: isAr ? "left" : "right", color: "var(--text-muted)", marginBottom: "2px" }}>NEW</div>
                                <strong style={{ color: tc.color, fontSize: "11.5px" }}>{newPrice > 0 ? formatCurrency(newPrice) : "—"}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Preview strip */}
      {selectedCat && (
        <div style={{
          padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: "var(--radius)",
          border: "1px solid var(--border-light)", fontSize: "12px", color: "var(--text-secondary)",
          display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
          flexDirection: isAr ? "row-reverse" : "row",
        }}>
          <span>📦</span>
          <strong style={{ color: "var(--text-primary)" }}>{selectedCat.name}</strong>
          <span>·</span>
          <span>{formatMonthLabel(month)}</span>
          <span>·</span>
          <span>{isAr ? "الاستراتيجية:" : "Strategy:"} <strong>{strategy.toUpperCase()}</strong></span>
          <span>·</span>
          <span>{isAr ? "الهامش:" : "Markup:"} {markupType === "divisor"
            ? <strong style={{ color: "var(--primary)" }}>÷ {divisor}</strong>
            : <><strong style={{ color: "var(--success)" }}>{markupMin}{markupType === "percent" ? "%" : ` ${isAr ? "ج.م" : "EGP"}`}</strong>
              {" → "}
              <strong style={{ color: "var(--primary)" }}>{markupMax}{markupType === "percent" ? "%" : ` ${isAr ? "ج.م" : "EGP"}`}</strong></>}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", background: "var(--danger-light)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "var(--radius)", fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          padding: "14px 16px",
          background: result.applied > 0 ? "var(--success-light)" : "var(--warning-light)",
          border: `1px solid ${result.applied > 0 ? "rgba(16,185,129,0.3)" : "rgba(217,119,6,0.3)"}`,
          borderRadius: "var(--radius)",
        }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: result.errors.length ? "10px" : "0", flexDirection: isAr ? "row-reverse" : "row" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{isAr ? "تم التطبيق" : "Applied"}</span>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--success)", lineHeight: 1 }}>{result.applied}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{isAr ? "تم التخطي" : "Skipped"}</span>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--warning)", lineHeight: 1 }}>{result.skipped}</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Apply button */}
      <button
        type="button"
        onClick={handleApply}
        disabled={pending}
        className="button button-primary"
        style={{ padding: "11px 24px", fontSize: "13px", cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.7 : 1, alignSelf: "flex-start" }}
      >
        {pending ? (isAr ? "⏳ جاري التطبيق..." : "⏳ Applying…") : (isAr ? "⚡ تطبيق على جميع الأصناف في الفئة" : `⚡ Apply to All Items in Category`)}
      </button>
    </div>
  );
}
