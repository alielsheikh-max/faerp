"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ItemCombobox } from "./item-combobox";

type SalesRow = {
  item_id: number;
  item_name: string;
  unit: string;
  category_name: string;
  strategy: string | null;
  buy_min: number | null;
  buy_max: number | null;
  buy_avg: number | null;
  markup_min: number | null;
  markup_max: number | null;
  sell_min: number | null;
  sell_max: number | null;
  created_by: string | null;
  created_at: string | null;
  moq: number;
  transportation_per_unit: number;
  // T10: tier fields
  tier_pricing_enabled: number;
  is_tiered: number;
  tier1_max: number;
  tier1_discount: number;
  tier2_max: number;
  tier2_discount: number;
  tier3_max: number;
  tier3_discount: number;
  tier4_max: number;
  tier4_discount: number;
  // T20: actual transport stored on selling price
  transportation: number;
  other_expenses: number;
  // MG Approval: pending revision hold
  approval_status?: string;
  last_approved_sell_min?: number | null;
  last_approved_sell_max?: number | null;
  last_approved_strategy?: string | null;
};

/** Round up to nearest 5 EGP — used for ALL sell price displays. */
const roundUp5 = (n: number | null | undefined) => n != null ? Math.ceil(n / 5) * 5 : n;

/** T10: Compute tier prices using unified formula (divisor/percentage markup, including transport & expenses). */
function calcTierPrices(row: SalesRow) {
  const baseCost = row.strategy === "min" ? (row.buy_min ?? 0) : row.strategy === "max" ? (row.buy_max ?? 0) : (row.buy_avg ?? 0);
  const buyAvg = baseCost;
  const transport = row.transportation ?? 0;
  const other = row.other_expenses ?? 0;
  const sellMin = row.sell_min;
  const r5 = (n: number) => Math.ceil(n / 5) * 5;

  function getPriceForDiscount(discount: number) {
    if (discount <= 0 || buyAvg <= 0) return null;
    if (discount < 1) {
      return r5(buyAvg / discount + transport + other);
    }
    const baseSellMin = sellMin !== null ? (sellMin - transport - other) : buyAvg;
    return r5(baseSellMin * (1 - discount / 100) + transport + other);
  }

  return [
    { label: "B",  range: `1–${row.tier1_max}`,  price: sellMin !== null ? r5(sellMin) : getPriceForDiscount(row.tier1_discount) },
    { label: "T2", range: `${row.tier1_max + 1}–${row.tier2_max}`, price: getPriceForDiscount(row.tier2_discount) },
    { label: "T3", range: `${row.tier2_max + 1}–${row.tier3_max}`, price: getPriceForDiscount(row.tier3_discount) },
    { label: "T4", range: `>${row.tier3_max}`,   price: getPriceForDiscount(row.tier4_discount) },
  ].filter(t => t.price !== null);
}

type PriceHistoryEntry = {
  prev_sell_min: number | null;
  prev_sell_max: number | null;
  changed_at: string;
  changed_by: string;
};

type SalesListProps = {
  initialRows: SalesRow[];
  categories: Array<{ id: number; name: string }>;
  month: string;
  role?: "SC" | "SA";
  /** SC only: map of item_id → most recent price change (for inline indicator) */
  priceHistory?: Record<number, PriceHistoryEntry>;
};

