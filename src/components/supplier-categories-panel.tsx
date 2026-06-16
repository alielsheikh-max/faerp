"use client";

import { useState, useTransition } from "react";
import { assignSupplierCategoriesAction } from "@/app/actions/admin";

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

  const [selectedId, setSelectedId] = useState<number | null>(suppliers[0]?.id ?? null);
  const [result, setResult]         = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = suppliers.find(s => s.id === selectedId) ?? null;
  const current  = selectedId ? (catMap[selectedId] ?? new Set<number>()) : new Set<number>();

  function toggle(catId: number) {
    if (!selectedId) return;
    setCatMap(prev => {
      const next = { ...prev };
      const set  = new Set(next[selectedId] ?? []);
      if (set.has(catId)) set.delete(catId); else set.add(catId);
      next[selectedId] = set;
      return next;
    });
    setResult(null);
  }

  function handleSave() {
    if (!selectedId) return;
    const fd = new FormData();
    fd.append("supplier_id", String(selectedId));
    for (const cid of catMap[selectedId] ?? []) fd.append("category_ids", String(cid));
    startTransition(async () => {
      const res = await assignSupplierCategoriesAction(fd);
      setResult(res);
    });
  }

  function assignCount(s: Supplier) {
    return catMap[s.id]?.size ?? 0;
  }

  return (
    <div style={{ display: "flex", gap: "0", minHeight: "320px", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border-light)" }}>

      {/* ── Left: Supplier list ───────────────────────────────────── */}
      <div style={{
        width: "220px", flexShrink: 0,
        borderRight: "1px solid var(--border-light)",
        background: "var(--bg-subtle)",
        overflowY: "auto",
      }}>
        <div style={{ padding: "12px 14px 8px", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Suppliers
        </div>
        {suppliers.map(s => {
          const count   = assignCount(s);
          const isActive = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => { setSelectedId(s.id); setResult(null); }}
              style={{
                width: "100%", textAlign: "left", padding: "10px 14px",
                background: isActive ? "var(--bg-surface)" : "transparent",
                borderLeft: `3px solid ${isActive ? "var(--primary)" : "transparent"}`,
                border: "none", borderBottom: "1px solid var(--border-light)",
                cursor: "pointer", transition: "all 0.12s",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "12.5px", color: "var(--text-primary)", marginBottom: "2px" }}>
                {s.name}
              </div>
              <div style={{ fontSize: "10.5px", color: count > 0 ? "var(--primary)" : "var(--text-muted)", fontWeight: count > 0 ? 600 : 400 }}>
                {count > 0 ? `${count} categor${count === 1 ? "y" : "ies"} assigned` : "No categories yet"}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Right: Category checkboxes ───────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-surface)" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            Select a supplier to assign categories
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-light)" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>
                Assign Categories
              </p>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                {selected.name}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "var(--text-muted)" }}>
                Check the product categories this supplier is authorised to quote for.
                WH users will only see this supplier when entering prices for items in these categories.
              </p>
            </div>

            {/* Category checkboxes */}
            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", alignContent: "start" }}>
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
                      background: checked ? "var(--primary-muted, rgba(59,75,219,0.06))" : "var(--bg-elevated)",
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

            {/* Footer: save button + result */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "14px", background: "var(--bg-elevated)" }}>
              <button
                type="button"
                onClick={handleSave}
                className="button button-primary"
                disabled={isPending}
                style={{ padding: "9px 22px", fontSize: "13px", fontWeight: 700, opacity: isPending ? 0.7 : 1 }}
              >
                {isPending ? "Saving…" : `Save — ${current.size} categor${current.size === 1 ? "y" : "ies"} assigned`}
              </button>

              {result && (
                <div style={{
                  fontSize: "12px", fontWeight: 600, padding: "7px 14px", borderRadius: "8px",
                  background: result.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                  color: result.success ? "var(--success)" : "var(--danger)",
                  border: `1px solid ${result.success ? "var(--success)" : "var(--danger)"}`,
                }}>
                  {result.success ? `✅ ${result.message}` : `❌ ${result.error}`}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
