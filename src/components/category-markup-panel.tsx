"use client";

import { useState, useTransition } from "react";
import { applyCategoryMarkupAction } from "@/app/actions/pricing";
import { formatMonthLabel } from "@/lib/format";

type Category = { id: number; name: string };

type Props = {
  categories: Category[];
  month: string;
  username: string;
};

export default function CategoryMarkupPanel({ categories, month, username }: Props) {
  const [categoryId, setCategoryId]   = useState<string>(categories[0] ? String(categories[0].id) : "");
  const [strategy, setStrategy]       = useState<"min" | "avg" | "max">("avg");
  const [markupType, setMarkupType]   = useState<"percent" | "amount">("percent");
  const [markupMin, setMarkupMin]     = useState<string>("8");
  const [markupMax, setMarkupMax]     = useState<string>("14");
  const [result, setResult]           = useState<{ applied: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();

  const handleApply = () => {
    setResult(null);
    setError(null);
    const min = parseFloat(markupMin);
    const max = parseFloat(markupMax);
    if (!categoryId) { setError("Please select a category."); return; }
    if (isNaN(min) || isNaN(max) || min < 0 || max < min) {
      setError("Max markup must be ≥ min markup, and both must be ≥ 0.");
      return;
    }

    const fd = new FormData();
    fd.set("categoryId",  categoryId);
    fd.set("month",       month);
    fd.set("strategy",    strategy);
    fd.set("markupType",  markupType);
    fd.set("markupMin",   String(min));
    fd.set("markupMax",   String(max));
    fd.set("createdBy",   username);

    startTransition(async () => {
      const res = await applyCategoryMarkupAction(fd);
      if (res.ok) {
        setResult({ applied: res.applied ?? 0, skipped: res.skipped ?? 0, errors: res.errors ?? [] });
      } else {
        setError(res.error ?? "Unknown error");
      }
    });
  };

  const selectedCat = categories.find(c => String(c.id) === categoryId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Context banner */}
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, var(--primary-light), transparent)",
        border: "1.5px solid var(--border-accent)",
        borderRadius: "var(--radius-lg)",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <span style={{ fontSize: "22px" }}>⚡</span>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Bulk Category Pricing
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Apply the same markup to <strong>all items</strong> in a category for{" "}
            <strong>{formatMonthLabel(month)}</strong> in one click.
            Items with no supplier quotes this month are skipped automatically.
          </div>
        </div>
      </div>

      {/* Form grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        {/* Category */}
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Target Category</span>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        {/* Strategy */}
        <label className="field">
          <span>Pricing Base</span>
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value as "min" | "avg" | "max")}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          >
            <option value="min">Cheapest Supplier (Min)</option>
            <option value="avg">Average Supplier (Avg)</option>
            <option value="max">Highest Supplier (Max)</option>
          </select>
        </label>

        {/* Markup mode */}
        <label className="field">
          <span>Markup Mode</span>
          <div style={{ display: "flex", gap: "4px", background: "var(--bg-subtle)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
            {(["percent", "amount"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMarkupType(m)}
                className={`button ${markupType === m ? "button-primary" : "button-secondary"}`}
                style={{ flex: 1, padding: "6px", fontSize: "11px", borderRadius: "6px", cursor: "pointer" }}
              >
                {m === "percent" ? "% Percent" : "EGP Fixed"}
              </button>
            ))}
          </div>
        </label>

        {/* Min markup */}
        <label className="field">
          <span>Min Markup {markupType === "percent" ? "%" : "(EGP)"}</span>
          <input
            type="number"
            min="0"
            step={markupType === "percent" ? "0.5" : "1"}
            value={markupMin}
            onChange={e => setMarkupMin(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--success)", fontWeight: 700, fontSize: "14px" }}
          />
        </label>

        {/* Max markup */}
        <label className="field">
          <span>Max Markup {markupType === "percent" ? "%" : "(EGP)"}</span>
          <input
            type="number"
            min="0"
            step={markupType === "percent" ? "0.5" : "1"}
            value={markupMax}
            onChange={e => setMarkupMax(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 700, fontSize: "14px" }}
          />
        </label>
      </div>

      {/* Preview strip */}
      {selectedCat && (
        <div style={{
          padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: "var(--radius)",
          border: "1px solid var(--border-light)", fontSize: "12px", color: "var(--text-secondary)",
          display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
        }}>
          <span>📦</span>
          <strong style={{ color: "var(--text-primary)" }}>{selectedCat.name}</strong>
          <span>·</span>
          <span>{formatMonthLabel(month)}</span>
          <span>·</span>
          <span>Strategy: <strong>{strategy.toUpperCase()}</strong></span>
          <span>·</span>
          <span>Markup: <strong style={{ color: "var(--success)" }}>{markupMin}{markupType === "percent" ? "%" : " EGP"}</strong>
            {" → "}
            <strong style={{ color: "var(--primary)" }}>{markupMax}{markupType === "percent" ? "%" : " EGP"}</strong>
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", background: "var(--danger-light)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "var(--radius)", fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          padding: "14px 16px",
          background: result.applied > 0 ? "var(--success-light)" : "var(--warning-light)",
          border: `1px solid ${result.applied > 0 ? "rgba(16,185,129,0.3)" : "rgba(217,119,6,0.3)"}`,
          borderRadius: "var(--radius)",
        }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: result.errors.length ? "10px" : "0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Applied</span>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--success)", lineHeight: 1 }}>{result.applied}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Skipped</span>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--warning)", lineHeight: 1 }}>{result.skipped}</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Apply button */}
      <button
        type="button"
        onClick={handleApply}
        disabled={pending}
        className="button button-primary"
        style={{ padding: "11px 24px", fontSize: "13px", cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.7 : 1, alignSelf: "flex-start" }}
      >
        {pending ? "⏳ Applying…" : `⚡ Apply to All Items in Category`}
      </button>
    </div>
  );
}
