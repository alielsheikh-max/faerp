"use client";

import { useState } from "react";
import { saveItemTierConfigAction, deleteItemTierConfigAction } from "@/app/actions/pricing";
import type { ItemTierConfig } from "@/lib/db";

type Props = {
  tiers: ItemTierConfig[];
  items: Array<{ id: number; name: string; category_id: number; category_name: string }>;
  username: string;
};

export default function TierPricingPanel({ tiers, items, username }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [isTiered, setIsTiered] = useState(true);
  const [tier1Max, setTier1Max] = useState("100");
  const [tier1Discount, setTier1Discount] = useState("0");
  const [tier2Max, setTier2Max] = useState("200");
  const [tier2Discount, setTier2Discount] = useState("5");
  const [tier3Max, setTier3Max] = useState("300");
  const [tier3Discount, setTier3Discount] = useState("10");
  const [tier4Max, setTier4Max] = useState("0");
  const [tier4Discount, setTier4Discount] = useState("0");
  const [useTier4, setUseTier4] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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
      setTier3Max(String(existing.tier3_max ?? 300));
      setTier3Discount(String(existing.tier3_discount));
      const has4 = (existing.tier4_max ?? 0) > 0 || (existing.tier4_discount ?? 0) > 0;
      setUseTier4(has4);
      setTier4Max(String(existing.tier4_max ?? 0));
      setTier4Discount(String(existing.tier4_discount ?? 0));
    } else {
      setIsTiered(true);
      setTier1Max("100");
      setTier1Discount("0");
      setTier2Max("200");
      setTier2Discount("5");
      setTier3Max("300");
      setTier3Discount("10");
      setUseTier4(false);
      setTier4Max("0");
      setTier4Discount("0");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
            Set quantity ranges and percentage discount rates for tiered items. Up to 4 tiers supported. Tier 4 is optional.
          </p>
        </div>

        <form action={saveItemTierConfigAction} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Item selector */}
            <label className="field">
              <span>Select Product Item</span>
              <select
                name="itemId"
                value={selectedItemId}
                onChange={(e) => handleItemSelect(e.target.value)}
                required
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}
              >
                <option value="">— Select an item —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.category_name}] {i.name}
                  </option>
                ))}
              </select>
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
                { label: "Tier 1", maxName: "tier1Max", maxVal: tier1Max, setMax: setTier1Max, discName: "tier1Discount", discVal: tier1Discount, setDisc: setTier1Discount, color: "var(--success)", note: "Range: 0 → N" },
                { label: "Tier 2", maxName: "tier2Max", maxVal: tier2Max, setMax: setTier2Max, discName: "tier2Discount", discVal: tier2Discount, setDisc: setTier2Discount, color: "var(--primary)", note: "Range: N+1 → M" },
                { label: "Tier 3", maxName: "tier3Max", maxVal: tier3Max, setMax: setTier3Max, discName: "tier3Discount", discVal: tier3Discount, setDisc: setTier3Discount, color: "var(--warning)", note: "Range: M+1 → P" },
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
                    <span>{tier.label} Discount %</span>
                    <input
                      type="number"
                      name={tier.discName}
                      min="0"
                      max="100"
                      step="0.5"
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
                    <span>Tier 4 Discount %</span>
                    <input
                      type="number"
                      name="tier4Discount"
                      min="0"
                      max="100"
                      step="0.5"
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

        {activeTiers.length === 0 ? (
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
                {activeTiers.map((t) => {
                  const has4 = (t.tier4_max ?? 0) > 0 || (t.tier4_discount ?? 0) > 0;
                  return (
                    <tr key={t.item_id}>
                      <td style={{ fontWeight: 700 }}>{t.item_name}</td>
                      <td><span className="badge">{t.category_name}</span></td>
                      <td style={{ textAlign: "center" }}>
                        1–{t.tier1_max}<br />
                        <strong style={{ color: "var(--success)" }}>{t.tier1_discount}%</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {t.tier1_max + 1}–{t.tier2_max}<br />
                        <strong style={{ color: "var(--primary)" }}>{t.tier2_discount}%</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {t.tier2_max + 1}–{t.tier3_max ?? "∞"}<br />
                        <strong style={{ color: "var(--warning)" }}>{t.tier3_discount}%</strong>
                      </td>
                      <td style={{ textAlign: "center", color: has4 ? "inherit" : "var(--text-muted)" }}>
                        {has4 ? (
                          <>
                            {(t.tier3_max ?? 300) + 1}{t.tier4_max ? `–${t.tier4_max}` : "+"}<br />
                            <strong style={{ color: "var(--danger)" }}>{t.tier4_discount}%</strong>
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
                            onClick={() => handleItemSelect(String(t.item_id))}
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
        )}
      </div>
    </div>
  );
}
