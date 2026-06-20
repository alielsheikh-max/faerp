"use client";

import { useState, useEffect, useTransition } from "react";
import { applyCategoryMarkupAction } from "@/app/actions/pricing";
import { formatMonthLabel } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n-context";

type Category = { id: number; name: string };
type Item = {
  id: number;
  category_id: number;
  name: string;
  unit: string;
  is_tiered?: number;
  tier1_max?: number;
  tier1_discount?: number;
  tier2_max?: number;
  tier2_discount?: number;
  tier3_max?: number;
  tier3_discount?: number;
  tier4_max?: number;
  tier4_discount?: number;
};

type Props = {
  categories: Category[];
  items: Item[];
  month: string;
  username: string;
  defaultCategoryId?: string;
  onSuccess?: () => void;
};

export default function CategoryMarkupPanel({ categories, items, month, username, defaultCategoryId, onSuccess }: Props) {
  const [categoryId, setCategoryId]   = useState<string>(
    defaultCategoryId || (categories[0] ? String(categories[0].id) : "")
  );
  const [strategy, setStrategy]       = useState<"min" | "avg" | "max">("avg");
  const [markupType, setMarkupType]   = useState<"percent" | "amount" | "divisor">("percent");
  const [markupMin, setMarkupMin]     = useState<string>("8");
  const [markupMax, setMarkupMax]     = useState<string>("14");
  const [divisor, setDivisor]         = useState<string>("0.77");
  const [result, setResult]           = useState<{ applied: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();

  const router = useRouter();
  const { locale } = useI18n();

  useEffect(() => {
    if (defaultCategoryId) {
      setCategoryId(defaultCategoryId);
    }
  }, [defaultCategoryId]);

  const handleApply = () => {
    setResult(null);
    setError(null);
    if (!categoryId) { setError("Please select a category."); return; }

    const fd = new FormData();
    fd.set("categoryId", categoryId);
    fd.set("month",      month);
    fd.set("strategy",   strategy);
    fd.set("createdBy",  username);

    if (markupType === "divisor") {
      const d = parseFloat(divisor);
      if (isNaN(d) || d <= 0 || d > 1) { setError("Divisor must be between 0.01 and 1.00 (e.g. 0.77)."); return; }
      fd.set("markupType", "divisor");
      fd.set("markupMin",  String(d));
      fd.set("markupMax",  String(d));
    } else {
      const min = parseFloat(markupMin);
      const max = parseFloat(markupMax);
      if (isNaN(min) || isNaN(max) || min < 0 || max < min) {
        setError("Max markup must be ≥ min markup, and both must be ≥ 0.");
        return;
      }
      fd.set("markupType", markupType);
      fd.set("markupMin",  String(min));
      fd.set("markupMax",  String(max));
    }

    startTransition(async () => {
      const res = await applyCategoryMarkupAction(fd);
      if (res?.ok) {
        setResult({ applied: res.applied ?? 0, skipped: res.skipped ?? 0, errors: res.errors ?? [] });
        router.refresh();
      } else {
        setError(res?.error ?? "Unknown error");
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
            {(["percent", "amount", "divisor"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMarkupType(m)}
                className={`button ${markupType === m ? "button-primary" : "button-secondary"}`}
                style={{ flex: 1, padding: "6px", fontSize: "11px", borderRadius: "6px", cursor: "pointer" }}
              >
                {m === "percent" ? "% Percent" : m === "amount" ? "EGP Fixed" : "÷ Divisor"}
              </button>
            ))}
          </div>
        </label>

        {/* Divisor inputs */}
        {markupType === "divisor" ? (
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>Divisor Value <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "10px" }}>(sell = cost ÷ divisor, e.g. 0.77 = 30% margin)</span></span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={divisor}
                onChange={e => setDivisor(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1.5px solid var(--primary)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 800, fontSize: "16px", width: "120px" }}
              />
              {/* Quick-select tier divisors */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {[
                  { label: "0.77", desc: "T1" },
                  { label: "0.83", desc: "T2" },
                  { label: "0.85", desc: "T3" },
                  { label: "0.89", desc: "T4" },
                ].map(d => (
                  <button key={d.label} type="button" onClick={() => setDivisor(d.label)}
                    className={`button ${divisor === d.label ? "button-primary" : "button-secondary"}`}
                    style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "6px" }}>
                    {d.desc} {d.label}
                  </button>
                ))}
              </div>
              {parseFloat(divisor) > 0 && parseFloat(divisor) <= 1 && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  ≈ {((1 / parseFloat(divisor) - 1) * 100).toFixed(1)}% implied margin
                </span>
              )}
            </div>
          </label>
        ) : (
          <>
            {/* Min markup */}
            <label className="field">
              <span>Min Markup {markupType === "percent" ? "%" : "(EGP)"}</span>
              <input type="number" min="0" step="any" value={markupMin} onChange={e => setMarkupMin(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--success)", fontWeight: 700, fontSize: "14px" }} />
            </label>
            {/* Max markup */}
            <label className="field">
              <span>Max Markup {markupType === "percent" ? "%" : "(EGP)"}</span>
              <input type="number" min="0" step="any" value={markupMax} onChange={e => setMarkupMax(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--primary)", fontWeight: 700, fontSize: "14px" }} />
            </label>
          </>
        )}
      </div>

      {/* Volume Tier Preview (Permanently visible for info) */}
      {true && (
        <div style={{
          padding: "12px 14px",
          border: "1.5px dashed var(--border-accent)",
          borderRadius: "8px",
          background: "var(--bg-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "-6px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>⚡</span>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {locale === "ar" ? "خصومات الحجم النشطة للعناصر" : "Active Item Volume Tiers"}
            </span>
          </div>

          {(() => {
            const selectedCategoryIdNum = categoryId ? parseInt(categoryId, 10) : null;
            const tieredItemsOfCategory = (items || []).filter(
              (item) => item.category_id === selectedCategoryIdNum && item.is_tiered === 1
            );

            if (tieredItemsOfCategory.length === 0) {
              return (
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {locale === "ar" 
                    ? "لا توجد عناصر ذات تسعير حجمي مكوّنة في هذه الفئة." 
                    : "No volume tiered items configured in this category."}
                </div>
              );
            }

            return (
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "10px", 
                maxHeight: "340px", 
                overflowY: "auto",
                overflowX: "hidden",
                paddingRight: "4px",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(99,102,241,0.3) transparent",
              }}>
                {tieredItemsOfCategory.map((item) => {
                  const t1Max  = item.tier1_max ?? 100;
                  const t1Disc = item.tier1_discount ?? 0;
                  const t2Max  = item.tier2_max ?? 200;
                  const t2Disc = item.tier2_discount ?? 5;
                  const t3Max  = item.tier3_max ?? 300;
                  const t3Disc = item.tier3_discount ?? 10;
                  const t4Max  = item.tier4_max ?? 0;
                  const t4Disc = item.tier4_discount ?? 0;
                  const has4   = t4Disc > 0;

                  const tierCells = [
                    { label: locale === "ar" ? `فئة ١ (٠-${t1Max})` : `Tier 1 (0-${t1Max})`, disc: t1Disc, color: "var(--success)" },
                    { label: locale === "ar" ? `فئة ٢ (${t1Max+1}-${t2Max})` : `Tier 2 (${t1Max+1}-${t2Max})`, disc: t2Disc, color: "var(--primary)" },
                    { label: locale === "ar" ? `فئة ٣ (${t2Max+1}-${t3Max})` : `Tier 3 (${t2Max+1}-${t3Max})`, disc: t3Disc, color: "var(--warning)" },
                    ...(has4 ? [{ label: locale === "ar" ? `فئة ٤ (${t3Max+1}${t4Max ? `-${t4Max}` : "+"})` : `Tier 4 (${t3Max+1}${t4Max ? `-${t4Max}` : "+"})`, disc: t4Disc, color: "var(--danger)" }] : []),
                  ];

                  return (
                    <div key={item.id} style={{
                      padding: "12px 14px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}>
                      {/* Item header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.3 }}>{item.name}</span>
                        <span className="badge badge-strong" style={{ fontSize: "9px", flexShrink: 0, marginInlineStart: "8px" }}>{item.unit}</span>
                      </div>
                      {/* Tier grid */}
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${has4 ? 4 : 3}, 1fr)`, gap: "6px" }}>
                        {tierCells.map((tc, idx) => (
                          <div key={idx} style={{
                            background: "var(--bg-subtle)",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-light)",
                            borderLeft: `3px solid ${tc.color}`,
                            textAlign: "center",
                          }}>
                            <div style={{ color: "var(--text-muted)", fontSize: "10px", marginBottom: "3px" }}>{tc.label}</div>
                            <div style={{ fontWeight: 800, color: tc.color, fontSize: "11px" }}>{tc.disc}% {locale === "ar" ? "خصم" : "disc"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

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
          <span>Markup: {markupType === "divisor"
            ? <strong style={{ color: "var(--primary)" }}>÷ {divisor}</strong>
            : <><strong style={{ color: "var(--success)" }}>{markupMin}{markupType === "percent" ? "%" : " EGP"}</strong>
              {" → "}
              <strong style={{ color: "var(--primary)" }}>{markupMax}{markupType === "percent" ? "%" : " EGP"}</strong></>}
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
