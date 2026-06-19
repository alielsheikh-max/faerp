"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ItemCombobox } from "./item-combobox";

type SalesRow = {
  item_id: number;
  item_name: string;
  unit: string;
  category_name: string;
  strategy: string | null;
  buy_min: number | null;
  buy_max: number | null;
  buy_avg: number | null;
  markup_min: number | null;
  markup_max: number | null;
  sell_min: number | null;
  sell_max: number | null;
  created_by: string | null;
  created_at: string | null;
  moq: number;
  transportation_per_unit: number;
  // T10: tier fields
  tier_pricing_enabled: number;
  is_tiered: number;
  tier1_max: number;
  tier1_discount: number;
  tier2_max: number;
  tier2_discount: number;
  tier3_max: number;
  tier3_discount: number;
  tier4_max: number;
  tier4_discount: number;
  // T20: actual transport stored on selling price
  transportation: number;
  other_expenses: number;
};

/** T10: Compute tier prices from buy_avg ÷ divisor (Phase-1 formula). */
function calcTierPrices(row: SalesRow) {
  const base = row.buy_avg ?? 0;
  function roundUp5(n: number) { return Math.ceil(n / 5) * 5; }
  return [
    { label: "B",  range: `1–${row.tier1_max}`,  price: row.tier1_discount > 0 ? roundUp5(base / row.tier1_discount) : null },
    { label: "T2", range: `${row.tier1_max + 1}–${row.tier2_max}`, price: row.tier2_discount > 0 ? roundUp5(base / row.tier2_discount) : null },
    { label: "T3", range: `${row.tier2_max + 1}–${row.tier3_max}`, price: row.tier3_discount > 0 ? roundUp5(base / row.tier3_discount) : null },
    { label: "T4", range: `>${row.tier3_max}`,   price: row.tier4_discount > 0 ? roundUp5(base / row.tier4_discount) : null },
  ].filter(t => t.price !== null);
}

type PriceHistoryEntry = {
  prev_sell_min: number | null;
  prev_sell_max: number | null;
  changed_at: string;
  changed_by: string;
};

type SalesListProps = {
  initialRows: SalesRow[];
  categories: Array<{ id: number; name: string }>;
  month: string;
  role?: "SC" | "SA";
  /** SC only: map of item_id → most recent price change (for inline indicator) */
  priceHistory?: Record<number, PriceHistoryEntry>;
};

