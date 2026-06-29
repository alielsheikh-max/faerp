"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import { addPriceEntrySilent } from "@/app/actions/pricing";
import { ChangeRequestModal } from "./purchasing-form";
import type { Item, Supplier } from "./purchasing-form";

type Entry = {
  id: number;
  supplier_id: number;
  month: string;
  price: number;
  collected_by: string;
  notes: string;
  recorded_at: string;
  item_name: string;
  item_id: number;
  category_name: string;
  supplier_name: string;
  supplier_display_name: string;
  actual_transport?: number | null;
  negotiated_price?: number | null;
  negotiated_notes?: string | null;
  status?: string;
  review_note?: string | null;
};

type Group = {
  key: string;
  month: string;
  item_id: number;
  category_name: string;
  item_name: string;
  entries: Entry[];
};

function buildGroups(entries: Entry[]): Group[] {
  const groups: Group[] = [];
  const seen = new Map<string, Group>();
  for (const e of entries) {
    const key = `${e.month}||${e.item_id}`;
    if (!seen.has(key)) {
      const g: Group = { key, month: e.month, item_id: e.item_id, category_name: e.category_name, item_name: e.item_name, entries: [] };
      groups.push(g);
      seen.set(key, g);
    }
    seen.get(key)!.entries.push(e);
  }
  return groups;
}

type Props = {
  entries: Entry[];
  suppliers: Supplier[];
  username: string;
  month: string; // current month
  items: Item[];
  role: string;
};

const BTN = {
  base: {
    border: "none", borderRadius: "6px", cursor: "pointer",
    fontWeight: 700, fontSize: "11px", padding: "3px 8px",
    display: "inline-flex", alignItems: "center", gap: "3px",
    transition: "opacity 120ms",
  } as React.CSSProperties,
};

