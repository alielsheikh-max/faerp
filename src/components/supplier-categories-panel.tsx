"use client";

import { useState, useTransition } from "react";
import { bulkAssignSupplierCategoriesAction } from "@/app/actions/admin";

type Category = { id: number; name: string; description: string };
type Supplier  = { id: number; name: string; category_ids: number[] };

type Props = {
  suppliers:  Supplier[];
  categories: Category[];
};

export default function SupplierCategoriesPanel({ suppliers, categories }: Props) {
  // Local mutable copy of category assignments keyed by supplier id
  const [catMap, setCatMap] = useState<Record<number, Set<number>>>(() => {
    const m: Record<number, Set<number>> = {};
    for (const s of suppliers) m[s.id] = new Set(s.category_ids);
    return m;
  });

  // Track which suppliers have unsaved changes
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  const [selectedId, setSelectedId]   = useState<number | null>(suppliers[0]?.id ?? null);
  const [result, setResult]           = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [isPending, startTransition]  = useTransition();

  const selected = suppliers.find(s => s.id === selectedId) ?? null;
  const current  = selectedId ? (catMap[selectedId] ?? new Set<number>()) : new Set<number>();
  const dirtyCount = dirty.size;

  function toggle(catId: number) {
    if (!selectedId) return;
    setCatMap(prev => {
      const next = { ...prev };
      const set  = new Set(next[selectedId] ?? []);
      if (set.has(catId)) set.delete(catId); else set.add(catId);
      next[selectedId] = set;
      return next;
    });
    setDirty(prev => new Set(prev).add(selectedId));
    setResult(null);
  }

  function handleSaveAll() {
    if (dirty.size === 0) return;

    // Build assignments only for dirty suppliers
    const assignments = Array.from(dirty).map(sid => ({
      supplierId: sid,
      categoryIds: Array.from(catMap[sid] ?? []),
    }));

    const fd = new FormData();
    fd.append("assignments", JSON.stringify(assignments));

    startTransition(async () => {
      const res = await bulkAssignSupplierCategoriesAction(fd);
      setResult(res);
      if (res.success) setDirty(new Set()); // clear dirty on success
    });
  }

  function assignCount(sid: number) {
    return catMap[sid]?.size ?? 0;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

      {/* ── Global save bar ──────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: dirtyCount > 0 ? "rgba(59,130,246,0.06)" : "var(--bg-subtle)",
        border: `1px solid ${dirtyCount > 0 ? "var(--primary)" : "var(--border-light)"}`,
        borderRadius: "10px 10px 0 0",
        transition: "all 0.15s",
      }}>
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {dirtyCount > 0
            ? <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                ● {dirtyCount} supplier{dirtyCount > 1 ? "s" : ""} with unsaved changes
              </span>
            : "Select a supplier on the left, tick categories, then save all at once."}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {result && (
            <div style={{
              fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "8px",
              background: result.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              color: result.success ? "var(--success)" : "var(--danger)",
              border: `1px solid ${result.success ? "var(--success)" : "var(--danger)"}`,
            }}>
              {result.success ? `✅ ${result.message}` : `❌ ${result.error}`}
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveAll}
            className="button button-primary"
            disabled={isPending || dirtyCount === 0}
            style={{
              padding: "8px 20px", fontSize: "13px", fontWeight: 700,
              opacity: dirtyCount === 0 ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {isPending
              ? "Saving…"
              : dirtyCount > 0
                ? `Save All Changes (${dirtyCount} supplier${dirtyCount > 1 ? "s" : ""})`
                : "Save All Changes"}
          </button>
        </div>
      </div>

      {/* ── Two-column body ──────────────────────────────────────── */}
      <div style={{ display: "flex", minHeight: "340px", border: "1px solid var(--border-light)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>

        {/* Left: Supplier list */}
        <div style={{
          width: "230px", flexShrink: 0,
          borderRight: "1px solid var(--border-light)",
          background: "var(--bg-subtle)",
          overflowY: "auto",
        }}>
          <div style={{ padding: "10px 14px 6px", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Suppliers
          </div>
          {suppliers.map(s => {
            const count    = assignCount(s.id);
            const isDirty  = dirty.has(s.id);
            const isActive = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => { setSelectedId(s.id); }}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 14px",
                  background: isActive ? "var(--bg-surface)" : "transparent",
                  borderLeft: `3px solid ${isActive ? "var(--primary)" : isDirty ? "var(--warning)" : "transparent"}`,
                  border: "none", borderBottom: "1px solid var(--border-light)",
                  cursor: "pointer", transition: "all 0.12s",
                  display: "flex", alignItems: "flex-start", gap: "8px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "12.5px", color: "var(--text-primary)", marginBottom: "2px", display: "flex", alignItems: "center", gap: "5px" }}>
                    {isDirty && <span style={{ color: "var(--warning)", fontSize: "9px" }}>●</span>}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  </div>
                  <div style={{ fontSize: "10.5px", color: count > 0 ? "var(--primary)" : "var(--text-muted)", fontWeight: count > 0 ? 600 : 400 }}>
                    {count > 0 ? `${count} categor${count === 1 ? "y" : "ies"}` : "No categories"}
                    {isDirty && <span style={{ color: "var(--warning)", marginLeft: "4px" }}>(unsaved)</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Category checkboxes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-surface)" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Select a supplier to assign categories
            </div>
          ) : (
            <>
              <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--border-light)" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 2px" }}>
                  Category Assignment
                </p>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {selected.name}
                  {dirty.has(selected.id) && (
                    <span style={{ marginLeft: "8px", fontSize: "10px", fontWeight: 600, color: "var(--warning)", background: "rgba(245,158,11,0.1)", padding: "2px 7px", borderRadius: "6px", border: "1px solid rgba(245,158,11,0.3)" }}>
                      Unsaved changes
                    </span>
                  )}
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  Check the categories this supplier is authorised to quote. WH will only see this supplier for items in these categories.
                </p>
              </div>

              <div style={{ flex: 1, padding: "14px 20px", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", alignContent: "start" }}>
                {categories.map(cat => {
                  const checked = current.has(cat.id);
                  return (
                    <label
                      key={cat.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 14px",
                        border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-light)"}`,
                        borderRadius: "8px",
                        background: checked ? "rgba(59,75,219,0.06)" : "var(--bg-elevated)",
                        cursor: "pointer", transition: "all 0.12s",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(cat.id)}
                        style={{ accentColor: "var(--primary)", width: "15px", height: "15px", cursor: "pointer", flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "12.5px", color: "var(--text-primary)" }}>{cat.name}</div>
                        {cat.description && (
                          <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px" }}>{cat.description}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