export default function SalesList({ initialRows, categories, month, role, priceHistory }: SalesListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");

  // Simulator State variables
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState<number>(100);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [showMOQDialog, setShowMOQDialog] = useState<boolean>(false);
  const [sessionQuotes, setSessionQuotes] = useState<Array<{
    id: number;
    itemName: string;
    unit: string;
    qty: number;
    price: number;
    total: number;
    transportationCost: number;
    grandTotal: number;
    clientPaysTrans: boolean;
    moq: number;
    minAllowed: number;
    maxAllowed: number;
    status: "approved" | "low" | "high";
  }>>([]);

  const filteredRows = initialRows.filter((row) => {
    const matchesSearch =
      row.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.category_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.strategy && row.strategy.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategoryName === "" || row.category_name === selectedCategoryName;

    return matchesSearch && matchesCategory;
  });

  const selectedItem = initialRows.find((row) => String(row.item_id) === selectedItemId);

  // Sync target price on item selection change
  useEffect(() => {
    if (selectedItem && selectedItem.sell_min !== null && selectedItem.sell_max !== null) {
      setTargetPrice(Number(((selectedItem.sell_min + selectedItem.sell_max) / 2).toFixed(2)));
    } else {
      setTargetPrice(0);
    }
    setShowMOQDialog(false);
  }, [selectedItemId, selectedItem]);

  const addQuote = () => {
    if (!selectedItem || selectedItem.sell_min === null || selectedItem.sell_max === null) return;

    const isUnderMOQ = selectedItem.moq > 0 && qty < selectedItem.moq;
    if (isUnderMOQ) {
      setShowMOQDialog(true);
      return;
    }

    proceedAddQuote(false);
  };

  const proceedAddQuote = (clientPaysShipping: boolean) => {
    if (!selectedItem || selectedItem.sell_min === null || selectedItem.sell_max === null) return;

    let status: "approved" | "low" | "high" = "approved";
    if (targetPrice < selectedItem.sell_min) {
      status = "low";
    } else if (targetPrice > selectedItem.sell_max) {
      status = "high";
    }

    const isUnderMOQ = selectedItem.moq > 0 && qty < selectedItem.moq;
    const transportationCost = (isUnderMOQ && clientPaysShipping)
      ? qty * (selectedItem.transportation_per_unit ?? 0)
      : 0;

    const newQuote = {
      id: Date.now(),
      itemName: selectedItem.item_name,
      unit: selectedItem.unit,
      qty,
      price: targetPrice,
      total: qty * targetPrice,
      transportationCost,
      grandTotal: qty * targetPrice + transportationCost,
      clientPaysTrans: isUnderMOQ ? clientPaysShipping : false,
      moq: selectedItem.moq,
      minAllowed: selectedItem.sell_min,
      maxAllowed: selectedItem.sell_max,
      status
    };

    setSessionQuotes([newQuote, ...sessionQuotes]);
    setShowMOQDialog(false);
  };

  const copyQuote = (quote: typeof sessionQuotes[0]) => {
    const statusText = quote.status === "approved" ? "APPROVED" : quote.status === "low" ? "WARN: BELOW MIN" : "WARN: ABOVE MAX";
    
    let transLine = "";
    if (quote.transportationCost > 0) {
      transLine = `Transportation Cost: EGP ${quote.transportationCost.toLocaleString("en-US", { minimumFractionDigits: 2 })} (Paid by Client due to under-MOQ)\n` +
                  `Total Value (inc. Trans.): EGP ${quote.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
    } else {
      transLine = `Total Quote Value: EGP ${quote.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
    }

    const text = `--- FAERP Client Quote Summary ---\n` +
      `Product: ${quote.itemName} (${quote.unit})\n` +
      `Quantity: ${quote.qty}\n` +
      `Target Resell Price: EGP ${quote.price.toFixed(2)} / unit\n` +
      `MOQ: ${quote.moq}\n` +
      transLine +
      `Approved Min/Max limits: EGP ${quote.minAllowed.toFixed(2)} - EGP ${quote.maxAllowed.toFixed(2)}\n` +
      `Compliance Status: ${statusText}\n` +
      `Generated: ${(() => { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`; })()}\n` +
      `----------------------------------`;
    
    navigator.clipboard.writeText(text);
    alert("Quote copied to clipboard!");
  };

  return (
    <div className="page-stack">
      {/* Client Quoting Simulator */}
      <section className="panel animate-fade-in">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Interactive sales assistant</p>
            <h2>Client Deal Quoting Simulator</h2>
          </div>
          <span className="badge badge-strong">Real-Time Totals</span>
        </div>

        <div className="quote-simulator-card">
          <div className="quote-simulator-grid">
            {/* Inputs Column */}
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <label className="field">
                <span>1. Select Approved Product</span>
                <ItemCombobox
                  items={initialRows.map((row) => ({
                    id: row.item_id,
                    label: row.item_name,
                    unit: row.unit,
                    category: row.category_name,
                    isPublished: row.sell_min !== null,
                  }))}
                  value={selectedItemId}
                  onChange={setSelectedItemId}
                  placeholder="-- Choose Product to Quote --"
                />
              </label>

              {selectedItem && (
                <div className="animate-fade-in" style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr 1fr", 
                  gap: "16px", 
                  padding: "12px 16px", 
                  backgroundColor: "var(--bg-elevated)", 
                  border: "1px solid var(--border-medium)", 
                  borderRadius: "8px",
                  marginTop: "-4px" 
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      Min Order Qty (MOQ)
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--warning)" }}>
                      {selectedItem.moq} {selectedItem.unit}
                    </strong>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      Standard Shipping Rate
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--text-primary)" }}>
                      {formatCurrency(selectedItem.transportation_per_unit)} / unit
                    </strong>
                  </div>
                </div>
              )}

              {selectedItem && selectedItem.moq > 0 && qty < selectedItem.moq && (
                <div className="animate-fade-in" style={{ 
                  padding: "12px 16px", 
                  backgroundColor: "rgba(245, 158, 11, 0.12)", 
                  border: "1px solid var(--warning)", 
                  borderRadius: "8px",
                  color: "var(--warning)",
                  fontSize: "13px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  boxShadow: "0 0 10px rgba(245, 158, 11, 0.1)",
                  marginTop: "4px"
                }}>
                  <span style={{ fontSize: "16px" }}>⚠️</span>
                  <div style={{ textAlign: "left" }}>
                    <strong>Notice:</strong> Quantity is below the Minimum Order Quantity ({selectedItem.moq} {selectedItem.unit}). A shipping cost of <strong>{formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0))}</strong> will apply.
                  </div>
                </div>
              )}

              <div style={{ 
                display: "grid", 
                gridTemplateColumns: selectedItem && selectedItem.moq > 0 && qty < selectedItem.moq ? "1fr 1fr 1.2fr" : "1fr 1fr", 
                gap: "16px" 
              }}>
                <label className="field">
                  <span>2. Deal Quantity</span>
                  <input 
                    type="number" 
                    min="1" 
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                    disabled={!selectedItemId}
                  />
                </label>

                <label className="field">
                  <span>3. Target Unit Price (EGP)</span>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!selectedItemId}
                  />
                </label>

                {selectedItem && selectedItem.moq > 0 && qty < selectedItem.moq && (
                  <label className="field animate-fade-in">
                    <span style={{ color: "var(--warning)" }}>Shipping Cost (Client-Paid)</span>
                    <input 
                      type="text" 
                      readOnly
                      value={`${formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0))}`}
                      style={{ 
                        borderColor: "var(--warning)", 
                        color: "var(--warning)", 
                        backgroundColor: "rgba(245, 158, 11, 0.05)",
                        fontWeight: "bold",
                        cursor: "default"
                      }}
                    />
                  </label>
                )}
              </div>

              <button 
                type="button" 
                className="button button-primary button-block"
                onClick={addQuote}
                disabled={!selectedItem}
                style={{ marginTop: "8px" }}
              >
                Add Quote to Session Deal Board
              </button>
            </div>

            {/* Live Metrics Column */}
            <div className="simulation-results">
              {selectedItem ? (
                <>
                  <div style={{ textAlign: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px" }}>
                    <span className="eyebrow" style={{ fontSize: "11px" }}>Total deal value</span>
                    {selectedItem.moq > 0 && qty < selectedItem.moq ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                          <span>Goods Subtotal:</span>
                          <span>{formatCurrency(qty * targetPrice)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--warning)" }}>
                          <span>Transportation (Client-Paid):</span>
                          <span>{formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0))}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold", borderTop: "1px dashed var(--border-light)", paddingTop: "4px", marginTop: "4px" }}>
                          <span>Grand Total:</span>
                          <span style={{ color: "var(--text-primary)" }}>
                            {formatCurrency(qty * targetPrice + qty * (selectedItem.transportation_per_unit ?? 0))}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <h1 style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-primary)", margin: "4px 0" }}>
                        {formatCurrency(qty * targetPrice)}
                      </h1>
                    )}
                    <div style={{ marginTop: "8px" }}>
                      {targetPrice >= (selectedItem.sell_min ?? 0) && targetPrice <= (selectedItem.sell_max ?? 0) ? (
                        <span className="badge badge-success">✓ Within Approved Pricing Limits</span>
                      ) : targetPrice < (selectedItem.sell_min ?? 0) ? (
                        <span className="badge badge-danger">⚠️ Under Pricing (Approved Min: {formatCurrency(selectedItem.sell_min)})</span>
                      ) : (
                        <span className="badge badge-warning">⚠️ Above Max Approved Limit (Max: {formatCurrency(selectedItem.sell_max)})</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", paddingTop: "8px" }}>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Min Approved Total</span>
                      <strong style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
                        {formatCurrency(qty * (selectedItem.sell_min ?? 0))}
                      </strong>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Max Approved Total</span>
                      <strong style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
                        {formatCurrency(qty * (selectedItem.sell_max ?? 0))}
                      </strong>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                  <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>📊</span>
                  Select an approved item from the list to simulate deal quantities, check markup compliance, and export custom price quotes.
                </div>
              )}
            </div>
          </div>

          {/* Deal Board History */}
          {sessionQuotes.length > 0 && (
            <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-light)", paddingTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Active Session Deal Board ({sessionQuotes.length})</h3>
                <button 
                  onClick={() => setSessionQuotes([])} 
                  className="button button-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  Clear Board
                </button>
              </div>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Target Unit Price</th>
                      <th>Deal Total</th>
                      <th>Min / Max Allowed</th>
                      <th>Compliance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionQuotes.map((quote) => (
                      <tr key={quote.id}>
                        <td><strong>{quote.itemName}</strong> <span className="muted">({quote.unit})</span></td>
                        <td>{quote.qty}</td>
                        <td>{formatCurrency(quote.price)}</td>
                        <td>
                          <div className="cell-stack">
                            <strong style={{ color: quote.status === "approved" ? "var(--success)" : quote.status === "low" ? "var(--danger)" : "var(--warning)" }}>
                              {formatCurrency(quote.grandTotal)}
                            </strong>
                            {quote.transportationCost > 0 && (
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                (inc. {formatCurrency(quote.transportationCost)} trans)
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{formatCurrency(quote.minAllowed)} - {formatCurrency(quote.maxAllowed)}</td>
                        <td>
                          {quote.status === "approved" ? (
                            <span className="badge badge-success" style={{ padding: "4px 8px", fontSize: "10px" }}>Approved</span>
                          ) : quote.status === "low" ? (
                            <span className="badge badge-danger" style={{ padding: "4px 8px", fontSize: "10px" }}>Below Min</span>
                          ) : (
                            <span className="badge badge-warning" style={{ padding: "4px 8px", fontSize: "10px" }}>Above Max</span>
                          )}
                        </td>
                        <td>
                          <button 
                            onClick={() => copyQuote(quote)} 
                            className="button button-secondary"
                            style={{ padding: "6px 10px", fontSize: "11px" }}
                          >
                            Copy Quote Text
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="search-bar-wrap">
        <input
          type="text"
          className="search-input"
          placeholder="Search items, categories, or strategies instantly..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <select
          className="search-input"
          style={{ maxWidth: "240px" }}
          value={selectedCategoryName}
          onChange={(e) => setSelectedCategoryName(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>

        {searchQuery || selectedCategoryName ? (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategoryName("");
            }}
            className="button button-secondary"
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Interactive catalog</p>
            <h2>
              {filteredRows.length === initialRows.length
                ? `All Approved Ranges (${initialRows.length})`
                : `Filtered Results (${filteredRows.length} of ${initialRows.length})`}
            </h2>
          </div>
          <span className="badge badge-strong">{month}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Item</th>
                <th>Unit</th>
                <th>MOQ</th>
                <th title="T16: Which buy price was used as markup base">Ref Base</th>
                <th>Approved Price(s)</th>
                <th title="T20: Transport cost per unit included in this price">Trans./Unit</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                    No approved selling prices match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  // Show tiers whenever item is configured as tiered + has buy_avg
                  // (don't require tier_pricing_enabled===1 — that flag may be 0 if item was
                  //  published before the monthly tier toggle was switched on)
                  const isTiered = row.is_tiered === 1 && row.buy_avg != null;
                  const tierPrices = isTiered ? calcTierPrices(row) : [];
                  const TIER_COLORS = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)"];
                  const recentChange = priceHistory?.[row.item_id];
                  // Badge shows for both SC and SA; inline old→new only for SC
                  const hasChange = !!recentChange;
                  return (
                    <tr key={row.item_id} style={hasChange ? {
                      backgroundColor: "rgba(245,158,11,0.04)",
                      borderLeft: "3px solid #f59e0b",
                    } : {}}>
                      <td><span className="badge">{row.category_name}</span></td>
                      <td>
                        <strong>{row.item_name}</strong>
                        {hasChange && (
                          <span style={{
                            display: "inline-block", marginLeft: "8px",
                            fontSize: "9px", fontWeight: 800, padding: "2px 7px",
                            borderRadius: "99px", background: "rgba(245,158,11,0.15)",
                            border: "1px solid rgba(245,158,11,0.4)", color: "#b45309",
                            verticalAlign: "middle",
                          }}>📝 Revised</span>
                        )}
                      </td>
                      <td>{row.unit}</td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--warning)",
                          backgroundColor: "rgba(245,158,11,0.15)", border: "1px solid var(--warning)",
                          padding: "4px 8px", borderRadius: "6px", display: "inline-block" }}>
                          {row.moq}
                        </span>
                      </td>
                      {/* T16: base reference */}
                      <td>
                        {row.strategy ? (
                          <span className="badge badge-strong" title="Base buy price used for markup">
                            Ref: {row.strategy.toUpperCase()}
                          </span>
                        ) : <span className="badge">—</span>}
                      </td>
                      {/* Approved Price(s) — for SC show old→new if revised */}
                      <td>
                        {isTiered ? (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {tierPrices.map((t, i) => (
                              <div key={t.label} style={{ textAlign: "center", minWidth: "54px" }}>
                                <div style={{ fontSize: "9px", fontWeight: 800, color: TIER_COLORS[i], textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.label}</div>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: TIER_COLORS[i] }}>{formatCurrency(t.price)}</div>
                                <div style={{ fontSize: "8px", color: "var(--text-muted)" }}>{t.range} {row.unit}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {/* Inline old → new indicator: SC only */}
                            {role === "SC" && hasChange && recentChange && recentChange.prev_sell_min !== null && (
                              <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
                                <span style={{ textDecoration: "line-through", opacity: 0.7 }}>
                                  {formatCurrency(recentChange.prev_sell_min)} – {formatCurrency(recentChange.prev_sell_max)}
                                </span>
                                <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: "13px" }}>→</span>
                              </div>
                            )}
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Min</div>
                                <strong style={{ color: "var(--success)", fontSize: "14px" }}>{formatCurrency(row.sell_min)}</strong>
                              </div>
                              <span style={{ color: "var(--text-dim)" }}>—</span>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Max</div>
                                <strong style={{ color: "var(--primary)", fontSize: "14px" }}>{formatCurrency(row.sell_max)}</strong>
                              </div>
                            </div>
                            {hasChange && (
                              <div style={{ fontSize: "10px", color: "#b45309", marginTop: "2px" }}>
                                Updated {formatDateTime(recentChange.changed_at)} · {recentChange.changed_by}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      {/* T20: transportation per unit */}
                      <td>
                        {(row.transportation ?? 0) > 0 ? (
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                            {formatCurrency(row.transportation)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="cell-stack">
                          <span>{formatDateTime(row.created_at)}</span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>by {row.created_by}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {showMOQDialog && selectedItem && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          backdropFilter: "blur(4px)"
        }}>
          <div className="quote-simulator-card animate-fade-in" style={{
            width: "100%",
            maxWidth: "480px",
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid var(--border-medium)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            backgroundColor: "var(--bg-elevated)",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🚚</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
              Shipping Cost Confirmation
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>
              The requested quantity of <strong>{qty} {selectedItem.unit}</strong> is below the Minimum Order Quantity (MOQ) of <strong>{selectedItem.moq} {selectedItem.unit}</strong>.
              <br /><br />
              The client must pay for shipping/transportation, which totals <strong>{formatCurrency(qty * (selectedItem.transportation_per_unit ?? 0))}</strong> ({qty} × {formatCurrency(selectedItem.transportation_per_unit)}/unit).
              <br /><br />
              Does the client agree to pay this shipping cost?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                onClick={() => proceedAddQuote(true)}
                className="button button-primary"
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                Yes, Client Pays Shipping
              </button>
              <button 
                onClick={() => setShowMOQDialog(false)}
                className="button button-secondary"
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
