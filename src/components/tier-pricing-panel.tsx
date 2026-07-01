"use client";

import { useState, useTransition } from "react";
import { saveItemTierConfigAction } from "@/app/actions/pricing";
import { useI18n } from "@/lib/i18n-context";
import type { ItemTierConfig } from "@/lib/db";

type Props = {
  tiers: ItemTierConfig[];
  items: Array<{ id: number; name: string; category_id: number; category_name: string }>;
  username: string;
};

type InlineEditState = {
  itemId: number;
  name: string;
  moq: string;
  transportation: string;
  strategy: "tiers" | "min_max" | "fixed";
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
  const { t, isRTL } = useI18n();
  const [isPending, startTransition] = useTransition();

  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const startInlineEdit = (itemConfig: ItemTierConfig) => {
    let strategyVal: "tiers" | "min_max" | "fixed" = "min_max";
    if (itemConfig.is_tiered === 1) strategyVal = "tiers";
    else if (itemConfig.is_tiered === 2) strategyVal = "fixed";

    setInlineEdit({
      itemId: itemConfig.item_id,
      name: itemConfig.item_name,
      moq: String(itemConfig.moq),
      transportation: String(itemConfig.transportation),
      strategy: strategyVal,
      tier1Max: String(itemConfig.tier1_max),
      tier1Discount: String(itemConfig.tier1_discount),
      tier2Max: String(itemConfig.tier2_max),
      tier2Discount: String(itemConfig.tier2_discount),
      tier3Max: String(itemConfig.tier3_max ?? 300),
      tier3Discount: String(itemConfig.tier3_discount),
      tier4Max: String(itemConfig.tier4_max ?? 0),
      tier4Discount: String(itemConfig.tier4_discount ?? 0.0),
    });
  };

  const cancelInlineEdit = () => setInlineEdit(null);

  const inlineInputStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border-medium)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    width: "100%",
  };

  const inlineTierInputStyle: React.CSSProperties = {
    padding: "3px 5px",
    fontSize: "11px",
    borderRadius: "4px",
    border: "1px solid var(--border-medium)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    width: "55px",
    textAlign: "center",
    fontWeight: 700,
  };

  // Filter tiers (which contains all active items in the database)
  const filteredTiers = searchQuery.trim()
    ? tiers.filter((t) => {
        const q = searchQuery.toLowerCase();
        return t.item_name.toLowerCase().includes(q) || t.category_name.toLowerCase().includes(q);
      })
    : tiers;

  return (
    <div className="panel" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="panel-header" style={{ borderBottom: "none", padding: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 800 }}>
            {isRTL ? "إدارة الأصناف والأسعار" : "Items Management"}
          </h3>
          <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
            {isRTL 
              ? "تعديل أسماء الأصناف، الحد الأدنى للطلب (MOQ)، وتكلفة النقل، والاستراتيجيةinline." 
              : "Edit item names, MOQ, transportation costs, and pricing strategies inline."}
          </p>
        </div>
        <span className="badge badge-indigo">{tiers.length} {isRTL ? "صنف" : "items"}</span>
      </div>

      {/* Search Input */}
      <div>
        <input
          type="text"
          placeholder={isRTL ? "🔍 ابحث باسم المنتج أو الفئة..." : "🔍 Search items by name or category..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: "13px",
            border: "1.5px solid var(--border-medium)",
            borderRadius: "10px",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
      </div>

      {/* Items Table */}
      {filteredTiers.length === 0 ? (
        <div style={{ padding: "30px", textAlign: "center", border: "1px dashed var(--border-medium)", borderRadius: "8px" }}>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {isRTL ? "لا توجد نتائج تطابق بحثك." : `No items match "${searchQuery}"`}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table" style={{ fontSize: "12.5px" }}>
            <thead>
              <tr>
                <th style={{ minWidth: "180px" }}>{isRTL ? "المنتج" : "Product Item"}</th>
                <th>{isRTL ? "الفئة" : "Category"}</th>
                <th style={{ width: "90px", textAlign: "center" }}>{isRTL ? "الحد الأدنى (MOQ)" : "MOQ"}</th>
                <th style={{ width: "90px", textAlign: "center" }}>{isRTL ? "النقل" : "Transport"}</th>
                <th style={{ width: "120px" }}>{isRTL ? "استراتيجية التسعير" : "Pricing Strategy"}</th>
                <th style={{ textAlign: "center", width: "70px" }}>T1</th>
                <th style={{ textAlign: "center", width: "70px" }}>T2</th>
                <th style={{ textAlign: "center", width: "70px" }}>T3</th>
                <th style={{ textAlign: "center", width: "70px" }}>T4</th>
                <th style={{ textAlign: "center", width: "130px" }}>{isRTL ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTiers.map((tConfig) => {
                const isEditing = inlineEdit?.itemId === tConfig.item_id;

                if (isEditing && inlineEdit) {
                  const ie = inlineEdit;
                  return (
                    <tr key={tConfig.item_id} style={{ backgroundColor: "rgba(99,102,241,0.06)", borderLeft: "3.5px solid var(--primary)" }}>
                      <td>
                        <input
                          type="text"
                          value={ie.name}
                          onChange={(e) => setInlineEdit({ ...ie, name: e.target.value })}
                          style={inlineInputStyle}
                          required
                        />
                      </td>
                      <td>
                        <span className="badge">{tConfig.category_name}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min="0"
                          value={ie.moq}
                          onChange={(e) => setInlineEdit({ ...ie, moq: e.target.value })}
                          style={{ ...inlineInputStyle, textAlign: "center" }}
                          required
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ie.transportation}
                          onChange={(e) => setInlineEdit({ ...ie, transportation: e.target.value })}
                          style={{ ...inlineInputStyle, textAlign: "center" }}
                          required
                        />
                      </td>
                      <td>
                        <select
                          value={ie.strategy}
                          onChange={(e) => setInlineEdit({ ...ie, strategy: e.target.value as any })}
                          style={{ ...inlineInputStyle, padding: "5px" }}
                        >
                          <option value="min_max">{isRTL ? "أدنى/أقصى سعر" : "Min & Max"}</option>
                          <option value="fixed">{isRTL ? "سعر ثابت" : "Fixed Price"}</option>
                          <option value="tiers">{isRTL ? "شرائح كميات" : "Volume Tiers"}</option>
                        </select>
                      </td>
                      {/* Tiers Columns (T1-T4) */}
                      {ie.strategy === "tiers" ? (
                        <>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                              <input type="number" min="1" value={ie.tier1Max} onChange={(e) => setInlineEdit({ ...ie, tier1Max: e.target.value })} style={inlineTierInputStyle} title="Tier 1 Max Qty" />
                              <input type="number" min="0.01" max="1" step="0.001" value={ie.tier1Discount} onChange={(e) => setInlineEdit({ ...ie, tier1Discount: e.target.value })} style={{ ...inlineTierInputStyle, color: "var(--success)" }} title="Tier 1 Divisor" />
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                              <input type="number" min="1" value={ie.tier2Max} onChange={(e) => setInlineEdit({ ...ie, tier2Max: e.target.value })} style={inlineTierInputStyle} title="Tier 2 Max Qty" />
                              <input type="number" min="0.01" max="1" step="0.001" value={ie.tier2Discount} onChange={(e) => setInlineEdit({ ...ie, tier2Discount: e.target.value })} style={{ ...inlineTierInputStyle, color: "var(--primary)" }} title="Tier 2 Divisor" />
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                              <input type="number" min="1" value={ie.tier3Max} onChange={(e) => setInlineEdit({ ...ie, tier3Max: e.target.value })} style={inlineTierInputStyle} title="Tier 3 Max Qty" />
                              <input type="number" min="0.01" max="1" step="0.001" value={ie.tier3Discount} onChange={(e) => setInlineEdit({ ...ie, tier3Discount: e.target.value })} style={{ ...inlineTierInputStyle, color: "var(--warning)" }} title="Tier 3 Divisor" />
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                              <input type="number" min="0" value={ie.tier4Max} onChange={(e) => setInlineEdit({ ...ie, tier4Max: e.target.value })} style={inlineTierInputStyle} title="Tier 4 Max Qty" placeholder="0" />
                              <input type="number" min="0" max="1" step="0.001" value={ie.tier4Discount} onChange={(e) => setInlineEdit({ ...ie, tier4Discount: e.target.value })} style={{ ...inlineTierInputStyle, color: "var(--danger)" }} title="Tier 4 Divisor" placeholder="0" />
                            </div>
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", verticalAlign: "middle" }}>
                          — {isRTL ? "لا ينطبق على هذه الاستراتيجية" : "Not applicable to this strategy"} —
                        </td>
                      )}
                      {/* Save/Cancel actions */}
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <form
                            action={saveItemTierConfigAction}
                            onSubmit={() => setInlineEdit(null)}
                            style={{ display: "inline" }}
                          >
                            <input type="hidden" name="itemId" value={ie.itemId} />
                            <input type="hidden" name="name" value={ie.name} />
                            <input type="hidden" name="moq" value={ie.moq} />
                            <input type="hidden" name="transportation" value={ie.transportation} />
                            <input type="hidden" name="strategy" value={ie.strategy} />
                            {ie.strategy === "tiers" && (
                              <>
                                <input type="hidden" name="tier1Max" value={ie.tier1Max} />
                                <input type="hidden" name="tier1Discount" value={ie.tier1Discount} />
                                <input type="hidden" name="tier2Max" value={ie.tier2Max} />
                                <input type="hidden" name="tier2Discount" value={ie.tier2Discount} />
                                <input type="hidden" name="tier3Max" value={ie.tier3Max} />
                                <input type="hidden" name="tier3Discount" value={ie.tier3Discount} />
                                <input type="hidden" name="tier4Max" value={ie.tier4Max} />
                                <input type="hidden" name="tier4Discount" value={ie.tier4Discount} />
                              </>
                            )}
                            <button type="submit" className="button button-primary" style={{ padding: "5px 10px", fontSize: "11px" }}>
                              💾 {isRTL ? "حفظ" : "Save"}
                            </button>
                          </form>
                          <button
                            type="button"
                            onClick={cancelInlineEdit}
                            className="button button-secondary"
                            style={{ padding: "5px 10px", fontSize: "11px" }}
                          >
                            ✕ {isRTL ? "إلغاء" : "Cancel"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // ── Read Only Mode ──
                let stratLabel = isRTL ? "أدنى/أقصى سعر" : "Min & Max";
                let stratColor = "var(--success)";
                if (tConfig.is_tiered === 1) {
                  stratLabel = isRTL ? "شرائح كميات" : "Volume Tiers";
                  stratColor = "var(--primary)";
                } else if (tConfig.is_tiered === 2) {
                  stratLabel = isRTL ? "سعر ثابت" : "Fixed Price";
                  stratColor = "var(--warning)";
                }

                return (
                  <tr key={tConfig.item_id}>
                    <td style={{ fontWeight: 700 }}>{tConfig.item_name}</td>
                    <td><span className="badge">{tConfig.category_name}</span></td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{tConfig.moq}</td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>EGP {tConfig.transportation.toFixed(2)}</td>
                    <td>
                      <span className="badge badge-strong" style={{ backgroundColor: `${stratColor}15`, color: stratColor, borderColor: `${stratColor}30` }}>
                        {stratLabel}
                      </span>
                    </td>
                    {/* Read-only tier values */}
                    {tConfig.is_tiered === 1 ? (
                      <>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "11px" }}>
                            <strong>1–{tConfig.tier1_max}</strong>
                            <div style={{ color: "var(--success)", fontWeight: 700 }}>÷ {tConfig.tier1_discount}</div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "11px" }}>
                            <strong>{tConfig.tier1_max + 1}–{tConfig.tier2_max}</strong>
                            <div style={{ color: "var(--primary)", fontWeight: 700 }}>÷ {tConfig.tier2_discount}</div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "11px" }}>
                            <strong>{tConfig.tier2_max + 1}–{tConfig.tier3_max}</strong>
                            <div style={{ color: "var(--warning)", fontWeight: 700 }}>÷ {tConfig.tier3_discount}</div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {tConfig.tier4_discount > 0 ? (
                            <div style={{ fontSize: "11px" }}>
                              <strong>{tConfig.tier3_max + 1}+</strong>
                              <div style={{ color: "var(--danger)", fontWeight: 700 }}>÷ {tConfig.tier4_discount}</div>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                        —
                      </td>
                    )}
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => startInlineEdit(tConfig)}
                        className="button button-secondary"
                        style={{ padding: "5px 12px", fontSize: "11px", fontWeight: 800 }}
                      >
                        ✏️ {isRTL ? "تعديل" : "Edit"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
