"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { addPriceEntrySilent } from "@/app/actions/pricing";
import { useI18n } from "@/lib/i18n-context";
import { createPortal } from "react-dom";

type MissingQuote = {
  category_name: string;
  category_id: number;
  item_name: string;
  unit: string;
  supplier_name: string;
  supplier_id: number;
  item_id: number;
  prev_price: number | null;
};

type Supplier = {
  id: number;
  name: string;
  fame_name: string | null;
  category_ids: number[];
};

type SupplierRow = {
  supplierId: number;
  price: string;
  transport: string;
};

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

type Props = {
  missing: MissingQuote[];
  suppliers: Supplier[];
  displayName: string;
  month: string;
};

export default function WhMissingQuotes({ missing, suppliers, displayName, month }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const [search, setSearch] = useState("");
  const [activeQuote, setActiveQuote] = useState<MissingQuote | null>(null);

  // Modal form states
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter missing quotes based on search text
  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return missing;
    return missing.filter(
      (m) =>
        m.item_name.toLowerCase().includes(q) ||
        m.supplier_name.toLowerCase().includes(q) ||
        m.category_name.toLowerCase().includes(q)
    );
  }, [missing, search]);

  // Allowed suppliers for the active item's category
  const allowedSuppliers = useMemo(() => {
    if (!activeQuote) return [];
    return suppliers.filter((s) => s.category_ids.includes(activeQuote.category_id));
  }, [suppliers, activeQuote]);

  const openQuickAddModal = (m: MissingQuote) => {
    setActiveQuote(m);
    setRows([
      { supplierId: m.supplier_id, price: "", transport: "" }
    ]);
    setNotes("");
    setErrorMsg(null);
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuote) return;

    // Validate all rows
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const priceNum = Number(row.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setErrorMsg(
          isAr
            ? `الرجاء إدخال سعر صحيح أكبر من الصفر في الصف رقم ${index + 1}.`
            : `Please enter a valid price greater than 0 in row #${index + 1}.`
        );
        return;
      }

      const transportNum = row.transport ? Number(row.transport) : undefined;
      if (transportNum !== undefined && (isNaN(transportNum) || transportNum < 0)) {
        setErrorMsg(
          isAr
            ? `الرجاء إدخال تكلفة نقل صحيحة في الصف رقم ${index + 1}.`
            : `Please enter a valid transportation fee in row #${index + 1}.`
        );
        return;
      }
    }

    startTransition(async () => {
      let hasError = false;
      let lastError = "";

      // Submit each supplier entry sequentially to prevent SQLite lockups
      for (const row of rows) {
        const result = await addPriceEntrySilent({
          itemId: activeQuote.item_id,
          supplierId: row.supplierId,
          month: month,
          price: Number(row.price),
          notes: notes.trim(),
          collectedBy: displayName,
          actualTransport: row.transport ? Number(row.transport) : undefined,
        });

        if (!result.ok) {
          hasError = true;
          lastError = result.error || "Save failed.";
          break;
        }
      }

      if (hasError) {
        setErrorMsg(lastError);
      } else {
        setActiveQuote(null);
        router.refresh();
      }
    });
  };

  return (
    <section className="panel animate-fade-in">
      <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <p className="eyebrow">{isAr ? "إجراء مطلوب" : "Action Required"}</p>
          <h2 style={{ fontSize: "16px", fontWeight: 800 }}>
            {isAr ? "أسعار مفقودة" : "Missing Quotes"} ({filteredQuotes.length})
          </h2>
        </div>

        {/* Search input and navigation */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder={isAr ? "ابحث عن صنف، مورد..." : "Search item, supplier..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "6px 12px 6px 30px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                fontSize: "12.5px",
                outline: "none",
                minWidth: "220px",
              }}
            />
            <span style={{ position: "absolute", left: "10px", top: "7px", fontSize: "12px", color: "var(--text-muted)", pointerEvents: "none" }}>🔍</span>
          </div>

          <a href="/dashboard/purchasing" className="button button-primary" style={{ fontSize: "12px", padding: "7px 14px" }}>
            {isAr ? "ذهاب لجمع الأسعار ←" : "Go to Price Collection →"}
          </a>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table" style={{ fontSize: "12.5px" }}>
          <thead>
            <tr>
              <th>{isAr ? "الفئة" : "Category"}</th>
              <th>{isAr ? "الصنف" : "Item"}</th>
              <th>{isAr ? "الوحدة" : "Unit"}</th>
              <th>{isAr ? "المورد" : "Supplier"}</th>
              <th style={{ textAlign: "right" }}>{isAr ? "السعر الشهر الماضي" : "Last Month Price"}</th>
              <th style={{ textAlign: "center" }}>{isAr ? "إجراء" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {isAr ? "لا توجد أسعار مفقودة تطابق البحث." : "No missing quotes match search."}
                </td>
              </tr>
            ) : (
              filteredQuotes.map((m, i) => {
                const supplierIdx = suppliers.findIndex((s) => s.id === m.supplier_id);
                const color = supplierIdx !== -1 ? COLORS[supplierIdx % COLORS.length] : "#3b82f6";
                return (
                  <tr key={i}>
                    <td>
                      <span className="badge" style={{ fontSize: "10px" }}>{m.category_name}</span>
                    </td>
                    <td>
                      <span
                        onClick={() => globalThis.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: m.item_id } }))}
                        className="clickable-detail-trigger"
                      >
                        {m.item_name}
                      </span>
                    </td>
                    <td>{m.unit}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "6px",
                          background: color + "22",
                          border: `1.5px solid ${color}44`,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: color,
                          flexShrink: 0
                        }}>
                          {m.supplier_name.charAt(0)}
                        </span>
                        <span
                          onClick={() => globalThis.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: m.supplier_id } }))}
                          className="clickable-detail-trigger"
                        >
                          {m.supplier_name}
                        </span>
                      </div>
                    </td>
                  <td style={{ textAlign: "right" }}>
                    {m.prev_price != null ? (
                      <span style={{ color: "var(--text-muted)" }}>{formatCurrency(m.prev_price)}</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{isAr ? "لا يوجد سجل" : "No history"}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => openQuickAddModal(m)}
                      className="button button-secondary"
                      style={{ fontSize: "11px", padding: "4px 10px", height: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      ⚡ {isAr ? "عرض" : "View"}
                    </button>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Price Add Modal */}
      {isMounted && activeQuote && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,9,15,0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-xl)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                ⚡ {isAr ? "إضافة سريعة للأسعار" : "Quick Price Add"}
              </h3>
              <button
                type="button"
                onClick={() => setActiveQuote(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleQuickSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <span className="badge" style={{ marginBottom: "6px" }}>{activeQuote.category_name}</span>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4 }}>
                  {activeQuote.item_name}
                </div>
              </div>

              {errorMsg && (
                <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px", color: "var(--danger)", fontSize: "12px" }}>
                  {errorMsg}
                </div>
              )}

              {/* Multi-supplier input grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 40px", gap: "8px", borderBottom: "1px solid var(--border-light)", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                    {isAr ? "المورد" : "Supplier"}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                    {isAr ? "السعر المعروض (EGP)" : "Quoted Price (EGP)"}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                    {isAr ? "تكلفة النقل" : "Trans Fees (EGP)"}
                  </span>
                  <span />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                  {rows.map((row, index) => (
                    <div key={index} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 40px", gap: "8px", alignItems: "center" }}>
                      {/* Supplier dropdown */}
                      <select
                        value={row.supplierId}
                        onChange={(e) => {
                          const newRows = [...rows];
                          newRows[index].supplierId = Number(e.target.value);
                          setRows(newRows);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-elevated)",
                          color: "var(--text-primary)",
                          fontSize: "13px",
                          outline: "none",
                        }}
                      >
                        {allowedSuppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fame_name || s.name}
                          </option>
                        ))}
                      </select>

                      {/* Quoted Price */}
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        value={row.price}
                        onChange={(e) => {
                          const newRows = [...rows];
                          newRows[index].price = e.target.value;
                          setRows(newRows);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-elevated)",
                          color: "var(--text-primary)",
                          fontSize: "13px",
                          outline: "none",
                        }}
                      />

                      {/* Trans Fees */}
                      <input
                        type="number"
                        step="any"
                        placeholder={isAr ? "اختياري" : "Optional"}
                        value={row.transport}
                        onChange={(e) => {
                          const newRows = [...rows];
                          newRows[index].transport = e.target.value;
                          setRows(newRows);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-elevated)",
                          color: "var(--text-primary)",
                          fontSize: "13px",
                          outline: "none",
                        }}
                      />

                      {/* Delete button */}
                      <button
                        type="button"
                        disabled={rows.length === 1}
                        onClick={() => {
                          const newRows = rows.filter((_, idx) => idx !== index);
                          setRows(newRows);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: rows.length === 1 ? "var(--text-muted)" : "var(--danger)",
                          cursor: rows.length === 1 ? "not-allowed" : "pointer",
                          fontSize: "16px",
                          padding: "4px",
                          opacity: rows.length === 1 ? 0.3 : 1,
                        }}
                        title={isAr ? "حذف" : "Remove"}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const defaultSub = allowedSuppliers[0]?.id || 0;
                    setRows([...rows, { supplierId: defaultSub, price: "", transport: "" }]);
                  }}
                  className="button button-secondary"
                  style={{ alignSelf: "flex-start", fontSize: "11.5px", padding: "6px 12px", height: "auto", display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "4px" }}
                >
                  ➕ {isAr ? "إضافة مورد آخر" : "Add Supplier Row"}
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                    {isAr ? "ملاحظة مشتركة لجميع الموردين" : "Shared Notes (Applied to all entered quotes)"}
                  </span>
                  <input
                    type="text"
                    placeholder={isAr ? "اكتب ملاحظة إن وجدت..." : "Write a note if needed..."}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "8px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--border-light)",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                {/* Redirect Link */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveQuote(null);
                    router.push(
                      `/dashboard/purchasing?categoryId=${activeQuote.category_id}&itemId=${activeQuote.item_id}`
                    );
                  }}
                  className="button button-secondary"
                  style={{ fontSize: "11.5px", padding: "6px 10px", color: "var(--primary-dark)" }}
                >
                  🔗 {isAr ? "عرض التسعير الكامل" : "View Full Pricing"}
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setActiveQuote(null)}
                    disabled={isPending}
                    className="button button-secondary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="button button-primary"
                    style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    {isPending && <span className="spinner-mini" />}
                    {isAr ? "إرسال" : "Submit"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </section>
  );
}
