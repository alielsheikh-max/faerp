"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import { updatePriceEntryAction, addPriceEntrySilent } from "@/app/actions/pricing";

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
};

type Supplier = { id: number; name: string; fame_name?: string | null };

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
};

const BTN = {
  base: {
    border: "none", borderRadius: "6px", cursor: "pointer",
    fontWeight: 700, fontSize: "11px", padding: "3px 8px",
    display: "inline-flex", alignItems: "center", gap: "3px",
    transition: "opacity 120ms",
  } as React.CSSProperties,
};

export default function RecentPricesTable({ entries, suppliers, username, month: currentMonth }: Props) {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const router = useRouter();
  const groups = buildGroups(entries);

  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  // Edit state
  const [editId, setEditId]         = useState<number | null>(null);
  const [editPrice, setEditPrice]   = useState("");
  const [editNotes, setEditNotes]   = useState("");
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

  function startEdit(e: Entry) {
    setEditId(e.id);
    setEditPrice(String(e.price));
    setEditNotes(e.notes || "");
    setErrMsg(null);
  }

  function cancelEdit() { setEditId(null); setErrMsg(null); }

  async function saveEdit(e: Entry) {
    const p = parseFloat(editPrice);
    if (!p || p <= 0) { setErrMsg("Price must be a positive number."); return; }
    setSaving(true); setErrMsg(null);
    const res = await updatePriceEntryAction({ id: e.id, price: p, notes: editNotes.trim() });
    setSaving(false);
    if (res.ok) { setEditId(null); router.refresh(); }
    else setErrMsg(res.error || "Save failed.");
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
    if (!supId) { setErrMsg("Please select a supplier."); return; }
    if (!p || p <= 0) { setErrMsg("Price must be a positive number."); return; }
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
    else setErrMsg(res.error || "Save failed.");
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
                  {group.item_name}
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                  <span className="badge badge-strong" style={{ fontSize: "9px", padding: "1px 6px" }}>{group.category_name}</span>
                </div>
              </div>
              <span className="badge" style={{ fontSize: "11px", whiteSpace: "nowrap" }}>{group.month}</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {count} {isAr ? "مورد" : count === 1 ? "supplier" : "suppliers"}
              </span>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                {minP === maxP ? (
                  <strong style={{ color: "var(--success)", fontSize: "13px" }}>{formatCurrency(minP)}</strong>
                ) : (
                  <span style={{ fontSize: "11.5px" }}>
                    <strong style={{ color: "var(--success)" }}>{formatCurrency(minP)}</strong>
                    <span style={{ color: "var(--text-muted)", margin: "0 3px" }}>–</span>
                    <strong style={{ color: "var(--danger)" }}>{formatCurrency(maxP)}</strong>
                  </span>
                )}
                <div style={{ fontSize: "9.5px", color: "var(--text-muted)" }}>
                  {isAr ? "متوسط" : "avg"} {formatCurrency(avgP)}
                </div>
              </div>
              {count > 1 && (
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {(() => {
                    const best = group.entries.reduce((a, b) => a.price < b.price ? a : b);
                    return (
                      <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 600 }}>
                        🏆 {best.supplier_display_name}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Expanded rows ── */}
            {open && (
              <div style={{ borderTop: "1px solid var(--border-light)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)" }}>
                      {["Supplier", "Price", "Notes", "By", "Recorded", ""].map((h, i) => (
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
                              {isAdding ? "✕ Cancel" : "＋ Add"}
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
                      const isEditing = editId === e.id;

                      return (
                        <tr key={e.id} style={{
                          background: idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)",
                          borderBottom: "1px solid var(--border-light)",
                        }}>
                          {/* Supplier */}
                          <td style={{ padding: "8px 12px", fontWeight: isBest ? 700 : 400, color: isBest ? "var(--success)" : "var(--text-primary)", minWidth: "130px" }}>
                            {isBest && <span style={{ marginInlineEnd: "4px" }}>🏆</span>}
                            {e.supplier_display_name}
                            {e.supplier_display_name !== e.supplier_name && (
                              <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginTop: "1px" }}>{e.supplier_name}</div>
                            )}
                          </td>

                          {/* Price */}
                          <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {isEditing ? (
                              <input
                                type="number" step="any" min="0"
                                value={editPrice}
                                onChange={ev => setEditPrice(ev.target.value)}
                                style={{ width: "90px", padding: "4px 8px", borderRadius: "6px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 700, fontSize: "12px", textAlign: "right" }}
                                autoFocus
                              />
                            ) : (
                              <strong style={{ color: isBest ? "var(--success)" : isWorst ? "var(--danger)" : "var(--text-primary)", fontSize: "13px" }}>
                                {formatCurrency(e.price)}
                              </strong>
                            )}
                          </td>

                          {/* Notes */}
                          <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "11.5px", maxWidth: "160px" }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editNotes}
                                onChange={ev => setEditNotes(ev.target.value)}
                                placeholder="Notes…"
                                style={{ width: "100%", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "11.5px" }}
                              />
                            ) : (
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                                {e.notes || "—"}
                              </span>
                            )}
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
                            {isEditing ? (
                              <span style={{ display: "inline-flex", gap: "4px" }}>
                                <button
                                  onClick={() => saveEdit(e)}
                                  disabled={saving}
                                  style={{ ...BTN.base, background: "rgba(16,185,129,0.12)", color: "var(--success)", opacity: saving ? 0.5 : 1 }}
                                >
                                  {saving ? "…" : "✓"}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  style={{ ...BTN.base, background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}
                                >
                                  ✕
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => startEdit(e)}
                                title="Edit price"
                                style={{
                                  ...BTN.base,
                                  background: "var(--bg-subtle)",
                                  color: "var(--text-muted)",
                                  padding: "3px 7px",
                                  fontSize: "12px",
                                  border: "1px solid var(--border-light)",
                                }}
                              >
                                ✏️
                              </button>
                            )}
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
                            <option value="">— Supplier —</option>
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
                            placeholder="Price…"
                            style={{ width: "90px", padding: "4px 8px", borderRadius: "6px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 700, fontSize: "12px", textAlign: "right" }}
                          />
                        </td>
                        {/* Notes */}
                        <td style={{ padding: "8px 12px" }}>
                          <input
                            type="text"
                            value={addNotes}
                            onChange={ev => setAddNotes(ev.target.value)}
                            placeholder="Notes…"
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "11.5px" }}
                          />
                        </td>
                        <td colSpan={2} style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "11px" }}>
                          {username} · {group.month}
                        </td>
                        {/* Save/Cancel */}
                        <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", gap: "4px" }}>
                            <button
                              onClick={() => saveAdd(group)}
                              disabled={saving}
                              style={{ ...BTN.base, background: "rgba(16,185,129,0.12)", color: "var(--success)", opacity: saving ? 0.5 : 1 }}
                            >
                              {saving ? "…" : "✓ Save"}
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
    </div>
  );
}
