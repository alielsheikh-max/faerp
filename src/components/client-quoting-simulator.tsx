"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";

type CatalogItem = {
  item_id: number;
  item_name: string;
  unit: string;
  category_name: string;
  sell_min: number | null;
  sell_max: number | null;
  is_tiered?: number;
  tier_pricing_enabled?: number;
  tier1_max?: number;
  tier1_discount?: number;
  tier2_max?: number;
  tier2_discount?: number;
  tier3_max?: number;
  tier3_discount?: number;
  tier4_max?: number;
  tier4_discount?: number;
  moq: number;
  transportation_per_unit: number;
};

type ClientQuotingSimulatorProps = {
  initialRows: CatalogItem[];
  month: string;
};

export default function ClientQuotingSimulator({ initialRows, month }: ClientQuotingSimulatorProps) {
  const { locale, isRTL } = useI18n();

  // Simulator State variables
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState<number>(100);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [clientName, setClientName] = useState<string>("");
  const [showMOQDialog, setShowMOQDialog] = useState<boolean>(false);
  const [sessionQuotes, setSessionQuotes] = useState<Array<{
    id: number;
    itemName: string;
    unit: string;
    qty: number;
    price: number;
    total: number;
    transportationCost: number;
    grandTotal: number;
    clientPaysTrans: boolean;
    moq: number;
    minAllowed: number;
    maxAllowed: number;
    status: "approved" | "low" | "high";
    clientName: string;
  }>>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const selectedItem = initialRows.find((row) => String(row.item_id) === selectedItemId);
  const isPublished = selectedItem && selectedItem.sell_min !== null && selectedItem.sell_max !== null;
  const isItemTiered = !!(selectedItem && selectedItem.is_tiered === 1 && selectedItem.tier_pricing_enabled === 1);

  // Sync target price on item selection change
  useEffect(() => {
    if (selectedItem && selectedItem.sell_min !== null && selectedItem.sell_max !== null) {
      if (isItemTiered) {
        const base   = selectedItem.sell_min;
        const t1Max  = selectedItem.tier1_max ?? 100;
        const t1Disc = selectedItem.tier1_discount ?? 0;
        const t2Max  = selectedItem.tier2_max ?? 200;
        const t2Disc = selectedItem.tier2_discount ?? 5;
        const t3Max  = selectedItem.tier3_max ?? 300;
        const t3Disc = selectedItem.tier3_discount ?? 10;
        const t4Max  = selectedItem.tier4_max ?? 0;
        const t4Disc = selectedItem.tier4_discount ?? 0;
        let discount = 0;
        if (qty <= t1Max) {
          discount = t1Disc;
        } else if (qty <= t2Max) {
          discount = t2Disc;
        } else if (qty <= t3Max) {
          discount = t3Disc;
        } else if (t4Disc > 0) {
          discount = t4Disc;
        } else {
          discount = t3Disc;
        }
        setTargetPrice(Number((base * (1 - discount / 100)).toFixed(2)));
      } else {
        setTargetPrice(Number(((selectedItem.sell_min + selectedItem.sell_max) / 2).toFixed(2)));
      }
    } else {
      setTargetPrice(0);
    }
    setShowMOQDialog(false);
  }, [selectedItemId, selectedItem, qty, isItemTiered]);

  const handlePriceBlur = () => {
    if (isItemTiered) return;
    if (selectedItem && selectedItem.sell_min !== null && selectedItem.sell_max !== null) {
      if (targetPrice < selectedItem.sell_min) {
        setTargetPrice(selectedItem.sell_min);
      } else if (targetPrice > selectedItem.sell_max) {
        setTargetPrice(selectedItem.sell_max);
      }
    }
  };

  const addQuote = () => {
    if (!selectedItem || selectedItem.sell_min === null || selectedItem.sell_max === null) return;

    const isUnderMOQ = selectedItem.moq > 0 && qty < selectedItem.moq;
    if (isUnderMOQ) {
      setShowMOQDialog(true);
      return;
    }

    proceedAddQuote(false);
  };

  const proceedAddQuote = (clientPaysShipping: boolean) => {
    if (!selectedItem || selectedItem.sell_min === null || selectedItem.sell_max === null) return;
    
    let finalPrice = targetPrice;
    let status: "approved" | "low" | "high" = "approved";

    if (isItemTiered) {
      const base   = selectedItem.sell_min;
      const t1Max  = selectedItem.tier1_max ?? 100;
      const t1Disc = selectedItem.tier1_discount ?? 0;
      const t2Max  = selectedItem.tier2_max ?? 200;
      const t2Disc = selectedItem.tier2_discount ?? 5;
      const t3Max  = selectedItem.tier3_max ?? 300;
      const t3Disc = selectedItem.tier3_discount ?? 10;
      const t4Max  = selectedItem.tier4_max ?? 0;
      const t4Disc = selectedItem.tier4_discount ?? 0;
      let discount = 0;
      if (qty <= t1Max) {
        discount = t1Disc;
      } else if (qty <= t2Max) {
        discount = t2Disc;
      } else if (qty <= t3Max) {
        discount = t3Disc;
      } else if (t4Disc > 0) {
        discount = t4Disc;
      } else {
        discount = t3Disc;
      }
      finalPrice = Number((base * (1 - discount / 100)).toFixed(2));
      status = "approved";
    } else {
      if (finalPrice < selectedItem.sell_min) {
        finalPrice = selectedItem.sell_min;
      } else if (finalPrice > selectedItem.sell_max) {
        finalPrice = selectedItem.sell_max;
      }
      setTargetPrice(finalPrice);
      
      if (finalPrice < selectedItem.sell_min) {
        status = "low";
      } else if (finalPrice > selectedItem.sell_max) {
        status = "high";
      }
    }

    const isUnderMOQ = selectedItem.moq > 0 && qty < selectedItem.moq;
    // Transportation is always client-paid when under MOQ — not tracked in simulator UI
    const transportationCost = 0;

    const newQuote = {
      id: Date.now(),
      itemName: selectedItem.item_name,
      unit: selectedItem.unit,
      qty,
      price: finalPrice,
      total: qty * finalPrice,
      transportationCost,
      grandTotal: qty * finalPrice,
      clientPaysTrans: isUnderMOQ,
      moq: selectedItem.moq,
      minAllowed: selectedItem.sell_min,
      maxAllowed: isItemTiered ? finalPrice : selectedItem.sell_max,
      status,
      clientName: clientName.trim()
    };

    setSessionQuotes([newQuote, ...sessionQuotes]);
    setShowMOQDialog(false);
  };

  const copyQuote = (quote: typeof sessionQuotes[0]) => {
    const statusText = quote.status === "approved" ? "APPROVED" : quote.status === "low" ? "WARN: BELOW MIN" : "WARN: ABOVE MAX";
    const clientLine = quote.clientName ? `Client Name: ${quote.clientName}\n` : "";
    
    let transLine = "";
    if (quote.transportationCost > 0) {
      transLine = `Transportation Cost: EGP ${quote.transportationCost.toLocaleString("en-US", { minimumFractionDigits: 2 })} (Paid by Client due to under-MOQ)\n` +
                  `Total Value (inc. Trans.): EGP ${quote.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
    } else {
      transLine = `Total Quote Value: EGP ${quote.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
    }

    const text = `--- FAERP Client Quote Summary ---\n` +
      clientLine +
      `Product: ${quote.itemName} (${quote.unit})\n` +
      `Quantity: ${quote.qty}\n` +
      `Target Resell Price: EGP ${quote.price.toFixed(2)} / unit\n` +
      `MOQ: ${quote.moq}\n` +
      transLine +
      `Approved Min/Max limits: EGP ${quote.minAllowed.toFixed(2)} - EGP ${quote.maxAllowed.toFixed(2)}\n` +
      `Compliance Status: ${statusText}\n` +
      `Generated: ${new Date().toLocaleDateString()}\n` +
      `----------------------------------`;
    
    navigator.clipboard.writeText(text);
    alert(locale === "ar" ? "تم نسخ عرض السعر إلى الحافظة!" : "Quote copied to clipboard!");
  };

  // Localized texts
  const t = {
    title: locale === "ar" ? "محاكي عروض أسعار العملاء" : "Client Deal Quoting Simulator",
    eyebrow: locale === "ar" ? "مساعد مبيعات تفاعلي" : "Interactive sales assistant",
    realTime: locale === "ar" ? "إجمالي فوري" : "Real-Time Totals",
    clientNameLabel: locale === "ar" ? "اسم العميل (اختياري)" : "Client Name (Optional)",
    clientNamePlaceholder: locale === "ar" ? "مثال: شركة النصر" : "e.g. Acme Corp",
    selectLabel: locale === "ar" ? "1. اختر المنتج المعتمد" : "1. Select Approved Product",
    chooseOption: locale === "ar" ? "-- اختر المنتج للتسعير --" : "-- Choose Product to Quote --",
    qtyLabel: locale === "ar" ? "2. كمية الصفقة" : "2. Deal Quantity",
    priceLabel: locale === "ar" ? "3. سعر الوحدة المستهدف (جنيه)" : "3. Target Unit Price (EGP)",
    addBtn: locale === "ar" ? "إضافة العرض إلى لوحة الصفقات الحالية" : "Add Quote to Session Deal Board",
    totalVal: locale === "ar" ? "إجمالي قيمة الصفقة" : "Total deal value",
    withinLimits: locale === "ar" ? "✓ ضمن حدود التسعير المعتمدة" : "✓ Within Approved Pricing Limits",
    underPricing: locale === "ar" ? "⚠️ سعر أقل من الحد الأدنى المعين" : "⚠️ Under Pricing",
    aboveMax: locale === "ar" ? "⚠️ سعر أعلى من الحد الأقصى المعين" : "⚠️ Above Max Approved Limit",
    minLabel: locale === "ar" ? "أدنى إجمالي معتمد" : "Min Approved Total",
    maxLabel: locale === "ar" ? "أقصى إجمالي معتمد" : "Max Approved Total",
    selectPrompt: locale === "ar" ? "اختر منتجًا معتمدًا من القائمة لمحاكاة كميات الصفقة وعرض الإجماليات." : "Select an approved item from the list to simulate deal quantities, check markup compliance, and export custom price quotes.",
    notPublishedWarning: locale === "ar" 
      ? `⚠️ هذا المنتج ليس لديه سعر معتمد منشور لشهر ${month} بعد. يرجى التواصل مع مدير التسعير.`
      : `⚠️ This item does not have a published price for ${month} yet. Please contact the pricing manager.`,
    activeBoard: locale === "ar" ? "لوحة صفقات الجلسة النشطة" : "Active Session Deal Board",
    clearBoard: locale === "ar" ? "مسح اللوحة" : "Clear Board",
    sessionWarning: locale === "ar" 
      ? "* ملاحظة: هذه القائمة مؤقتة وسيتم مسحها عند تسجيل الخروج أو تحديث الصفحة."
      : "* Note: This list is temporary and will be cleared when you sign out or refresh the page.",
    colClient: locale === "ar" ? "العميل" : "Client",
    colProduct: locale === "ar" ? "المنتج" : "Product",
    colQty: locale === "ar" ? "الكمية" : "Quantity",
    colPrice: locale === "ar" ? "سعر الوحدة المستهدف" : "Target Unit Price",
    colTotal: locale === "ar" ? "إجمالي الصفقة" : "Deal Total",
    colLimits: locale === "ar" ? "المسموح به (أدنى / أقصى)" : "Min / Max Allowed",
    colCompliance: locale === "ar" ? "الامتثال" : "Compliance",
    colAction: locale === "ar" ? "الإجراء" : "Action",
    copyBtn: locale === "ar" ? "نسخ نص عرض السعر" : "Copy Quote Text",
    badgeApproved: locale === "ar" ? "معتمد" : "Approved",
    badgeBelow: locale === "ar" ? "أقل من الأدنى" : "Below Min",
    badgeAbove: locale === "ar" ? "أعلى من الأقصى" : "Above Max",
    noPriceOption: locale === "ar" ? " - لا يوجد سعر منشور" : " - No Published Price",
    toggleShow: locale === "ar" ? "عرض" : "Show",
    toggleHide: locale === "ar" ? "إخفاء" : "Hide"
  };

  return (
    <section className="panel animate-fade-in" style={{ marginBottom: "24px" }}>
      <div 
        className="panel-header" 
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {t.title}
            <span style={{ fontSize: "14px", color: "var(--text-muted)", transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 150ms" }}>
              {isRTL ? "◀" : "▶"}
            </span>
          </h2>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
          <span className="badge badge-strong">{t.realTime}</span>
          <button 
            type="button" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="button button-secondary"
            style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600 }}
          >
            {isCollapsed ? t.toggleShow : t.toggleHide}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="quote-simulator-card animate-fade-in" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "24px" }}>

        <div className="quote-simulator-grid">
          {/* Inputs Column */}
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <label className="field">
              <span>{t.clientNameLabel}</span>
              <input 
                type="text" 
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={t.clientNamePlaceholder}
              />
            </label>

            <label className="field">
              <span>{t.selectLabel}</span>
              <select 
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">{t.chooseOption}</option>
                {initialRows.map((row) => (
                  <option key={row.item_id} value={row.item_id}>
                    {row.item_name} ({row.unit}){row.sell_min === null ? t.noPriceOption : ""}
                  </option>
                ))}
              </select>
            </label>

            {selectedItemId && !isPublished && (
              <div style={{ 
                padding: "12px 16px", 
                backgroundColor: "rgba(239, 68, 68, 0.1)", 
                border: "1px solid var(--danger)", 
                borderRadius: "8px",
                color: "var(--danger)",
                fontSize: "13px",
                fontWeight: 500,
                marginTop: "4px"
              }}>
                {t.notPublishedWarning}
              </div>
            )}

            {selectedItem && (
              <div className="animate-fade-in" style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: "16px", 
                padding: "12px 16px", 
                backgroundColor: "var(--bg-elevated)", 
                border: "1px solid var(--border-medium)", 
                borderRadius: "8px",
                marginTop: "-4px" 
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {locale === "ar" ? "الحد الأدنى للطلب (MOQ)" : "Min Order Qty (MOQ)"}
                  </span>
                  <strong style={{ fontSize: "15px", color: "var(--warning)" }}>
                    {selectedItem.moq} {selectedItem.unit}
                  </strong>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {locale === "ar" ? "تكلفة الشحن" : "Shipping"}
                  </span>
                  <strong style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {locale === "ar" ? "يتحملها العميل إن قل عن MOQ" : "Client-paid if below MOQ"}
                  </strong>
                </div>
              </div>
            )}

            {selectedItem && selectedItem.moq > 0 && qty < selectedItem.moq && (
              <div className="animate-fade-in" style={{ 
                padding: "12px 16px", 
                backgroundColor: "rgba(245, 158, 11, 0.12)", 
                border: "1px solid var(--warning)", 
                borderRadius: "8px",
                color: "var(--warning)",
                fontSize: "13px",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 0 10px rgba(245, 158, 11, 0.1)",
                marginTop: "4px"
              }}>
                <span style={{ fontSize: "16px" }}>🚚</span>
                <div style={{ textAlign: "left" }}>
                  {locale === "ar" ? (
                    <>
                      <strong>تنبيه:</strong> الكمية ({qty} {selectedItem.unit}) أقل من الحد الأدنى للطلب (<strong>{selectedItem.moq} {selectedItem.unit}</strong>).<br />
                      سيتحمل العميل تكلفة النقل والشحن بالكامل.
                    </>
                  ) : (
                    <>
                      <strong>Notice:</strong> Quantity ({qty} {selectedItem.unit}) is below the Minimum Order Quantity (<strong>{selectedItem.moq} {selectedItem.unit}</strong>).<br />
                      <span style={{ fontSize: "12px", opacity: 0.85 }}>The client will be responsible for transportation costs.</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "16px" 
            }}>
              <label className="field">
                <span>{t.qtyLabel}</span>
                <input 
                  type="number" 
                  min="1" 
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                  disabled={!isPublished}
                />
              </label>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <label className="field" style={{ marginBottom: "4px" }}>
                  <span>{t.priceLabel}</span>
                  <input 
                    type="number" 
                    step="any"
                    min={selectedItem?.sell_min ?? 0}
                    max={selectedItem?.sell_max ?? 0}
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                    onBlur={handlePriceBlur}
                    disabled={!isPublished || isItemTiered}
                  />
                </label>
                {isPublished && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {isItemTiered ? (
                      <span style={{ color: "var(--success)", fontWeight: 600 }}>
                        {locale === "ar"
                          ? `✓ تطبيق تسعير الحجم (خصم ${qty <= (selectedItem.tier1_max ?? 100) ? (selectedItem.tier1_discount ?? 0) : qty <= (selectedItem.tier2_max ?? 200) ? (selectedItem.tier2_discount ?? 5) : (selectedItem.tier3_discount ?? 10)}%)`
                          : `✓ Volume pricing applied (${qty <= (selectedItem.tier1_max ?? 100) ? (selectedItem.tier1_discount ?? 0) : qty <= (selectedItem.tier2_max ?? 200) ? (selectedItem.tier2_discount ?? 5) : (selectedItem.tier3_discount ?? 10)}% discount)`}
                      </span>
                    ) : (
                      locale === "ar" 
                        ? `النطاق المعتمد: ${formatCurrency(selectedItem.sell_min)} - ${formatCurrency(selectedItem.sell_max)}` 
                        : `Approved Range: ${formatCurrency(selectedItem.sell_min)} - ${formatCurrency(selectedItem.sell_max)}`
                    )}
                  </span>
                )}
              </div>

            </div>

            <button 
              type="button" 
              className="button button-primary button-block"
              onClick={addQuote}
              disabled={!isPublished}
              style={{ marginTop: "8px" }}
            >
              {t.addBtn}
            </button>
          </div>

          {/* Live Metrics Column */}
          <div className="simulation-results">
            {selectedItem ? (
              isPublished ? (
                <>
                  <div style={{ textAlign: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px" }}>
                    <span className="eyebrow" style={{ fontSize: "11px" }}>{t.totalVal}</span>
                    <h1 style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-primary)", margin: "8px 0" }}>
                        {formatCurrency(qty * targetPrice)}
                      </h1>
                      {selectedItem.moq > 0 && qty < selectedItem.moq && (
                        <div style={{ 
                          fontSize: "11px", fontWeight: "600", color: "var(--warning)",
                          backgroundColor: "rgba(245,158,11,0.1)",
                          border: "1px solid rgba(245,158,11,0.3)",
                          borderRadius: "6px", padding: "5px 10px", marginTop: "6px"
                        }}>
                          🚚 {locale === "ar" ? "ملاحظة: تكلفة النقل على العميل" : "Note: Client pays transportation"}
                        </div>
                      )}
                    <div style={{ marginTop: "8px" }}>
                      {isItemTiered ? (
                        <span className="badge badge-success">{locale === "ar" ? "✓ تسعير الحجم النشط" : "✓ Active Volume Tier"}</span>
                      ) : targetPrice >= (selectedItem.sell_min ?? 0) && targetPrice <= (selectedItem.sell_max ?? 0) ? (
                        <span className="badge badge-success">{t.withinLimits}</span>
                      ) : targetPrice < (selectedItem.sell_min ?? 0) ? (
                        <span className="badge badge-danger">{t.underPricing} (Approved Min: {formatCurrency(selectedItem.sell_min)})</span>
                      ) : (
                        <span className="badge badge-warning">{t.aboveMax} (Max: {formatCurrency(selectedItem.sell_max)})</span>
                      )}
                    </div>
                  </div>

                  {isItemTiered ? (
                    <div style={{ 
                      padding: "12px", 
                      background: "linear-gradient(135deg, var(--primary-light), transparent)", 
                      border: "1px solid var(--border-accent)",
                      borderRadius: "8px", 
                      fontSize: "11.5px", 
                      marginTop: "12px", 
                      lineHeight: 1.5,
                      textAlign: "left"
                    }}>
                      <strong style={{ display: "block", marginBottom: "4px", color: "var(--primary)" }}>
                        {locale === "ar" ? "قواعد خصم الحجم النشطة:" : "Active Volume Discount Tiers:"}
                      </strong>
                      • {locale === "ar" ? `من 0 إلى ${selectedItem.tier1_max ?? 100}: السعر الأساسي ${formatCurrency(selectedItem.sell_min)} (خصم ${selectedItem.tier1_discount ?? 0}%)` : `0 - ${selectedItem.tier1_max ?? 100}: Base price ${formatCurrency(selectedItem.sell_min)} (${selectedItem.tier1_discount ?? 0}% discount)`}
                      <br />
                      • {locale === "ar" ? `من ${(selectedItem.tier1_max ?? 100) + 1} إلى ${selectedItem.tier2_max ?? 200}: السعر الأساسي ${formatCurrency(selectedItem.sell_min)} (خصم ${selectedItem.tier2_discount ?? 5}%)` : `${(selectedItem.tier1_max ?? 100) + 1} - ${selectedItem.tier2_max ?? 200}: Base price ${formatCurrency(selectedItem.sell_min)} (${selectedItem.tier2_discount ?? 5}% discount)`}
                      <br />
                      • {locale === "ar" ? `أكثر من ${selectedItem.tier2_max ?? 200}: السعر الأساسي ${formatCurrency(selectedItem.sell_min)} (خصم ${selectedItem.tier3_discount ?? 10}%)` : `${(selectedItem.tier2_max ?? 200) + 1}+: Base price ${formatCurrency(selectedItem.sell_min)} (${selectedItem.tier3_discount ?? 10}% discount)`}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", paddingTop: "8px" }}>
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>{t.minLabel}</span>
                        <strong style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
                          {formatCurrency(qty * (selectedItem.sell_min ?? 0))}
                        </strong>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>{t.maxLabel}</span>
                        <strong style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
                          {formatCurrency(qty * (selectedItem.sell_max ?? 0))}
                        </strong>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                  <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>⚠️</span>
                  {t.notPublishedWarning}
                </div>
              )
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>📊</span>
                {t.selectPrompt}
              </div>
            )}
          </div>
        </div>

        {/* Deal Board History */}
        {sessionQuotes.length > 0 && (
          <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-light)", paddingTop: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700" }}>{t.activeBoard} ({sessionQuotes.length})</h3>
              <button 
                onClick={() => setSessionQuotes([])} 
                className="button button-secondary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                {t.clearBoard}
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "14px", marginTop: "2px" }}>
              {t.sessionWarning}
            </p>
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: "13px" }}>
                <thead>
                  <tr>
                    {sessionQuotes.some(q => q.clientName) && <th>{t.colClient}</th>}
                    <th>{t.colProduct}</th>
                    <th>{t.colQty}</th>
                    <th>{t.colPrice}</th>
                    <th>{t.colTotal}</th>
                    <th>{t.colLimits}</th>
                    <th>{t.colCompliance}</th>
                    <th>{t.colAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionQuotes.map((quote) => (
                    <tr key={quote.id}>
                      {sessionQuotes.some(q => q.clientName) && (
                        <td>{quote.clientName || <span className="muted">—</span>}</td>
                      )}
                      <td><strong>{quote.itemName}</strong> <span className="muted">({quote.unit})</span></td>
                      <td>{quote.qty}</td>
                      <td>{formatCurrency(quote.price)}</td>
                      <td>
                        <div className="cell-stack">
                          <strong style={{ color: quote.status === "approved" ? "var(--success)" : quote.status === "low" ? "var(--danger)" : "var(--warning)" }}>
                            {formatCurrency(quote.grandTotal)}
                          </strong>
                          {quote.clientPaysTrans && (
                              <div style={{ fontSize: "11px", color: "var(--warning)", marginTop: "2px" }}>
                                🚚 {locale === "ar" ? "النقل على العميل" : "Client pays transport"}
                              </div>
                            )}
                        </div>
                      </td>
                      <td>{formatCurrency(quote.minAllowed)} - {formatCurrency(quote.maxAllowed)}</td>
                      <td>
                        {quote.status === "approved" ? (
                          <span className="badge badge-success" style={{ padding: "4px 8px", fontSize: "10px" }}>{t.badgeApproved}</span>
                        ) : quote.status === "low" ? (
                          <span className="badge badge-danger" style={{ padding: "4px 8px", fontSize: "10px" }}>{t.badgeBelow}</span>
                        ) : (
                          <span className="badge badge-warning" style={{ padding: "4px 8px", fontSize: "10px" }}>{t.badgeAbove}</span>
                        )}
                      </td>
                      <td>
                        <button 
                          onClick={() => copyQuote(quote)} 
                          className="button button-secondary"
                          style={{ padding: "6px 10px", fontSize: "11px" }}
                        >
                          {t.copyBtn}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )}

      {showMOQDialog && selectedItem && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          backdropFilter: "blur(4px)"
        }}>
          <div className="quote-simulator-card animate-fade-in" style={{
            width: "100%",
            maxWidth: "480px",
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid var(--border-medium)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            backgroundColor: "var(--bg-elevated)",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🚚</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
              {locale === "ar" ? "تأكيد تكلفة الشحن" : "Shipping Cost Confirmation"}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>
              {locale === "ar" ? (
                <>
                  الكمية المطلوبة (<strong>{qty} {selectedItem.unit}</strong>) أقل من الحد الأدنى للطلب (<strong>{selectedItem.moq} {selectedItem.unit}</strong>).
                  <br /><br />
                  سيتحمل العميل تكلفة النقل والشحن الإضافية بالكامل.
                  <br /><br />
                  هل تريد المتابعة وإضافة العرض؟
                </>
              ) : (
                <>
                  The requested quantity of <strong>{qty} {selectedItem.unit}</strong> is below the Minimum Order Quantity (MOQ) of <strong>{selectedItem.moq} {selectedItem.unit}</strong>.
                  <br /><br />
                  The client will be responsible for all transportation costs on this order.
                  <br /><br />
                  Do you want to proceed and add this quote?
                </>
              )}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                onClick={() => proceedAddQuote(true)}
                className="button button-primary"
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                {locale === "ar" ? "نعم، متابعة" : "Yes, Add Quote"}
              </button>
              <button 
                onClick={() => setShowMOQDialog(false)}
                className="button button-secondary"
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
  </section>
  );
}
