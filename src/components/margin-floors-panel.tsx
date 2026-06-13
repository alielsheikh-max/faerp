"use client";

import { useState } from "react";
import { setMarginFloorAction, deleteMarginFloorAction } from "@/app/actions/pricing";
import type { MarginFloor } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

type Category = { id: number; name: string };
type Item = { id: number; name: string; category_id: number; category_name: string };

type Props = {
  floors: MarginFloor[];
  categories: Category[];
  items: Item[];
  username: string;
};

export default function MarginFloorsPanel({ floors, categories, items, username }: Props) {
  const [floorType, setFloorType] = useState<"category" | "item">("category");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [minPct, setMinPct] = useState<string>("8");
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState("");

  // Items filtered by selected category when adding item-level floor
  const itemsForCat = selectedCategoryId
    ? items.filter((i) => String(i.category_id) === selectedCategoryId)
    : items;

  // Display: group existing floors
  const catFloors = floors.filter((f) => f.floor_type === "category");
  const itemFloors = floors.filter((f) => f.floor_type === "item");

  const filteredItemFloors = filterCat
    ? itemFloors.filter((f) => {
        const item = items.find((i) => i.id === f.item_id);
        return item && String(item.category_id) === filterCat;
      })
    : itemFloors;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Add / Update Floor Form ─────────────────────────────────────────── */}
      <div style={{
        padding: "18px 20px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-accent)",
        borderRadius: "var(--radius-lg)",
      }}>
        <div style={{ marginBottom: "14px" }}>
          <p className="eyebrow" style={{ fontSize: "10px", marginBottom: "4px" }}>Configure</p>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
            Add / Update Margin Floor
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Set the minimum markup % that SC can apply when publishing selling prices. Item-level floors override category floors.
          </p>
        </div>

        <form action={setMarginFloorAction} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input type="hidden" name="setBy" value={username} />

          {/* Floor type toggle */}
          <div style={{ display: "flex", gap: "8px" }}>
            {(["category", "item"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setFloorType(t); setSelectedItemId(""); }}
                className={`button ${floorType === t ? "button-primary" : "button-secondary"}`}
                style={{ padding: "7px 16px", fontSize: "12px" }}
              >
                {t === "category" ? "📦 Category-level" : "🏷 Item-level"}
              </button>
            ))}
          </div>

          <input type="hidden" name="floorType" value={floorType} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "flex-end" }}>
            {/* Category selector — always shown */}
            <label className="field">
              <span>{floorType === "category" ? "Category" : "Category (to filter items)"}</span>
              <select
                name={floorType === "category" ? "categoryId" : "_catFilter"}
                value={selectedCategoryId}
                onChange={(e) => { setSelectedCategoryId(e.target.value); setSelectedItemId(""); }}
                required={floorType === "category"}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            {/* Item selector — only for item-level */}
            {floorType === "item" ? (
              <label className="field">
                <span>Item</span>
                <select
                  name="itemId"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  required
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}
                >
                  <option value="">— Select item —</option>
                  {itemsForCat.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              // Hidden placeholder to keep grid alignment
              <div />
            )}

            {/* Min Markup % */}
            <label className="field" style={{ minWidth: "110px" }}>
              <span>Min Markup %</span>
              <input
                type="number"
                name="minMarkupPct"
                min="0"
                max="50"
                step="0.5"
                value={minPct}
                onChange={(e) => setMinPct(e.target.value)}
                required
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 700 }}
              />
            </label>
          </div>

          {/* Notes */}
          <label className="field">
            <span>Notes (optional)</span>
            <input
              type="text"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Finance directive Q3 2026"
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}
            />
          </label>

          <button
            type="submit"
            className="button button-primary"
            style={{ alignSelf: "flex-start", padding: "9px 22px", fontSize: "13px" }}
          >
            Save Floor Rule
          </button>
        </form>
      </div>

      {/* ── Category Floors Table ───────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
            📦 Category-level Floors
            <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginInlineStart: "8px" }}>
              ({catFloors.length} rules)
            </span>
          </h4>
        </div>

        {catFloors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "12px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border-light)" }}>
            No category floors configured yet.
          </div>
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["Category", "Min Markup %", "Set By", "Set At", "Notes", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catFloors.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{f.category_name}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--warning)" }}>{f.min_markup_pct}%</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "12px" }}>{f.set_by}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "12px" }}>{formatDateTime(f.set_at)}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: "12px" }}>{f.notes ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <FloorDeleteButton id={f.id} confirm={confirmDelete} setConfirm={setConfirmDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Item Floors Table ───────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
          <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
            🏷 Item-level Floors
            <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginInlineStart: "8px" }}>
              ({itemFloors.length} rules)
            </span>
          </h4>
          {itemFloors.length > 0 && (
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "12px" }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {filteredItemFloors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "12px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border-light)" }}>
            No item-level floors configured.
          </div>
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["Item", "Category", "Min Markup %", "Set By", "Set At", "Notes", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItemFloors.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: "12px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.item_name}>{f.item_name ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="badge" style={{ fontSize: "10px" }}>{f.category_name ?? "—"}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--primary)" }}>{f.min_markup_pct}%</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "12px" }}>{f.set_by}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "12px" }}>{formatDateTime(f.set_at)}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: "12px" }}>{f.notes ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <FloorDeleteButton id={f.id} confirm={confirmDelete} setConfirm={setConfirmDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Small inline delete button with confirm step
function FloorDeleteButton({
  id,
  confirm,
  setConfirm,
}: {
  id: number;
  confirm: number | null;
  setConfirm: (v: number | null) => void;
}) {
  if (confirm === id) {
    return (
      <div style={{ display: "flex", gap: "5px" }}>
        <form action={deleteMarginFloorAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="button button-danger" style={{ padding: "5px 10px", fontSize: "11px" }}>
            Confirm
          </button>
        </form>
        <button
          type="button"
          className="button button-secondary"
          style={{ padding: "5px 10px", fontSize: "11px" }}
          onClick={() => setConfirm(null)}
        >
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="button button-secondary"
      style={{ padding: "5px 10px", fontSize: "11px", color: "var(--danger)", borderColor: "rgba(220,38,38,0.3)" }}
      onClick={() => setConfirm(id)}
    >
      Remove
    </button>
  );
}
