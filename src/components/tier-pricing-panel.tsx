"use client";

import { useState } from "react";
import { saveItemTierConfigAction, deleteItemTierConfigAction } from "@/app/actions/pricing";
import { ItemCombobox } from "./item-combobox";
import type { ItemTierConfig } from "@/lib/db";

type Props = {
  tiers: ItemTierConfig[];
  items: Array<{ id: number; name: string; category_id: number; category_name: string }>;
  username: string;
};

type InlineEditState = {
  itemId: number;
  tier1Max: string;
  tier1Discount: string;
  tier2Max: string;
  tier2Discount: string;
  tier3Max: string;
  tier3Discount: string;
  tier4Max: string;
  tier4Discount: string;
};

export default function TierPricingPanel({ tiers, items, username }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [isTiered, setIsTiered] = useState(true);
  const [tier1Max, setTier1Max] = useState("100");
  const [tier1Discount, setTier1Discount] = useState("0.77");
  const [tier2Max, setTier2Max] = useState("200");
  const [tier2Discount, setTier2Discount] = useState("0.83");
  const [tier3Max, setTier3Max] = useState("800");
  const [tier3Discount, setTier3Discount] = useState("0.85");
  const [tier4Max, setTier4Max] = useState("0");
  const [tier4Discount, setTier4Discount] = useState("0.89");
  const [useTier4, setUseTier4] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);

  // Tier search state
  const [tierSearch, setTierSearch] = useState("");

  const activeTiers = tiers.filter((t) => t.is_tiered === 1);

  const handleItemSelect = (itemIdStr: string) => {
    setSelectedItemId(itemIdStr);
    const existing = tiers.find((t) => String(t.item_id) === itemIdStr);
    if (existing) {
      setIsTiered(existing.is_tiered === 1);
      setTier1Max(String(existing.tier1_max));
      setTier1Discount(String(existing.tier1_discount));
      setTier2Max(String(existing.tier2_max));
      setTier2Discount(String(existing.tier2_discount));
      setTier3Max(String(existing.tier3_max ?? 800));
      setTier3Discount(String(existing.tier3_discount));
      const has4 = (existing.tier4_max ?? 0) > 0 || (existing.tier4_discount ?? 0) > 0;
      setUseTier4(has4);
      setTier4Max(String(existing.tier4_max ?? 0));
      setTier4Discount(String(existing.tier4_discount ?? 0.89));
    } else {
      setIsTiered(true);
      setTier1Max("100");
      setTier1Discount("0.77");
      setTier2Max("200");
      setTier2Discount("0.83");
      setTier3Max("800");
      setTier3Discount("0.85");
      setUseTier4(false);
      setTier4Max("0");
      setTier4Discount("0.89");
    }
    // T22: scroll the form into view after selecting item to edit
    setTimeout(() => {
      document.getElementById("tier-form-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const startInlineEdit = (t: ItemTierConfig) => {
    setInlineEdit({
      itemId: t.item_id,
      tier1Max: String(t.tier1_max),
      tier1Discount: String(t.tier1_discount),
      tier2Max: String(t.tier2_max),
      tier2Discount: String(t.tier2_discount),
      tier3Max: String(t.tier3_max ?? 800),
      tier3Discount: String(t.tier3_discount),
      tier4Max: String(t.tier4_max ?? 0),
      tier4Discount: String(t.tier4_discount ?? 0.89),
    });
  };

  const cancelInlineEdit = () => setInlineEdit(null);

  const inlineInputStyle: React.CSSProperties = {
    width: "58px",
    padding: "3px 5px",
    fontSize: "11px",
    fontWeight: 700,
    textAlign: "center",
    borderRadius: "5px",
    border: "1.5px solid var(--border-accent)",
    background: "var(--bg-elevated)",
  };

  return (
    <div id="tier-form-top" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ── Add / Update Tier Form ─────────────────────────────────────────── */}
      <div style={{
        padding: "20px 24px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-accent)",
        borderRadius: "var(--radius-lg)",
      }}>
        <div style={{ marginBottom: "16px" }}>
          <p className="eyebrow" style={{ fontSize: "10px", marginBottom: "4px" }}>Discount Strategy</p>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
            Configure Volume Pricing Tiers
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Set quantity ranges and divisors for tiered items. Divisor formula: <strong>Sell Price = Buy Avg ÷ Divisor + Transport</strong>. Example: 0.77 = 23% margin. Up to 4 tiers supported.
          </p>
        </div>

        <form action={saveItemTierConfigAction} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Item selector */}
            <label className="field">
              <span>Select Product Item</span>
              {/* Hidden input preserves name="itemId" for server form submission */}
              <input type="hidden" name="itemId" value={selectedItemId} />
              <ItemCombobox
                items={items.map((i) => ({
                  id: i.id,
                  label: i.name,
                  category: i.category_name,
                }))}
                value={selectedItemId}
                onChange={handleItemSelect}
                placeholder="— Select an item —"
              />
            </label>

            {/* Is Tiered Toggle */}
            <label className="checkbox-row" style={{ alignSelf: "end", paddingBottom: "10px" }}>
              <input
                type="checkbox"
                name="isTiered"
                checked={isTiered}
                onChange={(e) => setIsTiered(e.target.checked)}
              />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Enable Tiered Pricing for this Item</span>
            </label>
          </div>

          {isTiered && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "16px",
              background: "var(--bg-subtle)",
              border: "1.5px dashed var(--border-medium)",
              borderRadius: "8px"
            }}>
              {/* Tiers grid: 2 cols per tier row */}
              {[
                { label: "Tier 1", maxName: "tier1Max", maxVal: tier1Max, setMax: setTier1Max, discName: "tier1Discount", discVal: tier1Discount, setDisc: setTier1Discount, color: "var(--success)", note: "1 → N units" },
                { label: "Tier 2", maxName: "tier2Max", maxVal: tier2Max, setMax: setTier2Max, discName: "tier2Discount", discVal: tier2Discount, setDisc: setTier2Discount, color: "var(--primary)", note: "N+1 → M units" },
                { label: "Tier 3", maxName: "tier3Max", maxVal: tier3Max, setMax: setTier3Max, discName: "tier3Discount", discVal: tier3Discount, setDisc: setTier3Discount, color: "var(--warning)", note: "M+1 → P units" },
              ].map((tier) => (
                <div key={tier.label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="field">
                    <span>{tier.label} Max Qty <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({tier.note})</span></span>
                    <input
                      type="number"
                      name={tier.maxName}
                      min="1"
                      value={tier.maxVal}
                      onChange={(e) => tier.setMax(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>{tier.label} Divisor (÷) <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "10px" }}>e.g. 0.77</span></span>
                    <input
                      type="number"
                      name={tier.discName}
                      min="0.01"
                      max="1"
                      step="0.001"
                      value={tier.discVal}
                      onChange={(e) => tier.setDisc(e.target.value)}
                      required
                      style={{ color: tier.color }}
                    />
                  </label>
                </div>
              ))}

              {/* Tier 4 toggle */}
              <label className="checkbox-row" style={{ marginTop: "4px" }}>
                <input
                  type="checkbox"
                  checked={useTier4}
                  onChange={(e) => setUseTier4(e.target.checked)}
                />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Add optional Tier 4 (highest volume range)
                </span>
              </label>

              {useTier4 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", paddingTop: "4px" }}>
                  <label className="field">
                    <span>Tier 4 Max Qty <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(P+1 → Q, 0 = unlimited)</span></span>
                    <input
                      type="number"
                      name="tier4Max"
                      min="0"
                      value={tier4Max}
                      onChange={(e) => setTier4Max(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Tier 4 Divisor (÷) <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "10px" }}>e.g. 0.89</span></span>
                    <input
                      type="number"
                      name="tier4Discount"
                      min="0.01"
                      max="1"
                      step="0.001"
                      value={tier4Discount}
                      onChange={(e) => setTier4Discount(e.target.value)}
                      style={{ color: "var(--danger)" }}
                    />
                  </label>
                </div>
              )}

              {/* Hidden fields for tier4 when not shown */}
              {!useTier4 && (
                <>
                  <input type="hidden" name="tier4Max" value="0" />
                  <input type="hidden" name="tier4Discount" value="0" />
                </>
              )}
            </div>
          )}

          {/* Hidden tier4 fields when tiered is disabled entirely */}
          {!isTiered && (
            <>
              <input type="hidden" name="tier1Max" value="100" />
              <input type="hidden" name="tier1Discount" value="0" />
              <input type="hidden" name="tier2Max" value="200" />
              <input type="hidden" name="tier2Discount" value="0" />
              <input type="hidden" name="tier3Max" value="300" />
              <input type="hidden" name="tier3Discount" value="0" />
              <input type="hidden" name="tier4Max" value="0" />
              <input type="hidden" name="tier4Discount" value="0" />
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="button button-primary" style={{ padding: "9px 20px", fontSize: "13px" }}>
              Save Volume Tiers configuration
            </button>
          </div>
        </form>
      </div>

      {/* ── Active Tiers list ────────────────────────────────────────────────── */}
      <div className="panel" style={{ padding: "20px 24px" }}>
        <div className="panel-header" style={{ borderBottom: "none", padding: 0, marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700 }}>Active Tier Rules</h3>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>Items with configured volume discount matrices</p>
          </div>
          <span className="badge badge-indigo">{activeTiers.length} items configured</span>
        </div>

        {activeTiers.length > 0 && (
          <div style={{ marginBottom: "14px" }}>
            <input
              type="text"
              placeholder="🔍 Search items by name or category..."
              value={tierSearch}
              onChange={(e) => setTierSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 14px",
                fontSize: "12px",
                border: "1.5px solid var(--border-medium)",
                borderRadius: "8px",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        )}

        {(() => {
          const filteredTiers = tierSearch.trim()
            ? activeTiers.filter((t) => {
                const q = tierSearch.toLowerCase();
                return t.item_name.toLowerCase().includes(q) || t.category_name.toLowerCase().includes(q);
              })
            : activeTiers;

          return filteredTiers.length === 0 && activeTiers.length > 0 ? (
            <div style={{ padding: "20px", textAlign: "center", border: "1px dashed var(--border-medium)", borderRadius: "8px" }}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No items match "{tierSearch}"</p>
            </div>
          ) : activeTiers.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", border: "1px dashed var(--border-medium)", borderRadius: "8px" }}>
            <span style={{ fontSize: "28px" }}>🏷️</span>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>No items are currently configured with tiers.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: "12px" }}>
              <thead>
                <tr>
                  <th>Product Item</th>
                  <th>Category</th>
                  <th style={{ textAlign: "center" }}>Tier 1</th>
                  <th style={{ textAlign: "center" }}>Tier 2</th>
                  <th style={{ textAlign: "center" }}>Tier 3</th>
                  <th style={{ textAlign: "center" }}>Tier 4</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTiers.map((t) => {
                  const has4 = (t.tier4_max ?? 0) > 0 || (t.tier4_discount ?? 0) > 0;
                  const isEditing = inlineEdit?.itemId === t.item_id;

                  if (isEditing && inlineEdit) {
                    // ── Inline Edit Mode ──
                    const ie = inlineEdit;
                    const has4Edit = Number(ie.tier4Max) > 0 || Number(ie.tier4Discount) > 0;
                    return (
                      <tr key={t.item_id} style={{ backgroundColor: "rgba(99,102,241,0.06)", borderLeft: "3px solid var(--primary)" }}>
                        <td style={{ fontWeight: 700 }}>{t.item_name}</td>
                        <td><span className="badge">{t.category_name}</span></td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                            <input
                              type="number"
                              min="1"
                              value={ie.tier1Max}
                              onChange={(e) => setInlineEdit({ ...ie, tier1Max: e.target.value })}
                              style={inlineInputStyle}
                              title="Tier 1 Max Qty"
                            />
                            <input
                              type="number"
                              min="0.01"
                              max="1"
                              step="0.001"
                              value={ie.tier1Discount}
                              onChange={(e) => setInlineEdit({ ...ie, tier1Discount: e.target.value })}
                              style={{ ...inlineInputStyle, color: "var(--success)" }}
                              title="Tier 1 Divisor"
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                            <input
                              type="number"
                              min="1"
                              value={ie.tier2Max}
                              onChange={(e) => setInlineEdit({ ...ie, tier2Max: e.target.value })}
                              style={inlineInputStyle}
                              title="Tier 2 Max Qty"
                            />
                            <input
                              type="number"
                              min="0.01"
                              max="1"
                              step="0.001"
                              value={ie.tier2Discount}
                              onChange={(e) => setInlineEdit({ ...ie, tier2Discount: e.target.value })}
                              style={{ ...inlineInputStyle, color: "var(--primary)" }}
                              title="Tier 2 Divisor"
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                            <input
                              type="number"
                              min="1"
                              value={ie.tier3Max}
                              onChange={(e) => setInlineEdit({ ...ie, tier3Max: e.target.value })}
                              style={inlineInputStyle}
                              title="Tier 3 Max Qty"
                            />
                            <input
                              type="number"
                              min="0.01"
                              max="1"
                              step="0.001"
                              value={ie.tier3Discount}
                              onChange={(e) => setInlineEdit({ ...ie, tier3Discount: e.target.value })}
                              style={{ ...inlineInputStyle, color: "var(--warning)" }}
                              title="Tier 3 Divisor"
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                            <input
                              type="number"
                              min="0"
                              value={ie.tier4Max}
                              onChange={(e) => setInlineEdit({ ...ie, tier4Max: e.target.value })}
                              style={inlineInputStyle}
                              title="Tier 4 Max Qty (0 = unlimited)"
                              placeholder="0"
                            />
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.001"
                              value={ie.tier4Discount}
                              onChange={(e) => setInlineEdit({ ...ie, tier4Discount: e.target.value })}
                              style={{ ...inlineInputStyle, color: has4Edit ? "var(--danger)" : "var(--text-muted)" }}
                              title="Tier 4 Divisor"
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "5px", justifyContent: "center", flexWrap: "wrap" }}>
                            <form action={saveItemTierConfigAction} style={{ display: "inline" }}>
                              <input type="hidden" name="itemId" value={ie.itemId} />
                              <input type="hidden" name="isTiered" value="on" />
                              <input type="hidden" name="tier1Max" value={ie.tier1Max} />
                              <input type="hidden" name="tier1Discount" value={ie.tier1Discount} />
                              <input type="hidden" name="tier2Max" value={ie.tier2Max} />
                              <input type="hidden" name="tier2Discount" value={ie.tier2Discount} />
                              <input type="hidden" name="tier3Max" value={ie.tier3Max} />
                              <input type="hidden" name="tier3Discount" value={ie.tier3Discount} />
                              <input type="hidden" name="tier4Max" value={ie.tier4Max} />
                              <input type="hidden" name="tier4Discount" value={ie.tier4Discount} />
                              <button
                                type="submit"
                                className="button button-primary"
                                style={{ padding: "5px 12px", fontSize: "11px" }}
                              >
                                Save
                              </button>
                            </form>
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ padding: "5px 10px", fontSize: "11px" }}
                              onClick={cancelInlineEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // ── Read-only Mode ──
                  return (
                    <tr key={t.item_id}>
                      <td style={{ fontWeight: 700 }}>{t.item_name}</td>
                      <td><span className="badge">{t.category_name}</span></td>
                      <td style={{ textAlign: "center" }}>
                        1–{t.tier1_max}<br />
                        <strong style={{ color: "var(--success)" }}>÷{t.tier1_discount}</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {t.tier1_max + 1}–{t.tier2_max}<br />
                        <strong style={{ color: "var(--primary)" }}>÷{t.tier2_discount}</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {t.tier2_max + 1}–{t.tier3_max ?? "∞"}<br />
                        <strong style={{ color: "var(--warning)" }}>÷{t.tier3_discount}</strong>
                      </td>
                      <td style={{ textAlign: "center", color: has4 ? "inherit" : "var(--text-muted)" }}>
                        {has4 ? (
                          <>
                            {(t.tier3_max ?? 800) + 1}{t.tier4_max ? `–${t.tier4_max}` : "+"}<br />
                            <strong style={{ color: "var(--danger)" }}>÷{t.tier4_discount}</strong>
                          </>
                        ) : (
                          <span style={{ fontSize: "10px" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: "5px 10px", fontSize: "11px" }}
                            onClick={() => startInlineEdit(t)}
                          >
                            Edit
                          </button>
                          {confirmDeleteId === t.item_id ? (
                            <form action={deleteItemTierConfigAction} style={{ display: "inline" }}>
                              <input type="hidden" name="itemId" value={t.item_id} />
                              <button type="submit" className="button button-danger" style={{ padding: "5px 10px", fontSize: "11px" }}>
                                Confirm?
                              </button>
                              <button
                                type="button"
                                className="button button-secondary"
                                style={{ padding: "5px 10px", fontSize: "11px", marginInlineStart: "4px" }}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="button button-secondary button-danger"
                              style={{ padding: "5px 10px", fontSize: "11px" }}
                              onClick={() => setConfirmDeleteId(t.item_id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        })()}
      </div>
    </div>
  );
}
