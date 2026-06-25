"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { addPriceEntrySilent } from "@/app/actions/pricing";
import { useI18n } from "@/lib/i18n-context";
import { createPortal } from "react-dom";

type MissingSupplier = {
  supplier_id: number;
  supplier_name: string;
  prev_price: number | null;
  status: string | null;
  review_note: string | null;
};

type SubmittedSupplier = {
  supplier_id: number;
  supplier_name: string;
  prev_price: number | null;
};

type MissingItem = {
  category_name: string;
  category_id: number;
  item_name: string;
  unit: string;
  item_id: number;
  submitted: SubmittedSupplier[];
  missing: MissingSupplier[];
};

type Item = {
  id: number;
  recommended_supplier_id?: number | null;
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
  missing: MissingItem[];
  suppliers: Supplier[];
  items: Item[];
  displayName: string;
  month: string;
};

export default function WhMissingQuotes({ missing, suppliers, items, displayName, month }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const [search, setSearch] = useState("");
  const [activeItem, setActiveItem] = useState<MissingItem | null>(null);

  // Modal form states
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter items based on search text
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return missing;
    return missing.filter(
      (m) =>
        m.item_name.toLowerCase().includes(q) ||
        m.category_name.toLowerCase().includes(q) ||
        m.missing.some(s => s.supplier_name.toLowerCase().includes(q)) ||
        m.submitted.some(s => s.supplier_name.toLowerCase().includes(q))
    );
  }, [missing, search]);

  // Total missing supplier quotes count
  const totalMissingCount = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.missing.length, 0);
  }, [filteredItems]);

  const openModal = (item: MissingItem) => {
    setActiveItem(item);
    // Pre-fill with all missing suppliers
    setRows(
      item.missing.map(s => ({
        supplierId: s.supplier_id,
        price: "",
        transport: "",
      }))
    );
    setNotes("");
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    // Validate rows that have prices entered
    const filledRows = rows.filter(r => r.price.trim() !== "");
    if (filledRows.length === 0) {
      setErrorMsg(isAr ? "الرجاء إدخال سعر واحد على الأقل." : "Please enter at least one price.");
      return;
    }

    for (let index = 0; index < filledRows.length; index++) {
      const row = filledRows[index];
      const priceNum = Number(row.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setErrorMsg(
          isAr
            ? `الرجاء إدخال سعر صحيح أكبر من الصفر.`
            : `Please enter a valid price greater than 0.`
        );
        return;
      }

      const transportNum = row.transport ? Number(row.transport) : undefined;
      if (transportNum !== undefined && (isNaN(transportNum) || transportNum < 0)) {
        setErrorMsg(
          isAr
            ? `الرجاء إدخال تكلفة نقل صحيحة.`
            : `Please enter a valid transportation fee.`
        );
        return;
      }
    }

    startTransition(async () => {
      let hasError = false;
      let lastError = "";

      for (const row of filledRows) {
        const result = await addPriceEntrySilent({
          itemId: activeItem.item_id,
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
        setActiveItem(null);
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
            {isAr ? "أصناف تحتاج أسعار" : "Items Needing Quotes"} ({filteredItems.length})
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", marginInlineStart: "8px" }}>
              {totalMissingCount} {isAr ? "سعر مفقود" : "missing prices"}
            </span>
          </h2>
        </div>

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
              <th style={{ width: "80px" }}>{isAr ? "الفئة" : "Category"}</th>
              <th>{isAr ? "الصنف" : "Item"}</th>
              <th style={{ width: "50px" }}>{isAr ? "الوحدة" : "Unit"}</th>
              <th style={{ textAlign: "center", width: "80px" }}>{isAr ? "إجراء" : "Actions"}</th>
              <th>{isAr ? "حالة الموردين" : "Supplier Status"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {isAr ? "لا توجد أصناف تحتاج أسعار." : "No items needing quotes."}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const totalSuppliers = item.submitted.length + item.missing.length;
                const hasRejected = item.missing.some(s => s.status === 'rejected');
                return (
                  <tr key={item.item_id}>
                    <td>
                      <span className="badge" style={{ fontSize: "10px" }}>{item.category_name}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span
                          onClick={() => globalThis.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: item.item_id } }))}
                          className="clickable-detail-trigger"
                          style={{ fontWeight: 600 }}
                        >
                          {item.item_name}
                        </span>
                        {hasRejected && (
                          <span style={{ fontSize: "10px", color: "var(--danger)", fontWeight: 700 }}>
                            ⚠️ {isAr ? "يحتاج مراجعة" : "Has rejected quotes"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{item.unit}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => openModal(item)}
                        className="button button-secondary"
                        style={{ fontSize: "11px", padding: "4px 10px", height: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        ⚡ {isAr ? "عرض" : "View"}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                        {/* Submitted suppliers — green badges */}
                        {item.submitted.map((s) => (
                          <span
                            key={s.supplier_id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "rgba(16,185,129,0.10)",
                              color: "var(--success)",
                              border: "1px solid rgba(16,185,129,0.25)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✓ {s.supplier_name}
                          </span>
                        ))}
                        {/* Missing suppliers — red/orange badges */}
                        {item.missing.map((s) => {
                          const isRejected = s.status === 'rejected';
                          return (
                            <span
                              key={s.supplier_id}
                              title={isRejected ? `${isAr ? "مرفوض" : "Rejected"}: ${s.review_note || "—"}` : undefined}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                padding: "2px 7px",
                                borderRadius: "6px",
                                fontSize: "10px",
                                fontWeight: 700,
                                background: isRejected ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.06)",
                                color: isRejected ? "var(--danger)" : "var(--text-muted)",
                                border: `1px solid ${isRejected ? "rgba(239,68,68,0.30)" : "rgba(239,68,68,0.15)"}`,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isRejected ? "⚠" : "○"} {s.supplier_name}
                            </span>
                          );
                        })}
                        {/* Progress indicator */}
                        <span style={{
                          fontSize: "9px",
                          fontWeight: 800,
                          color: item.submitted.length === 0 ? "var(--danger)" : "var(--text-muted)",
                          marginInlineStart: "4px",
                          whiteSpace: "nowrap",
                        }}>
                          {item.submitted.length}/{totalSuppliers}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Price Add Modal — shows only missing suppliers */}
      {isMounted && activeItem && createPortal(
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
              maxWidth: "640px",
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
              <div>
                <span className="badge" style={{ marginBottom: "4px", fontSize: "10px" }}>{activeItem.category_name}</span>
                <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                  {activeItem.item_name}
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginInlineStart: "8px" }}>({activeItem.unit})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
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

            {/* Already submitted suppliers */}
            {activeItem.submitted.length > 0 && (
              <div style={{ padding: "12px 20px", background: "rgba(16,185,129,0.04)", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                  ✓ {isAr ? "تم تقديم الأسعار" : "Submitted"} ({activeItem.submitted.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {activeItem.submitted.map(s => (
                    <span key={s.supplier_id} style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                      background: "rgba(16,185,129,0.10)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.25)",
                    }}>
                      ✓ {s.supplier_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Form for missing suppliers */}
            <form onSubmit={handleSubmit} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                ○ {isAr ? "أسعار مفقودة" : "Missing Prices"} ({activeItem.missing.length})
              </div>

              {errorMsg && (
                <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px", color: "var(--danger)", fontSize: "12px" }}>
                  {errorMsg}
                </div>
              )}

              {/* Supplier input rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                {rows.map((row, index) => {
                  const missSup = activeItem.missing[index];
                  const supplierColor = COLORS[suppliers.findIndex(s => s.id === row.supplierId) % COLORS.length];
                  const isRejected = missSup?.status === 'rejected';
                  const itemData = items.find(it => it.id === activeItem.item_id);
                  const isRecommended = itemData?.recommended_supplier_id === row.supplierId;
                  return (
                    <div key={row.supplierId} style={{
                      display: "flex", flexDirection: "column", gap: "6px",
                      padding: "10px 12px", borderRadius: "10px",
                      background: isRejected ? "rgba(239,68,68,0.04)" : "var(--bg-elevated)",
                      border: `1px solid ${isRejected ? "rgba(239,68,68,0.20)" : "var(--border-light)"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{
                            width: "20px", height: "20px", borderRadius: "50%",
                            background: supplierColor + "15", border: `1.5px solid ${supplierColor}44`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "9px", fontWeight: 700, color: supplierColor,
                          }}>
                            {missSup?.supplier_name.charAt(0) || "?"}
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {missSup?.supplier_name}
                          </span>
                          {isRecommended && <span style={{ color: "#eab308", fontSize: "12px" }} title={isAr ? "المورد الموصى به" : "Recommended"}>⭐</span>}
                          {isRejected && (
                            <span className="badge badge-danger" style={{ fontSize: "9px", padding: "1px 5px" }}>
                              {isAr ? "مرفوض" : "Rejected"}
                            </span>
                          )}
                        </div>
                        {missSup?.prev_price != null && (
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {isAr ? "السابق" : "Prev"}: {formatCurrency(missSup.prev_price)}
                          </span>
                        )}
                      </div>
                      {isRejected && missSup?.review_note && (
                        <div style={{ fontSize: "10px", color: "var(--danger)", fontStyle: "italic", paddingInlineStart: "26px" }}>
                          ⚠️ {missSup.review_note}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          type="number"
                          step="any"
                          placeholder={isAr ? "السعر (EGP)" : "Price (EGP)"}
                          value={row.price}
                          onChange={(e) => {
                            const newRows = [...rows];
                            newRows[index].price = e.target.value;
                            setRows(newRows);
                          }}
                          style={{
                            width: "100%", padding: "8px 10px", borderRadius: "8px",
                            border: "1px solid var(--border)", background: "var(--bg-surface)",
                            color: "var(--text-primary)", fontSize: "13px", outline: "none",
                          }}
                        />
                        <input
                          type="number"
                          step="any"
                          placeholder={isAr ? "تكلفة النقل (اختياري)" : "Transport (optional)"}
                          value={row.transport}
                          onChange={(e) => {
                            const newRows = [...rows];
                            newRows[index].transport = e.target.value;
                            setRows(newRows);
                          }}
                          style={{
                            width: "100%", padding: "8px 10px", borderRadius: "8px",
                            border: "1px solid var(--border)", background: "var(--bg-surface)",
                            color: "var(--text-primary)", fontSize: "13px", outline: "none",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes */}
              <div>
                <input
                  type="text"
                  placeholder={isAr ? "ملاحظة مشتركة (اختياري)..." : "Shared note (optional)..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "var(--bg-elevated)",
                    color: "var(--text-primary)", fontSize: "12px", outline: "none",
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--border-light)",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveItem(null);
                    router.push(
                      `/dashboard/purchasing?categoryId=${activeItem.category_id}&itemId=${activeItem.item_id}`
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
                    onClick={() => setActiveItem(null)}
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