export default function RecentPricesTable({ entries, suppliers, username, month: currentMonth, items, role }: Props) {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const router = useRouter();
  const groups = buildGroups(entries);

  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  // Change request modal state
  const [changeRequestModal, setChangeRequestModal] = useState<{
    supplier: Supplier;
    item: Item;
    currentPrice: number;
    newPrice: number;
    oldTransport?: number | null;
    newTransport?: number | null;
    isNegotiation?: boolean;
    isFirstEntry?: boolean;
  } | null>(null);

  // Add state
  const [addingKey, setAddingKey]   = useState<string | null>(null);
  const [addSup, setAddSup]         = useState("");
  const [addPrice, setAddPrice]     = useState("");
  const [addNotes, setAddNotes]     = useState("");
  // Shared loading / error
  const [saving, setSaving]         = useState(false);
  const [errMsg, setErrMsg]         = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function startAdd(group: Group) {
    setAddingKey(group.key);
    setAddSup("");
    setAddPrice("");
    setAddNotes("");
    setErrMsg(null);
  }

  function cancelAdd() { setAddingKey(null); setErrMsg(null); }

  async function saveAdd(group: Group) {
    const supId = parseInt(addSup);
    const p = parseFloat(addPrice);
    if (!supId) { setErrMsg(isAr ? "يرجى تحديد المورد." : "Please select a supplier."); return; }
    if (!p || p <= 0) { setErrMsg(isAr ? "يجب أن يكون السعر رقمًا موجبًا." : "Price must be a positive number."); return; }
    setSaving(true); setErrMsg(null);
    const res = await addPriceEntrySilent({
      itemId: group.item_id,
      supplierId: supId,
      month: group.month,
      price: p,
      notes: addNotes.trim(),
      collectedBy: username,
    });
    setSaving(false);
    if (res.ok) { setAddingKey(null); router.refresh(); }
    else setErrMsg(res.error || (isAr ? "فشل الحفظ." : "Save failed."));
  }

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px", fontSize: "13px" }}>
        {isAr ? "لا توجد أسعار مسجلة بعد." : "No prices recorded yet."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {errMsg && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px" }}>
          ⚠️ {errMsg}
        </div>
      )}

      {groups.map(group => {
        const open     = expanded.has(group.key);
        const isAdding = addingKey === group.key;
        const count    = group.entries.length;
        const prices   = group.entries.map(e => e.price);
        const minP     = Math.min(...prices);
        const maxP     = Math.max(...prices);
        const avgP     = prices.reduce((a, b) => a + b, 0) / prices.length;
        const isCurrentMonth = group.month === currentMonth;

        // Suppliers not yet recorded for this group (for add dropdown)
        const recordedSupIds = new Set(group.entries.map(e => e.supplier_id));
        const availableSuppliers = suppliers.filter(s => !recordedSupIds.has(s.id));

        return (
          <div key={group.key} style={{
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            background: "var(--bg-surface)",
          }}>
            {/* ── Group header row ── */}
            <div
              onClick={() => toggle(group.key)}
              className="recent-price-group-header"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto auto auto",
                gap: "10px",
                alignItems: "center",
                padding: "10px 14px",
                cursor: "pointer",
                background: open ? "var(--bg-subtle)" : "var(--bg-surface)",
                transition: "background 120ms",
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "14px" }}>
                {open ? "▼" : "▶"}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span
                    onClick={(ev) => {
                      ev.stopPropagation();
                      window.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: group.item_id } }));
                    }}
                    className="clickable-detail-trigger"
                  >
                    {group.item_name}
                  </span>
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                  <span className="badge badge-strong" style={{ fontSize: "9px", padding: "1px 6px" }}>{group.category_name}</span>
                </div>
              </div>
              <div className="recent-price-group-details-wrapper">
                <span className="badge" style={{ fontSize: "11px", whiteSpace: "nowrap" }}>{formatMonthLabel(group.month)}</span>
                <span className="recent-price-count-label" style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {count} {isAr ? "مورد" : count === 1 ? "supplier" : "suppliers"}
                </span>
                <div className="recent-price-range-label" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {minP === maxP ? (
                    <span style={{ fontSize: "12.5px" }}>
                      <strong style={{ color: "var(--success)" }}>{formatCurrency(minP)}</strong>
                      <span style={{ color: "var(--text-muted)", margin: "0 6px", fontSize: "10px" }}>· {isAr ? "المتوسط" : "avg"} {formatCurrency(avgP)}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: "11.5px" }}>
                      <strong style={{ color: "var(--success)" }}>{formatCurrency(minP)}</strong>
                      <span style={{ color: "var(--text-muted)", margin: "0 3px" }}>–</span>
                      <strong style={{ color: "var(--danger)" }}>{formatCurrency(maxP)}</strong>
                      <span style={{ color: "var(--text-muted)", marginInlineStart: "6px", fontSize: "10px" }}>{isAr ? "المتوسط" : "avg"} {formatCurrency(avgP)}</span>
                    </span>
                  )}
                </div>
                {count > 1 ? (
                  <div className="recent-price-best-label" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {(() => {
                      const best = group.entries.reduce((a, b) => a.price < b.price ? a : b);
                      return (
                        <span
                          onClick={(ev) => {
                            ev.stopPropagation();
                            window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: best.supplier_id } }));
                          }}
                          className="clickable-detail-trigger"
                          style={{ fontSize: "10px" }}
                        >
                          🏆 {best.supplier_display_name}
                        </span>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="recent-price-best-label-empty" />
                )}
              </div>
            </div>

            {/* ── Expanded rows ── */}
            {open && (
              <div className="table-responsive" style={{ borderTop: "1px solid var(--border-light)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)" }}>
                      {[
                        isAr ? "المورد" : "Supplier",
                        isAr ? "السعر" : "Price",
                        isAr ? "الملاحظات" : "Notes",
                        isAr ? "بواسطة" : "By",
                        isAr ? "تاريخ التسجيل" : "Recorded",
                        ""
                      ].map((h, i) => (
                        <th key={i} style={{
                          padding: "7px 12px",
                          textAlign: i === 1 ? "right" : (isAr ? "right" : "left"),
                          fontWeight: 700, color: "var(--text-muted)", fontSize: "10px",
                          textTransform: "uppercase", letterSpacing: "0.05em",
                          borderBottom: "1px solid var(--border-light)",
                          whiteSpace: "nowrap",
                        }}>
                          {h || (isCurrentMonth && availableSuppliers.length > 0 ? (
                            <button
                              onClick={e => { e.stopPropagation(); isAdding ? cancelAdd() : startAdd(group); }}
                              style={{
                                ...BTN.base,
                                background: isAdding ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.12)",
                                color: isAdding ? "var(--danger)" : "var(--success)",
                                padding: "3px 8px",
                              }}
                            >
                              {isAdding ? (isAr ? "✕ إلغاء" : "✕ Cancel") : (isAr ? "＋ إضافة" : "＋ Add")}
                            </button>
                          ) : null)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...group.entries].sort((a, b) => a.price - b.price).map((e, idx) => {
                      const isBest    = e.price === minP;
                      const isWorst   = e.price === maxP && count > 1;

                      return (
                        <tr key={e.id} style={{
                          background: idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)",
                          borderBottom: "1px solid var(--border-light)",
                        }}>
                          {/* Supplier */}
                          <td style={{ padding: "8px 12px", fontWeight: isBest ? 700 : 400, color: isBest ? "var(--success)" : "var(--text-primary)", minWidth: "130px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              {isBest && <span>🏆</span>}
                          <span
                                onClick={() => window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: e.supplier_id } }))}
                                className="clickable-detail-trigger"
                              >
                                {e.supplier_display_name}
                              </span>
                              {(() => {
                                const item = items.find(it => it.id === e.item_id);
                                return item?.recommended_supplier_id === e.supplier_id ? (
                                  <span style={{ color: "#eab308", fontSize: "12px", cursor: "help", flexShrink: 0 }} title={isAr ? "المورد الموصى به" : "Recommended Supplier"}>⭐</span>
                                ) : null;
                              })()}
                              {e.status === 'pending' && (
                                <span className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 6px', lineHeight: 1 }}>
                                  {isAr ? "معلق" : "Pending"}
                                </span>
                              )}
                              {e.status === 'rejected' && (
                                <span className="badge badge-danger" style={{ fontSize: '9px', padding: '1px 6px', lineHeight: 1 }} title={e.review_note || undefined}>
                                  {isAr ? "مرفوض" : "Rejected"}
                                </span>
                              )}
                            </div>
                            {e.supplier_display_name !== e.supplier_name && (
                              <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginTop: "1px" }}>{e.supplier_name}</div>
                            )}
                          </td>

                          {/* Price */}
                          <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <strong style={{ color: isBest ? "var(--success)" : isWorst ? "var(--danger)" : "var(--text-primary)", fontSize: "13px" }}>
                              {formatCurrency(e.price)}
                            </strong>
                          </td>

                          {/* Notes */}
                          <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "11.5px", maxWidth: "160px" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                              {e.notes || "—"}
                            </span>
                          </td>

                          {/* By */}
                          <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontSize: "11px", whiteSpace: "nowrap" }}>
                            {e.collected_by}
                          </td>

                          {/* Recorded */}
                          <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "11px", whiteSpace: "nowrap" }}>
                            {formatDateTime(e.recorded_at)}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {isCurrentMonth ? (
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const item = items.find(i => i.id === e.item_id);
                                    const supplier = suppliers.find(s => s.id === e.supplier_id);
                                    if (item && supplier) {
                                      setChangeRequestModal({
                                        supplier,
                                        item,
                                        currentPrice: e.price,
                                        newPrice: e.price,
                                        oldTransport: e.actual_transport,
                                        newTransport: e.actual_transport,
                                        isNegotiation: false,
                                        isFirstEntry: false,
                                      });
                                    }
                                  }}
                                  title={isAr ? "تعديل السعر/النقل" : "Edit price/transport"}
                                  className="button button-warning"
                                  style={{ padding: "3px 6px", fontSize: "11px", height: "auto" }}
                                >
                                  ✏️ {isAr ? "تعديل" : "Edit"}
                                </button>
                                {role === "WH" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const item = items.find(i => i.id === e.item_id);
                                      const supplier = suppliers.find(s => s.id === e.supplier_id);
                                      if (item && supplier) {
                                        setChangeRequestModal({
                                          supplier,
                                          item,
                                          currentPrice: e.price,
                                          newPrice: e.price,
                                          oldTransport: e.actual_transport,
                                          newTransport: e.actual_transport,
                                          isNegotiation: true,
                                          isFirstEntry: false,
                                        });
                                      }
                                    }}
                                    title={isAr ? "التفاوض على السعر" : "Negotiate price"}
                                    className="button"
                                    style={{
                                      padding: "3px 6px", fontSize: "11px", height: "auto",
                                      background: "rgba(139,92,246,0.12)",
                                      color: "#8b5cf6",
                                      border: "1px solid rgba(139,92,246,0.35)",
                                      borderRadius: "var(--radius-sm)"
                                    }}
                                  >
                                    🤝 {isAr ? "تفاوض" : "Negotiate"}
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}

                    {/* ── Add new entry row ── */}
                    {isAdding && (
                      <tr style={{ background: "rgba(99,102,241,0.04)", borderBottom: "1px solid var(--border-light)" }}>
                        {/* Supplier dropdown */}
                        <td style={{ padding: "8px 12px" }}>
                          <select
                            value={addSup}
                            onChange={ev => setAddSup(ev.target.value)}
                            style={{ padding: "5px 8px", borderRadius: "6px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "12px", minWidth: "130px" }}
                            autoFocus
                          >
                            <option value="">— {isAr ? "المورد" : "Supplier"} —</option>
                            {availableSuppliers.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.fame_name || s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Price */}
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          <input
                            type="number" step="any" min="0"
                            value={addPrice}
                            onChange={ev => setAddPrice(ev.target.value)}
                            placeholder={isAr ? "السعر…" : "Price…"}
                            style={{ width: "90px", padding: "4px 8px", borderRadius: "6px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 700, fontSize: "12px", textAlign: "right" }}
                          />
                        </td>
                        {/* Notes */}
                        <td style={{ padding: "8px 12px" }}>
                          <input
                            type="text"
                            value={addNotes}
                            onChange={ev => setAddNotes(ev.target.value)}
                            placeholder={isAr ? "الملاحظات…" : "Notes…"}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "11.5px" }}
                          />
                        </td>
                        <td colSpan={2} style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "11px" }}>
                          {username} · {formatMonthLabel(group.month)}
                        </td>
                        {/* Save/Cancel */}
                        <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", gap: "4px" }}>
                            <button
                              onClick={() => saveAdd(group)}
                              disabled={saving}
                              style={{ ...BTN.base, background: "rgba(16,185,129,0.12)", color: "var(--success)", opacity: saving ? 0.5 : 1 }}
                            >
                              {saving ? "…" : (isAr ? "✓ حفظ" : "✓ Save")}
                            </button>
                            <button
                              onClick={cancelAdd}
                              disabled={saving}
                              style={{ ...BTN.base, background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}
                            >
                              ✕
                            </button>
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {changeRequestModal && (
        <ChangeRequestModal
          supplier={changeRequestModal.supplier}
          item={changeRequestModal.item}
          month={currentMonth}
          currentPrice={changeRequestModal.currentPrice}
          newPrice={changeRequestModal.newPrice}
          oldTransport={changeRequestModal.oldTransport}
          newTransport={changeRequestModal.newTransport}
          requestedBy={username}
          isNegotiation={changeRequestModal.isNegotiation}
          isFirstEntry={changeRequestModal.isFirstEntry}
          onClose={() => {
            setChangeRequestModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