export default function SalesList({ initialRows, categories, month, role, priceHistory }: SalesListProps) {
  const { locale, isRTL } = useI18n();
  const isAr = locale === "ar";

  const T = {
    searchPlaceholder: isAr ? "ابحث عن الأصناف، الفئات، أو الاستراتيجيات..." : "Search items, categories, or strategies instantly...",
    allCategories: isAr ? "جميع الفئات" : "All Categories",
    clearFilters: isAr ? "مسح التصفية" : "Clear Filters",
    interactiveCatalog: isAr ? "الكتالوج التفاعلي" : "Interactive catalog",
    allApprovedRanges: (count: number) => isAr ? `جميع النطاقات المعتمدة (${count})` : `All Approved Ranges (${count})`,
    filteredResults: (filtered: number, total: number) => isAr ? `النتائج المصفاة (${filtered} من أصل ${total})` : `Filtered Results (${filtered} of ${total})`,
    colCategory: isAr ? "الفئة" : "Category",
    colItem: isAr ? "الصنف" : "Item",
    colUnit: isAr ? "الوحدة" : "Unit",
    colMoq: isAr ? "أدنى كمية طلب (MOQ)" : "MOQ",
    colRefBase: isAr ? "المرجع الأساسي" : "Ref Base",
    colApprovedPrice: isAr ? "الأسعار المعتمدة" : "Approved Price(s)",
    colTransUnit: isAr ? "النقل/الوحدة" : "Trans./Unit",
    colPublished: isAr ? "منشور" : "Published",
    noMatch: isAr ? "لا توجد أسعار بيع معتمدة تطابق معايير البحث." : "No approved selling prices match your search criteria.",
    revised: isAr ? "📝 معدل" : "📝 Revised",
    ref: isAr ? "مرجع" : "Ref",
    yes: isAr ? "نعم" : "Yes",
    no: isAr ? "لا" : "No",
    pending: isAr ? "معلق" : "Pending",
    pendingRevision: isAr ? "⏳ مراجعة معلقة 🔒" : "⏳ Pending Revision 🔒",
    pendingRevisionTooltip: isAr ? "السعر قيد المراجعة من المدير - العروض متوقفة مؤقتاً" : "Price is being revised and is awaiting MG approval — quoting is on hold",
    onHold: isAr ? "معلق" : "ON HOLD",

    simEyebrow: isAr ? "مساعد مبيعات تفاعلي" : "Interactive sales assistant",
    simTitle: isAr ? "محاكي عروض أسعار صفقات العملاء" : "Client Deal Quoting Simulator",
    simRealTime: isAr ? "إجمالي فوري" : "Real-Time Totals",
    simSelectProduct: isAr ? "1. اختر المنتج المعتمد" : "1. Select Approved Product",
    simChooseProduct: isAr ? "-- اختر المنتج للتسعير --" : "-- Choose Product to Quote --",
    simMoq: isAr ? "الحد الأدنى للطلب (MOQ)" : "Min Order Qty (MOQ)",
    simStandardShipping: isAr ? "تكلفة الشحن القياسية" : "Standard Shipping Rate",
    simNotice: (moq: number, unit: string, cost: string) => isAr ? `ملاحظة: الكمية أقل من الحد الأدنى للطلب (${moq} ${unit}). ستُطبق تكلفة شحن تبلغ ${cost}.` : `Notice: Quantity is below the Minimum Order Quantity (${moq} ${unit}). A shipping cost of ${cost} will apply.`,
    simDealQty: isAr ? "2. كمية الصفقة" : "2. Deal Quantity",
    simTargetPrice: isAr ? "3. سعر الوحدة المستهدف (ج.م)" : "3. Target Unit Price (EGP)",
    simShippingCost: isAr ? "تكلفة الشحن (يتحملها العميل)" : "Shipping Cost (Client-Paid)",
    simAddQuote: isAr ? "إضافة العرض إلى لوحة الصفقات" : "Add Quote to Session Deal Board",
    simTotalValue: isAr ? "إجمالي قيمة الصفقة" : "Total deal value",
    simWithinLimits: isAr ? "✓ ضمن حدود التسعير المعتمدة" : "✓ Within Approved Pricing Limits",
    simUnderPricing: isAr ? "⚠️ سعر أقل من الحد الأدنى" : "⚠️ Under Pricing",
    simAboveLimit: isAr ? "⚠️ سعر أعلى من الحد الأقصى المعتمد" : "⚠️ Above Max Approved Limit",
    simMinApproved: isAr ? "أدنى إجمالي معتمد" : "Min Approved Total",
    simMaxApproved: isAr ? "أقصى إجمالي معتمد" : "Max Approved Total",
    simSelectPrompt: isAr ? "اختر صنفًا معتمدًا من القائمة لمحاكاة كميات الصفقة، والتحقق من الامتثال للهامش، وتصدير عروض أسعار مخصصة." : "Select an approved item from the list to simulate deal quantities, check markup compliance, and export custom price quotes.",
    simActiveBoard: isAr ? "لوحة صفقات الجلسة النشطة" : "Active Session Deal Board",
    simClearBoard: isAr ? "مسح اللوحة" : "Clear Board",
    colClient: isAr ? "العميل" : "Client",
    colProduct: isAr ? "المنتج" : "Product",
    colQty: isAr ? "الكمية" : "Quantity",
    colTargetPrice: isAr ? "سعر الوحدة المستهدف" : "Target Unit Price",
    colDealTotal: isAr ? "إجمالي الصفقة" : "Deal Total",
    colMinMax: isAr ? "المسموح به (أدنى / أقصى)" : "Min / Max Allowed",
    colCompliance: isAr ? "الامتثال" : "Compliance",
    colAction: isAr ? "الإجراء" : "Action",
    simCopyText: isAr ? "نسخ نص عرض السعر" : "Copy Quote Text",
    simApproved: isAr ? "معتمد" : "Approved",
    simBelowMin: isAr ? "أقل من الأدنى" : "Below Min",
    simAboveMax: isAr ? "أعلى من الأقصى" : "Above Max",
    simNoPrice: isAr ? "لا يوجد سعر منشور" : "No Published Price",
    simShow: isAr ? "عرض" : "Show",
    simHide: isAr ? "إخفاء" : "Hide",

    goodsSubtotal: isAr ? "إجمالي البضاعة:" : "Goods Subtotal:",
    transClientPaid: isAr ? "الشحن (يتحملها العميل):" : "Transportation (Client-Paid):",
    grandTotal: isAr ? "الإجمالي الكلي:" : "Grand Total:",
    approvedMinMsg: (min: string) => isAr ? `⚠️ سعر أقل من الحد الأدنى (الحد الأدنى المعتمد: ${min})` : `⚠️ Under Pricing (Approved Min: ${min})`,
    approvedMaxMsg: (max: string) => isAr ? `⚠️ سعر أعلى من الحد الأقصى (الحد الأقصى المعتمد: ${max})` : `⚠️ Above Max Approved Limit (Max: ${max})`,
    badgeApproved: isAr ? "معتمد" : "Approved",
    badgeBelow: isAr ? "أقل من الأدنى" : "Below Min",
    badgeAbove: isAr ? "أعلى من الأقصى" : "Above Max",
    incTrans: (cost: string) => isAr ? `(يشمل ${cost} شحن)` : `(inc. ${cost} trans)`,
    
    // Copy quote text template
    copyHeading: isAr ? "--- ملخص عرض سعر عميل FAERP ---" : "--- FAERP Client Quote Summary ---",
    copyProduct: isAr ? "المنتج:" : "Product:",
    copyQty: isAr ? "الكمية:" : "Quantity:",
    copyTargetPrice: isAr ? "سعر البيع المستهدف:" : "Target Resell Price:",
    copyMoq: isAr ? "أدنى كمية طلب (MOQ):" : "MOQ:",
    copyApprovedLimits: isAr ? "حدود التسعير المسموح بها (أدنى / أقصى):" : "Approved Min/Max limits:",
    copyStatus: isAr ? "حالة الامتثال:" : "Compliance Status:",
    copyGenerated: isAr ? "تاريخ الإنشاء:" : "Generated:",
    copyStatusApproved: isAr ? "مقبول ومعتمد" : "APPROVED",
    copyStatusBelow: isAr ? "تنبيه: أقل من الحد الأدنى" : "WARN: BELOW MIN",
    copyStatusAbove: isAr ? "تنبيه: أعلى من الحد الأقصى" : "WARN: ABOVE MAX",
    copyTransLine: (cost: string) => isAr 
      ? `تكلفة النقل: ${cost} ج.م (يتحملها العميل لعدم استيفاء MOQ)\n`
      : `Transportation Cost: EGP ${cost} (Paid by Client due to under-MOQ)\n`,
    copyTransTotal: (cost: string) => isAr
      ? `القيمة الإجمالية (شاملة النقل): ${cost} ج.م\n`
      : `Total Value (inc. Trans.): EGP ${cost}\n`,
    copyTotalOnly: (cost: string) => isAr
      ? `القيمة الإجمالية لعرض السعر: ${cost} ج.م\n`
      : `Total Quote Value: EGP ${cost}\n`,
    copySuccessAlert: isAr ? "تم نسخ عرض السعر إلى الحافظة!" : "Quote copied to clipboard!",

    moqConfTitle: isAr ? "تأكيد تكلفة الشحن" : "Shipping Cost Confirmation",
    moqConfDesc: (qty: number, unit: string, moq: number) => isAr
      ? `الكمية المطلوبة وهي ${qty} ${unit} أقل من الحد الأدنى للطلب (MOQ) البالغ ${moq} ${unit}.`
      : `The requested quantity of ${qty} ${unit} is below the Minimum Order Quantity (MOQ) of ${moq} ${unit}.`,
    moqConfTrans: (cost: string, qty: number, rate: string) => isAr
      ? `يجب على العميل دفع تكاليف الشحن/النقل، والتي تبلغ إجمالاً ${cost} (${qty} × ${rate}/وحدة).`
      : `The client must pay for shipping/transportation, which totals ${cost} (${qty} × ${rate}/unit).`,
    moqConfAgree: isAr ? "هل يوافق العميل على دفع تكلفة الشحن هذه؟" : "Does the client agree to pay this shipping cost?",
    moqConfYes: isAr ? "نعم، العميل يدفع الشحن" : "Yes, Client Pays Shipping",
    moqConfCancel: isAr ? "إلغاء" : "Cancel",
    min: isAr ? "الأدنى" : "Min",
    max: isAr ? "الأقصى" : "Max",
    updatedAtBy: (dt: string, user: string) => isAr ? `تم التحديث في ${dt} · بواسطة ${user}` : `Updated ${dt} · ${user}`,
    byUser: (user: string) => isAr ? `بواسطة ${user}` : `by ${user}`,
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");

  // Simulator State variables
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState<number>(100);
  const [targetPrice, setTargetPrice] = useState<number>(0);
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
  }>>([]);

  const filteredRows = initialRows.filter((row) => {
    const matchesSearch =
      row.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.category_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.strategy && row.strategy.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategoryName === "" || row.category_name === selectedCategoryName;

    return matchesSearch && matchesCategory;
  });

  const selectedItem = initialRows.find((row) => String(row.item_id) === selectedItemId);

  // Sync target price on item selection change
  useEffect(() => {
    if (selectedItem && selectedItem.sell_min !== null && selectedItem.sell_max !== null) {
      setTargetPrice(Number(((selectedItem.sell_min + selectedItem.sell_max) / 2).toFixed(2)));
    } else {
      setTargetPrice(0);
    }
    setShowMOQDialog(false);
  }, [selectedItemId, selectedItem]);

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

    let status: "approved" | "low" | "high" = "approved";
    if (targetPrice < selectedItem.sell_min) {
      status = "low";
    } else if (targetPrice > selectedItem.sell_max) {
      status = "high";
    }

    const isUnderMOQ = selectedItem.moq > 0 && qty < selectedItem.moq;
    const transportationCost = (isUnderMOQ && clientPaysShipping)
      ? qty * (selectedItem.transportation_per_unit ?? 0)
      : 0;

    const newQuote = {
      id: Date.now(),
      itemName: selectedItem.item_name,
      unit: selectedItem.unit,
      qty,
      price: targetPrice,
      total: qty * targetPrice,
      transportationCost,
      grandTotal: qty * targetPrice + transportationCost,
      clientPaysTrans: isUnderMOQ ? clientPaysShipping : false,
      moq: selectedItem.moq,
      minAllowed: selectedItem.sell_min,
      maxAllowed: selectedItem.sell_max,
      status
    };

    setSessionQuotes([newQuote, ...sessionQuotes]);
    setShowMOQDialog(false);
  };

  const copyQuote = (quote: typeof sessionQuotes[0]) => {
    const statusText = quote.status === "approved" 
      ? T.copyStatusApproved 
      : quote.status === "low" 
        ? T.copyStatusBelow 
        : T.copyStatusAbove;
    
    let transLine = "";
    if (quote.transportationCost > 0) {
      transLine = T.copyTransLine(quote.transportationCost.toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 })) +
                  T.copyTransTotal(quote.grandTotal.toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 }));
    } else {
      transLine = T.copyTotalOnly(quote.total.toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 }));
    }

    const text = `${T.copyHeading}\n` +
      `${T.copyProduct} ${quote.itemName} (${quote.unit})\n` +
      `${T.copyQty} ${quote.qty}\n` +
      `${T.copyTargetPrice} EGP ${quote.price.toFixed(2)} / ${quote.unit}\n` +
      `${T.copyMoq} ${quote.moq}\n` +
      transLine +
      `${T.copyApprovedLimits} EGP ${quote.minAllowed.toFixed(2)} - EGP ${quote.maxAllowed.toFixed(2)}\n` +
      `${T.copyStatus} ${statusText}\n` +
      `${T.copyGenerated} ${(() => { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`; })()}\n` +
      `----------------------------------`;
    
    navigator.clipboard.writeText(text);
    alert(T.copySuccessAlert);
  };

  return (
    <div className="page-stack">
      {/* Client Quoting Simulator */}
      <section className="panel animate-fade-in">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{T.simEyebrow}</p>
            <h2>{T.simTitle}</h2>
          </div>
          <span className="badge badge-strong">{T.simRealTime}</span>
        </div>

        <div className="quote-simulator-card">
          <div className="quote-simulator-grid">
            {/* Inputs Column */}
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <label className="field">
                <span>{T.simSelectProduct}</span>
                <ItemCombobox
                  items={initialRows.map((row) => ({
                    id: row.item_id,
                    label: row.item_name,
                    unit: row.unit,
                    category: row.category_name,
                    isPublished: row.sell_min !== null,
                  }))}
                  value={selectedItemId}
                  onChange={setSelectedItemId}
                  placeholder={T.simChooseProduct}
                />
              </label>

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
                      {T.simMoq}
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--warning)" }}>
                      {selectedItem.moq} {selectedItem.unit}
                    </strong>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      {T.simStandardShipping}
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--text-primary)" }}>
                      {formatCurrency(selectedItem.transportation_per_unit)} / unit
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
                  <span style={{ fontSize: "16px" }}>⚠️</span>
                  <div style={{ textAlign: isAr ? "right" : "left" }}>
                    <strong>{isAr ? "ملاحظة:" : "Notice:"}</strong> {T.simNotice(selectedItem.moq, selectedItem.unit, formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0)))}
                  </div>
                </div>
              )}

              {selectedItem && (() => {
                const isPendingSelected = role === "SA" && selectedItem.approval_status !== "approved" && selectedItem.last_approved_sell_min != null;
                return isPendingSelected ? (
                  <div className="animate-fade-in" style={{
                    padding: "16px",
                    backgroundColor: "rgba(245, 158, 11, 0.10)",
                    border: "1.5px solid rgba(245, 158, 11, 0.4)",
                    borderRadius: "8px",
                    color: "#b45309",
                    fontSize: "13px",
                    fontWeight: 600,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "4px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px" }}>🔒</span>
                      <strong>{T.pendingRevision}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#92400e", lineHeight: 1.5 }}>
                      {T.pendingRevisionTooltip}
                    </p>
                    <div style={{ display: "flex", gap: "16px", padding: "10px 12px", background: "rgba(245,158,11,0.08)", borderRadius: "6px", opacity: 0.7, marginTop: "4px" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{T.min}</div>
                        <strong style={{ color: "var(--text-muted)", fontSize: "14px" }}>{formatCurrency(roundUp5(selectedItem.last_approved_sell_min))}</strong>
                      </div>
                      <span style={{ color: "var(--text-dim)" }}>—</span>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{T.max}</div>
                        <strong style={{ color: "var(--text-muted)", fontSize: "14px" }}>{formatCurrency(roundUp5(selectedItem.last_approved_sell_max))}</strong>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div style={{ 
                display: "grid", 
                gridTemplateColumns: selectedItem && selectedItem.moq > 0 && qty < selectedItem.moq ? "1fr 1fr 1.2fr" : "1fr 1fr", 
                gap: "16px" 
              }}>
                <label className="field">
                  <span>{T.simDealQty}</span>
                  <input 
                    type="number" 
                    min="1" 
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                    disabled={!selectedItemId || (role === "SA" && selectedItem?.approval_status !== "approved" && selectedItem?.last_approved_sell_min != null)}
                  />
                </label>

                <label className="field">
                  <span>{T.simTargetPrice}</span>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!selectedItemId || (role === "SA" && selectedItem?.approval_status !== "approved" && selectedItem?.last_approved_sell_min != null)}
                  />
                </label>

                {selectedItem && selectedItem.moq > 0 && qty < selectedItem.moq && (
                  <label className="field animate-fade-in">
                    <span style={{ color: "var(--warning)" }}>{T.simShippingCost}</span>
                    <input 
                      type="text" 
                      readOnly
                      value={`${formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0))}`}
                      style={{ 
                        borderColor: "var(--warning)", 
                        color: "var(--warning)", 
                        backgroundColor: "rgba(245, 158, 11, 0.05)",
                        fontWeight: "bold",
                        cursor: "default"
                      }}
                    />
                  </label>
                )}
              </div>

              <button 
                type="button" 
                className="button button-primary button-block"
                onClick={addQuote}
                disabled={!selectedItem || (role === "SA" && selectedItem?.approval_status !== "approved" && selectedItem?.last_approved_sell_min != null)}
                style={{ marginTop: "8px" }}
              >
                {T.simAddQuote}
              </button>
            </div>

            {/* Live Metrics Column */}
            <div className="simulation-results">
              {selectedItem ? (
                <>
                  <div style={{ textAlign: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px" }}>
                    <span className="eyebrow" style={{ fontSize: "11px" }}>{T.simTotalValue}</span>
                    {selectedItem.moq > 0 && qty < selectedItem.moq ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                          <span>{T.goodsSubtotal}</span>
                          <span>{formatCurrency(qty * targetPrice)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--warning)" }}>
                          <span>{T.transClientPaid}</span>
                          <span>{formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0))}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold", borderTop: "1px dashed var(--border-light)", paddingTop: "4px", marginTop: "4px" }}>
                          <span>{T.grandTotal}</span>
                          <span style={{ color: "var(--text-primary)" }}>
                            {formatCurrency(qty * targetPrice + qty * (selectedItem.transportation_per_unit ?? 0))}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <h1 style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-primary)", margin: "4px 0" }}>
                        {formatCurrency(qty * targetPrice)}
                      </h1>
                    )}
                    <div style={{ marginTop: "8px" }}>
                      {targetPrice >= (selectedItem.sell_min ?? 0) && targetPrice <= (selectedItem.sell_max ?? 0) ? (
                        <span className="badge badge-success">{T.simWithinLimits}</span>
                      ) : targetPrice < (selectedItem.sell_min ?? 0) ? (
                        <span className="badge badge-danger">{T.approvedMinMsg(formatCurrency(selectedItem.sell_min))}</span>
                      ) : (
                        <span className="badge badge-warning">{T.approvedMaxMsg(formatCurrency(selectedItem.sell_max))}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", paddingTop: "8px" }}>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>{T.simMinApproved}</span>
                      <strong style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
                        {formatCurrency(qty * (selectedItem.sell_min ?? 0))}
                      </strong>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>{T.simMaxApproved}</span>
                      <strong style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
                        {formatCurrency(qty * (selectedItem.sell_max ?? 0))}
                      </strong>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                  <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>📊</span>
                  {T.simSelectPrompt}
                </div>
              )}
            </div>
          </div>

          {/* Deal Board History */}
          {sessionQuotes.length > 0 && (
            <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-light)", paddingTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700" }}>{T.simActiveBoard} ({sessionQuotes.length})</h3>
                <button 
                  onClick={() => setSessionQuotes([])} 
                  className="button button-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  {T.simClearBoard}
                </button>
              </div>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>{T.colProduct}</th>
                      <th>{T.colQty}</th>
                      <th>{T.colTargetPrice}</th>
                      <th>{T.colDealTotal}</th>
                      <th>{T.colMinMax}</th>
                      <th>{T.colCompliance}</th>
                      <th>{T.colAction}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionQuotes.map((quote) => (
                      <tr key={quote.id}>
                        <td><strong>{quote.itemName}</strong> <span className="muted">({quote.unit})</span></td>
                        <td>{quote.qty}</td>
                        <td>{formatCurrency(quote.price)}</td>
                        <td>
                          <div className="cell-stack">
                            <strong style={{ color: quote.status === "approved" ? "var(--success)" : quote.status === "low" ? "var(--danger)" : "var(--warning)" }}>
                              {formatCurrency(quote.grandTotal)}
                            </strong>
                            {quote.transportationCost > 0 && (
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                {T.incTrans(formatCurrency(quote.transportationCost))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{formatCurrency(quote.minAllowed)} - {formatCurrency(quote.maxAllowed)}</td>
                        <td>
                          {quote.status === "approved" ? (
                            <span className="badge badge-success" style={{ padding: "4px 8px", fontSize: "10px" }}>{T.badgeApproved}</span>
                          ) : quote.status === "low" ? (
                            <span className="badge badge-danger" style={{ padding: "4px 8px", fontSize: "10px" }}>{T.badgeBelow}</span>
                          ) : (
                            <span className="badge badge-warning" style={{ padding: "4px 8px", fontSize: "10px" }}>{T.badgeAbove}</span>
                          )}
                        </td>
                        <td>
                          <button 
                            onClick={() => copyQuote(quote)} 
                            className="button button-secondary"
                            style={{ padding: "6px 10px", fontSize: "11px" }}
                          >
                            {T.simCopyText}
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
      </section>

      <div className="search-bar-wrap">
        <input
          type="text"
          className="search-input"
          placeholder={T.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <select
          className="search-input"
          style={{ maxWidth: "240px" }}
          value={selectedCategoryName}
          onChange={(e) => setSelectedCategoryName(e.target.value)}
        >
          <option value="">{T.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>

        {searchQuery || selectedCategoryName ? (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategoryName("");
            }}
            className="button button-secondary"
          >
            {T.clearFilters}
          </button>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{T.interactiveCatalog}</p>
            <h2>
              {filteredRows.length === initialRows.length
                ? T.allApprovedRanges(initialRows.length)
                : T.filteredResults(filteredRows.length, initialRows.length)}
            </h2>
          </div>
          <span className="badge badge-strong">{month}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{T.colCategory}</th>
                <th>{T.colItem}</th>
                <th>{T.colUnit}</th>
                <th>{T.colMoq}</th>
                <th title={isAr ? "المرجع الأساسي المستخدم للهامش" : "Which buy price was used as markup base"}>{T.colRefBase}</th>
                <th>{T.colApprovedPrice}</th>
                <th title={isAr ? "تكلفة النقل لكل وحدة المتضمنة في هذا السعر" : "Transport cost per unit included in this price"}>{T.colTransUnit}</th>
                <th>{T.colPublished}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                    {T.noMatch}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  // Show tiers whenever item is configured as tiered + has buy_avg
                  // (don't require tier_pricing_enabled===1 — that flag may be 0 if item was
                  //  published before the monthly tier toggle was switched on)
                  const isPendingRevision = role === "SA" && row.approval_status !== "approved" && row.last_approved_sell_min != null;
                  const isTiered = !isPendingRevision && row.is_tiered === 1 && row.buy_avg != null;
                  const tierPrices = isTiered ? calcTierPrices(row) : [];
                  const TIER_COLORS = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)"];
                  const recentChange = priceHistory?.[row.item_id];
                  // Badge shows for both SC and SA; inline old→new only for SC
                  const hasChange = !isPendingRevision && !!recentChange;
                  return (
                    <tr key={row.item_id} style={isPendingRevision ? {
                      backgroundColor: "rgba(245,158,11,0.06)",
                      borderLeft: "3px solid var(--warning)",
                      opacity: 0.85,
                    } : hasChange ? {
                      backgroundColor: "rgba(245,158,11,0.04)",
                      borderLeft: "3px solid #f59e0b",
                    } : {}}>
                      <td><span className="badge">{row.category_name}</span></td>
                      <td>
                        <span
                          onClick={() => window.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: row.item_id } }))}
                          className="clickable-detail-trigger"
                        >
                          {row.item_name}
                        </span>
                        {isPendingRevision && (
                          <span style={{
                            display: "inline-block", marginInlineStart: "8px",
                            fontSize: "9px", fontWeight: 800, padding: "2px 7px",
                            borderRadius: "99px", background: "rgba(245,158,11,0.15)",
                            border: "1px solid rgba(245,158,11,0.4)", color: "#b45309",
                            verticalAlign: "middle",
                          }} title={T.pendingRevisionTooltip}>{T.pendingRevision}</span>
                        )}
                        {hasChange && (
                          <span style={{
                            display: "inline-block", marginInlineStart: "8px",
                            fontSize: "9px", fontWeight: 800, padding: "2px 7px",
                            borderRadius: "99px", background: "rgba(245,158,11,0.15)",
                            border: "1px solid rgba(245,158,11,0.4)", color: "#b45309",
                            verticalAlign: "middle",
                          }}>{T.revised}</span>
                        )}
                      </td>
                      <td>{row.unit}</td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--warning)",
                          backgroundColor: "rgba(245,158,11,0.15)", border: "1px solid var(--warning)",
                          padding: "4px 8px", borderRadius: "6px", display: "inline-block" }}>
                          {row.moq}
                        </span>
                      </td>
                      {/* T16: base reference */}
                      <td>
                        {row.strategy ? (
                          <span className="badge badge-strong" title={isAr ? "سعر الشراء الأساسي المستخدم للهامش" : "Base buy price used for markup"}>
                            {T.ref}: {row.strategy.toUpperCase()}
                          </span>
                        ) : <span className="badge">—</span>}
                      </td>
                      {/* Approved Price(s) — for SC show old→new if revised */}
                      <td>
                        {isPendingRevision ? (
                          /* Pending revision: show last approved price with lock */
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center", opacity: 0.7 }}>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{T.min}</div>
                                <strong style={{ color: "var(--text-muted)", fontSize: "14px" }}>{formatCurrency(roundUp5(row.last_approved_sell_min))}</strong>
                              </div>
                              <span style={{ color: "var(--text-dim)" }}>—</span>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{T.max}</div>
                                <strong style={{ color: "var(--text-muted)", fontSize: "14px" }}>{formatCurrency(roundUp5(row.last_approved_sell_max))}</strong>
                              </div>
                            </div>
                            <span style={{ fontSize: "8px", color: "#b45309", fontWeight: 700 }}>🔒 {T.onHold}</span>
                          </div>
                        ) : isTiered ? (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {tierPrices.map((t, i) => (
                              <div key={t.label} style={{ textAlign: "center", minWidth: "54px" }}>
                                <div style={{ fontSize: "9px", fontWeight: 800, color: TIER_COLORS[i], textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.label}</div>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: TIER_COLORS[i] }}>{formatCurrency(t.price)}</div>
                                <div style={{ fontSize: "8px", color: "var(--text-muted)" }}>{t.range} {row.unit}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {/* Inline old → new indicator: SC only */}
                            {role === "SC" && hasChange && recentChange && recentChange.prev_sell_min !== null && (
                              <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
                                <span style={{ textDecoration: "line-through", opacity: 0.7 }}>
                                  {formatCurrency(roundUp5(recentChange.prev_sell_min))} – {formatCurrency(roundUp5(recentChange.prev_sell_max))}
                                </span>
                                <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: "13px" }}>→</span>
                              </div>
                            )}
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{T.min}</div>
                                <strong style={{ color: "var(--success)", fontSize: "14px" }}>{formatCurrency(roundUp5(row.sell_min))}</strong>
                              </div>
                              <span style={{ color: "var(--text-dim)" }}>—</span>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{T.max}</div>
                                <strong style={{ color: "var(--primary)", fontSize: "14px" }}>{formatCurrency(roundUp5(row.sell_max))}</strong>
                              </div>
                            </div>
                            {hasChange && (
                              <div style={{ fontSize: "10px", color: "#b45309", marginTop: "2px" }}>
                                {T.updatedAtBy(formatDateTime(recentChange.changed_at), recentChange.changed_by)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      {/* T20: transportation per unit */}
                      <td>
                        {(row.transportation ?? 0) > 0 ? (
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                            {formatCurrency(row.transportation)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="cell-stack">
                          <span>{formatDateTime(row.created_at)}</span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{T.byUser(row.created_by ?? "")}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
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
              {T.moqConfTitle}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>
              {T.moqConfDesc(qty, selectedItem.unit, selectedItem.moq)}
              <br /><br />
              {T.moqConfTrans(
                formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0)),
                qty,
                formatCurrency(selectedItem.transportation_per_unit)
              )}
              <br /><br />
              {T.moqConfAgree}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                onClick={() => proceedAddQuote(true)}
                className="button button-primary"
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                {T.moqConfYes}
              </button>
              <button 
                onClick={() => setShowMOQDialog(false)}
                className="button button-secondary"
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                {T.moqConfCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
