"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";

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
};

type SalesListProps = {
  initialRows: SalesRow[];
  categories: Array<{ id: number; name: string }>;
  month: string;
};

export default function SalesList({ initialRows, categories, month }: SalesListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");

  // Simulator State variables
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState<number>(100);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [sessionQuotes, setSessionQuotes] = useState<Array<{
    id: number;
    itemName: string;
    unit: string;
    qty: number;
    price: number;
    total: number;
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
  }, [selectedItemId, selectedItem]);

  const addQuote = () => {
    if (!selectedItem || selectedItem.sell_min === null || selectedItem.sell_max === null) return;
    
    let status: "approved" | "low" | "high" = "approved";
    if (targetPrice < selectedItem.sell_min) {
      status = "low";
    } else if (targetPrice > selectedItem.sell_max) {
      status = "high";
    }

    const newQuote = {
      id: Date.now(),
      itemName: selectedItem.item_name,
      unit: selectedItem.unit,
      qty,
      price: targetPrice,
      total: qty * targetPrice,
      minAllowed: selectedItem.sell_min,
      maxAllowed: selectedItem.sell_max,
      status
    };

    setSessionQuotes([newQuote, ...sessionQuotes]);
  };

  const copyQuote = (quote: typeof sessionQuotes[0]) => {
    const statusText = quote.status === "approved" ? "APPROVED" : quote.status === "low" ? "WARN: BELOW MIN" : "WARN: ABOVE MAX";
    const text = `--- FAERP Client Quote Summary ---\n` +
      `Product: ${quote.itemName} (${quote.unit})\n` +
      `Quantity: ${quote.qty}\n` +
      `Target Resell Price: EGP ${quote.price.toFixed(2)} / unit\n` +
      `Total Quote Value: EGP ${quote.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
      `Approved Min/Max limits: EGP ${quote.minAllowed.toFixed(2)} - EGP ${quote.maxAllowed.toFixed(2)}\n` +
      `Compliance Status: ${statusText}\n` +
      `Generated: ${new Date().toLocaleDateString()}\n` +
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
                <select 
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">-- Choose Product to Quote --</option>
                  {initialRows.map((row) => (
                    <option key={row.item_id} value={row.item_id}>
                      {row.item_name} ({row.unit})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
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
                    step="0.01"
                    min="0"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!selectedItemId}
                  />
                </label>
              </div>

              <button 
                type="button" 
                className="button button-primary button-block"
                onClick={addQuote}
                disabled={!selectedItemId}
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
                    <h1 style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-primary)", margin: "4px 0" }}>
                      {formatCurrency(qty * targetPrice)}
                    </h1>
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
                        <td><strong style={{ color: quote.status === "approved" ? "var(--success)" : quote.status === "low" ? "var(--danger)" : "var(--warning)" }}>{formatCurrency(quote.total)}</strong></td>
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
                <th>Strategy</th>
                <th>Approved Min Sell</th>
                <th>Approved Max Sell</th>
                <th>Publish Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                    No approved selling prices match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.item_id}>
                    <td>
                      <span className="badge">{row.category_name}</span>
                    </td>
                    <td>
                      <strong>{row.item_name}</strong>
                    </td>
                    <td>{row.unit}</td>
                    <td>
                      <span className="badge badge-strong">{row.strategy ? row.strategy.toUpperCase() : "Pending"}</span>
                    </td>
                    <td>
                      <strong style={{ color: "var(--success)", fontSize: "15px" }}>
                        {formatCurrency(row.sell_min)}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: "var(--primary)", fontSize: "15px" }}>
                        {formatCurrency(row.sell_max)}
                      </strong>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{formatDateTime(row.created_at)}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>by {row.created_by}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
