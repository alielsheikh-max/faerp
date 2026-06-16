"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n-context";

type CatalogRow = {
  item_id: number;
  item_name: string;
  unit: string;
  category_name: string;
  sell_min: number | null;
  sell_max: number | null;
  moq?: number;
};

type Props = {
  catalog: CatalogRow[];
  month: string;
  username: string;
};

export default function UsdPricePanel({ catalog, month, username }: Props) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateInfo, setRateInfo] = useState<string | null>(null);

  const lbl = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const published = catalog.filter((r) => r.sell_min !== null && r.sell_max !== null);

  const openPanel = useCallback(async () => {
    setOpen(true);
    if (rate) return; // Already loaded
    setLoadingRate(true);
    setRateError(null);
    try {
      const res = await fetch("/api/exchange-rate");
      const d = await res.json();
      if (res.ok && d.rate) {
        setRate(d.rate);
        setRateInfo(d.fetched_at ? new Date(d.fetched_at).toLocaleDateString() : "");
      } else {
        setRateError(d.error ?? lbl("Could not load rate.", "تعذّر تحميل سعر الصرف."));
      }
    } catch {
      setRateError(lbl("Network error.", "خطأ في الاتصال."));
    } finally {
      setLoadingRate(false);
    }
  }, [rate, locale]);

  // Convert EGP to USD
  const toUSD = (egp: number | null) =>
    egp !== null && rate ? egp / rate : null;

  const fmtUSD = (v: number | null) =>
    v !== null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  // ── Excel / CSV Export ──────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!rate) return;
    const header = ["Category", "Product", "Unit", "MOQ", "Min Sell (EGP)", "Max Sell (EGP)", "Min Sell (USD)", "Max Sell (USD)"].join(",");
    const rows = published.map((r) => [
      `"${r.category_name}"`,
      `"${r.item_name}"`,
      `"${r.unit}"`,
      r.moq ?? 0,
      r.sell_min?.toFixed(2) ?? "",
      r.sell_max?.toFixed(2) ?? "",
      toUSD(r.sell_min)?.toFixed(2) ?? "",
      toUSD(r.sell_max)?.toFixed(2) ?? "",
    ].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selling_prices_usd_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [published, rate, month]);

  // ── PDF via print ───────────────────────────────────────────────────────────
  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  // ── Group by category ───────────────────────────────────────────────────────
  const grouped: Record<string, CatalogRow[]> = {};
  for (const row of published) {
    if (!grouped[row.category_name]) grouped[row.category_name] = [];
    grouped[row.category_name].push(row);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        style={{
          padding: "10px 20px",
          borderRadius: "10px",
          border: "1px solid var(--border-medium)",
          backgroundColor: "var(--bg-surface)",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontWeight: "700",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          transition: "all 200ms",
          width: "100%",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--primary)";
          e.currentTarget.style.color = "var(--primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-medium)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
      >
        💵 {lbl("Show Prices in USD", "عرض الأسعار بالدولار")}
      </button>
    );
  }

  return (
    <>
      {/* Print CSS — uses visibility (not display:none) so it works regardless of Next.js DOM nesting */}
      <style>{`
        @media print {
          /* Hide everything */
          body * { visibility: hidden !important; }
          /* Show only the USD print root and all its children */
          .usd-print-root, .usd-print-root * { visibility: visible !important; }
          /* Position the print root at the top of the page */
          .usd-print-root {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important; height: auto !important;
            background: #fff !important;
            z-index: 9999 !important;
            overflow: visible !important;
          }
          /* Remove modal chrome for print */
          .usd-no-print { display: none !important; visibility: hidden !important; }
          .usd-print-modal { display: block !important; visibility: visible !important; }
          .modal-overlay { background: none !important; position: static !important; display: block !important; padding: 0 !important; }
          .modal-container { max-height: none !important; box-shadow: none !important; overflow: visible !important; max-width: 100% !important; }
          .modal-body { overflow: visible !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="modal-overlay usd-print-root" onClick={() => setOpen(false)}>
        <div
          className="modal-container"
          style={{ maxWidth: "860px", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="modal-header usd-no-print"
            style={{
              background: "linear-gradient(135deg, #0f4c81 0%, #1d6fa4 100%)",
              borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
              border: "none", padding: "20px 24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
              <div style={{
                width: "46px", height: "46px", borderRadius: "12px",
                backgroundColor: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px", flexShrink: 0,
              }}>💵</div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                  {lbl("Published Selling Prices in USD", "قائمة الأسعار المعتمدة بالدولار")}
                </h2>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", marginTop: "4px" }}>
                  {month}
                  {rate && (
                    <span style={{ marginLeft: "10px" }}>
                      · 1 USD = {rate.toFixed(4)} EGP
                      {rateInfo && ` (${rateInfo})`}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {rate && (
                <>
                  <button
                    type="button"
                    onClick={exportCSV}
                    style={{
                      padding: "8px 14px", fontSize: "12px", fontWeight: "700",
                      borderRadius: "8px", border: "1px solid rgba(255,255,255,0.4)",
                      backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    📊 {lbl("Excel / CSV", "إكسل / CSV")}
                  </button>
                  <button
                    type="button"
                    onClick={exportPDF}
                    style={{
                      padding: "8px 14px", fontSize: "12px", fontWeight: "700",
                      borderRadius: "8px", border: "1px solid rgba(255,255,255,0.4)",
                      backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    🖨️ {lbl("PDF Print", "طباعة PDF")}
                  </button>
                </>
              )}
              <button
                className="modal-close-btn"
                onClick={() => setOpen(false)}
                style={{ color: "rgba(255,255,255,0.85)", fontSize: "26px" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Print-only header */}
          <div className="usd-print-modal" style={{ display: "none", padding: "20px 0 10px" }}>
            <h1 style={{ fontSize: "18px", fontWeight: "800", margin: "0 0 4px" }}>
              {lbl("Published Selling Prices — USD", "قائمة الأسعار المعتمدة — بالدولار")}
            </h1>
            <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>
              {month} · 1 USD = {rate?.toFixed(4)} EGP · {lbl("Printed by", "طبع بواسطة")} {username}
            </p>
            <hr style={{ margin: "12px 0" }} />
          </div>

          {/* Body */}
          <div className="modal-body" style={{ padding: "24px", overflowY: "auto", flex: 1 }}>

            {loadingRate && (
              <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
                ⏳ {lbl("Loading exchange rate…", "جارٍ تحميل سعر الصرف…")}
              </div>
            )}

            {rateError && (
              <div style={{
                padding: "16px 20px", marginBottom: "20px",
                backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "10px", fontSize: "13px", color: "var(--danger)",
              }}>
                ⚠️ {rateError}
                <div style={{ fontSize: "11px", marginTop: "6px", color: "var(--text-muted)" }}>
                  {lbl("Use the USD Rate Card to refresh or enter a rate manually.", "استخدم بطاقة سعر الدولار لتحديث السعر أو إدخاله يدوياً.")}
                </div>
              </div>
            )}

            {rate && !loadingRate && (
              <>
                {/* Rate info bar */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
                  padding: "12px 16px", marginBottom: "20px",
                  backgroundColor: "rgba(29,111,164,0.08)",
                  border: "1px solid rgba(29,111,164,0.2)",
                  borderRadius: "10px",
                }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
                      {lbl("Rate Applied", "السعر المطبق")}
                    </span>
                    <div style={{ fontSize: "18px", fontWeight: "900", color: "var(--primary)" }}>
                      1 USD = {rate.toFixed(4)} EGP
                    </div>
                  </div>
                  <div style={{ height: "40px", width: "1px", backgroundColor: "var(--border-light)" }} />
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
                      {lbl("Published Items", "المنتجات المعتمدة")}
                    </span>
                    <div style={{ fontSize: "18px", fontWeight: "900", color: "var(--text-primary)" }}>
                      {published.length}
                    </div>
                  </div>
                  {rateInfo && (
                    <>
                      <div style={{ height: "40px", width: "1px", backgroundColor: "var(--border-light)" }} />
                      <div>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
                          {lbl("Rate Date", "تاريخ السعر")}
                        </span>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-secondary)" }}>
                          {rateInfo}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Price tables by category */}
                {Object.entries(grouped).map(([cat, rows]) => (
                  <div key={cat} style={{ marginBottom: "24px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      marginBottom: "10px",
                    }}>
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--text-primary)" }}>
                        {cat}
                      </h3>
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 10px",
                        borderRadius: "20px", backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border-medium)", color: "var(--text-muted)",
                      }}>
                        {rows.length}
                      </span>
                    </div>
                    <div style={{ borderRadius: "10px", border: "1px solid var(--border-light)", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "var(--bg-elevated)" }}>
                            {[
                              lbl("Product", "المنتج"),
                              lbl("Unit", "الوحدة"),
                              lbl("MOQ", "الحد الأدنى"),
                              lbl("Min (EGP)", "الحد الأدنى (ج.م)"),
                              lbl("Max (EGP)", "الحد الأقصى (ج.م)"),
                              lbl("Min (USD)", "الحد الأدنى ($)"),
                              lbl("Max (USD)", "الحد الأقصى ($)"),
                            ].map((h) => (
                              <th key={h} style={{
                                padding: "10px 14px", textAlign: "left",
                                fontWeight: "700", fontSize: "10px",
                                color: "var(--text-muted)", textTransform: "uppercase",
                                letterSpacing: "0.07em",
                                borderBottom: "2px solid var(--border-medium)",
                                whiteSpace: "nowrap",
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.item_id} style={{
                              backgroundColor: i % 2 === 0 ? "transparent" : "var(--bg-subtle)",
                              borderBottom: "1px solid var(--border-light)",
                            }}>
                              <td style={{ padding: "10px 14px", fontWeight: "700", color: "var(--text-primary)", maxWidth: "200px" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                                  title={r.item_name}>
                                  {r.item_name}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                                  {r.unit}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px", color: "var(--text-muted)", textAlign: "center" }}>
                                {r.moq ?? "—"}
                              </td>
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                <span style={{ fontWeight: "700", color: "var(--success)" }}>
                                  EGP {r.sell_min?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                <span style={{ fontWeight: "700", color: "var(--primary)" }}>
                                  EGP {r.sell_max?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                <span style={{ fontWeight: "800", color: "#0f4c81", fontSize: "13px" }}>
                                  {fmtUSD(toUSD(r.sell_min))}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                <span style={{ fontWeight: "800", color: "#1d6fa4", fontSize: "13px" }}>
                                  {fmtUSD(toUSD(r.sell_max))}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </>
            )}

            {!rate && !loadingRate && !rateError && (
              <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>💱</div>
                <div style={{ fontWeight: "700" }}>
                  {lbl("No exchange rate available.", "لا يوجد سعر صرف متاح.")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
