"use client";

import { useState, useEffect, useRef, useTransition, useCallback, useMemo, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { fetchItemCard, fetchSupplierCard } from "@/app/actions/search";
import { useI18n } from "@/lib/i18n-context";

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

type SearchItem     = { id: number; name: string; unit: string; active: number; category_name: string; category_id: number };
type SearchSupplier = { id: number; name: string; fame_name?: string | null; contact_person: string; phone: string; quote_count: number };
type SearchIndex    = { items: SearchItem[]; suppliers: SearchSupplier[] };
type ItemCardData     = Awaited<ReturnType<typeof fetchItemCard>>;
type SupplierCardData = Awaited<ReturnType<typeof fetchSupplierCard>>;
type CardState = { type: "item"; data: NonNullable<ItemCardData> } | { type: "supplier"; data: NonNullable<SupplierCardData> } | null;

function fuzzy(query: string, target: string) {
  return target.toLowerCase().includes(query.toLowerCase().trim());
}

// ── Item Detail ───────────────────────────────────────────────────────────────
function ItemDetail({ data, role, onClose }: { data: NonNullable<ItemCardData>; role: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [window, setWindow] = useState<6 | 12 | "all">(6);
  const { item, supplierStats, monthStats, months, supplierNames, grid, sellingRows } = data;
  const visibleMonths = window === "all" ? months : months.slice(0, window as number);

  // ── Gallery / Lightbox state ──────────────────────────────────────────────
  const galleryImages: string[] = useMemo(() => {
    const imagesStr = (item as any).images;
    if (!imagesStr) return [];
    try { return JSON.parse(imagesStr); } catch { return []; }
  }, [item]);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setLightboxIdx(i => (i - 1 + galleryImages.length) % galleryImages.length);
      if (e.key === "ArrowRight") setLightboxIdx(i => (i + 1) % galleryImages.length);
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [lightboxOpen, galleryImages.length]);

  const renderGallery = () => {
    if (galleryImages.length === 0) return null;
    return (
      <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
          📷 {locale === "ar" ? "صور المنتج (انقر للعرض والتكبير)" : "Product Images (Click to zoom)"}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {galleryImages.map((src, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setLightboxIdx(idx);
                setLightboxOpen(true);
              }}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1.5px solid var(--border-medium)",
                padding: 0,
                cursor: "pointer",
                background: "var(--bg-elevated)",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.borderColor = "var(--primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.borderColor = "var(--border-medium)";
              }}
            >
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderLightbox = () => {
    if (!lightboxOpen) return null;
    const lbPrev = () => setLightboxIdx(i => (i - 1 + galleryImages.length) % galleryImages.length);
    const lbNext = () => setLightboxIdx(i => (i + 1) % galleryImages.length);
    return (
      <div
        onClick={() => setLightboxOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0,0,0,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "fadeIn 0.2s ease",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "absolute",
            top: "20px",
            insetInlineEnd: "24px",
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: "42px",
            height: "42px",
            cursor: "pointer",
            fontSize: "20px",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >✕</button>

        {/* Prev */}
        {galleryImages.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); lbPrev(); }}
            style={{
              position: "absolute",
              insetInlineStart: "24px",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: "48px",
              height: "48px",
              cursor: "pointer",
              fontSize: "22px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >{locale === "ar" ? "›" : "‹"}</button>
        )}

        {/* Image */}
        <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "85vw", maxHeight: "85vh", position: "relative" }}>
          <img
            src={galleryImages[lightboxIdx]}
            alt=""
            style={{
              maxWidth: "85vw",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: "12px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
              display: "block",
            }}
          />
          {galleryImages.length > 1 && (
            <div style={{
              position: "absolute",
              bottom: "-36px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.7)",
              fontSize: "13px",
              fontWeight: 600,
            }}>
              {lightboxIdx + 1} / {galleryImages.length}
            </div>
          )}
        </div>

        {/* Next */}
        {galleryImages.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); lbNext(); }}
            style={{
              position: "absolute",
              insetInlineEnd: "24px",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: "48px",
              height: "48px",
              cursor: "pointer",
              fontSize: "22px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >{locale === "ar" ? "‹" : "›"}</button>
        )}
      </div>
    );
  };

  if (role === "SA") {
    const latestSelling = sellingRows[0];
    const isLatestTiered = latestSelling && (latestSelling.tier_pricing_enabled || latestSelling.is_tiered);
    const latestTiers = isLatestTiered ? (latestSelling.tierPrices || []) : [];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Item header */}
        <div className="item-detail-header" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "20px 24px", borderBottom: "1px solid var(--border-light)", background: "linear-gradient(135deg, rgba(99,102,241,0.06), transparent)" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>📦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", marginBottom: "3px" }}>{item.category_name}</div>
            <h2 style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>{item.name}</h2>
            <div style={{ display: "flex", gap: "8px", marginTop: "7px", flexWrap: "wrap" }}>
              <span className="badge badge-strong">{item.unit}</span>
              <span className={`badge ${item.active ? "badge-success" : "badge-danger"}`}>{item.active ? t("search.active") : t("search.inactive")}</span>
              <span className="badge">{t("search.monthsCount").replace("{count}", String(sellingRows.length))}</span>
            </div>
          </div>
          <Link
            href={`/dashboard/admin/items/${item.id}`}
            onClick={onClose}
            className="button button-secondary"
            style={{ fontSize: "12px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
          >
            <span>{t("search.viewAll")}</span>
          </Link>
        </div>

        {renderGallery()}

        <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Approved Selling Price Card */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-secondary)", marginBottom: "10px" }}>
              {latestSelling ? formatMonthLabel(latestSelling.month) : t("search.latest")} — {locale === "ar" ? "أسعار البيع المعتمدة" : "Approved Selling Prices"}
            </p>
            {latestSelling ? (
              <div style={{
                padding: "16px",
                borderRadius: "12px",
                background: "var(--bg-elevated)",
                border: "1.5px solid var(--border-medium)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
              }}>
                {isLatestTiered ? (
                  /* Tier prices layout */
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px" }}>
                    {latestTiers.map((tier, idx) => {
                      const colors = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)"];
                      return (
                        <div key={tier.label} style={{
                          padding: "10px",
                          borderRadius: "8px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-light)",
                          textAlign: "center"
                        }}>
                          <div style={{ fontSize: "10px", fontWeight: 800, color: colors[idx % colors.length], textTransform: "uppercase", marginBottom: "4px" }}>
                            {tier.label}
                          </div>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)" }}>
                            {formatCurrency(tier.price)}
                          </div>
                          <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {tier.range}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Single range / min-max layout */
                  <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>MIN</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--success)", marginTop: "4px" }}>
                        {formatCurrency(latestSelling.sell_min)}
                      </div>
                    </div>
                    <div style={{ color: "var(--border-medium)", fontSize: "24px" }}>|</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>MAX</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                        {formatCurrency(latestSelling.sell_max)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "16px", borderRadius: "12px", background: "var(--bg-elevated)", border: "1px dashed var(--border)", textAlign: "center", color: "var(--text-muted)" }}>
                {locale === "ar" ? "لا توجد أسعار بيع معتمدة لشهر البداية" : "No approved selling prices available"}
              </div>
            )}
          </div>

          {/* Historical selling prices table */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-secondary)", marginBottom: "10px" }}>
              {locale === "ar" ? "سجل أسعار البيع المعتمدة" : "Approved Selling Price History"}
            </p>
            <div className="table-wrap" style={{ maxHeight: "260px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    <th style={{ padding: "8px 12px", textAlign: locale === "ar" ? "right" : "left", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2 }}>
                      {locale === "ar" ? "الشهر" : "Month"}
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2 }}>
                      {locale === "ar" ? "النوع" : "Type"}
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: locale === "ar" ? "left" : "right", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2 }}>
                      {locale === "ar" ? "سعر البيع المعتمد" : "Approved Sell Prices"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sellingRows.map((row) => {
                    const isTiered = row.tier_pricing_enabled || row.is_tiered;
                    const isApproved = row.approval_status === "approved";
                    const sellMin = row.sell_min;
                    const sellMax = row.sell_max;
                    
                    return (
                      <tr key={row.month} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {formatMonthLabel(row.month)}
                          {!isApproved && (
                            <span className="badge" style={{ backgroundColor: "var(--warning-light)", color: "var(--warning)", fontSize: "9px", marginInlineStart: "6px" }}>
                              {locale === "ar" ? "قيد المراجعة" : "Pending"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span className="badge badge-strong" style={{ fontSize: "10px" }}>
                            {isTiered ? (locale === "ar" ? "شرائح" : "TIERS") : (locale === "ar" ? "نطاق" : "RANGE")}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: locale === "ar" ? "left" : "right", whiteSpace: "nowrap" }}>
                          {isTiered ? (
                            /* Render summary of tiers */
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                              {(row.tierPrices || []).map((t: any, ti: number) => {
                                const colors = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)"];
                                return (
                                  <span key={t.label} style={{ fontSize: "11px", fontWeight: 700 }}>
                                    <span style={{ color: colors[ti % colors.length], marginInlineEnd: "2px" }}>{t.label}:</span>
                                    {formatCurrency(t.price)}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            /* Render Min/Max selling price */
                            <div style={{ fontWeight: 700 }}>
                              <span style={{ color: "var(--success)" }}>{formatCurrency(sellMin)}</span>
                              <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>–</span>
                              <span style={{ color: "var(--primary)" }}>{formatCurrency(sellMax)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {renderLightbox()}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Item header */}
      <div className="item-detail-header" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "20px 24px", borderBottom: "1px solid var(--border-light)", background: "linear-gradient(135deg, rgba(99,102,241,0.06), transparent)" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>📦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--primary)", marginBottom: "3px" }}>{item.category_name}</div>
          <h2 style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>{item.name}</h2>
          <div style={{ display: "flex", gap: "8px", marginTop: "7px", flexWrap: "wrap" }}>
            <span className="badge badge-strong">{item.unit}</span>
            <span className={`badge ${item.active ? "badge-success" : "badge-danger"}`}>{item.active ? t("search.active") : t("search.inactive")}</span>
            <span className="badge">{t("search.suppliersCount").replace("{count}", String(supplierStats.length))}</span>
            <span className="badge">{t("search.monthsCount").replace("{count}", String(months.length))}</span>
          </div>
          {item.recommended_supplier_name && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginTop: "8px", padding: "7px 12px", borderRadius: "8px",
              background: "rgba(234,179,8,0.08)", border: "1.5px solid rgba(234,179,8,0.30)",
            }}>
              <span style={{ fontSize: "14px", flexShrink: 0 }}>⭐</span>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#92400e" }}>
                {locale === "ar" ? "المورد الموصى به" : "Recommended Supplier"}
              </span>
              <span style={{
                fontSize: "12px", fontWeight: 800, color: "#b45309",
                padding: "2px 8px", borderRadius: "6px",
                background: "rgba(234,179,8,0.12)",
              }}>
                {item.recommended_supplier_name}
              </span>
            </div>
          )}
        </div>
        <Link
          href={`/dashboard/admin/items/${item.id}`}
          onClick={onClose}
          className="button button-secondary"
          style={{ fontSize: "12px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
        >
          <span>{t("search.viewAll")}</span>
        </Link>
      </div>

      {renderGallery()}

      <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Current supplier prices */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-secondary)", marginBottom: "10px" }}>
            {months[0] ? formatMonthLabel(months[0]) : t("search.latest")} — {t("search.supplierPrices")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
            {(() => {
              // Resolve recommended supplier name from priceRows
              const recSupName = item.recommended_supplier_id
                ? data.priceRows.find(r => r.supplier_id === item.recommended_supplier_id)?.supplier_name ?? null
                : null;
              return supplierStats.map((sup, idx) => {
                const color = COLORS[idx % COLORS.length];
                const isBest = idx === 0;
                const isRecommended = recSupName !== null && sup.name === recSupName;
                return (
                  <div key={sup.name} style={{
                    padding: "12px 14px", borderRadius: "var(--radius)", position: "relative",
                    border: `1.5px solid ${isRecommended ? "rgba(234,179,8,0.5)" : isBest ? "var(--info)" : color + "44"}`,
                    background: isRecommended ? "rgba(234,179,8,0.06)" : isBest ? "var(--info-light)" : color + "0a",
                  }}>
                    {isBest && <span style={{ position: "absolute", top: "5px", insetInlineEnd: isRecommended ? "30px" : "6px", fontSize: "8px", fontWeight: 800, background: "var(--info)", color: "#fff", padding: "1px 5px", borderRadius: "4px" }}>{t("search.best")}</span>}
                    {isRecommended && <span style={{ position: "absolute", top: "5px", insetInlineEnd: "6px", fontSize: "12px", cursor: "help" }} title={locale === "ar" ? "المورد الموصى به" : "Recommended Supplier"}>⭐</span>}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.name}</span>
                    </div>
                    <div style={{ fontSize: "17px", fontWeight: 800, color: isBest ? "var(--info)" : "var(--text-primary)" }}>{formatCurrency(sup.latestPrice)}</div>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "3px" }}>{t("search.avg").toLowerCase()} {formatCurrency(sup.avg)}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* SC: selling prices */}
        {role === "SC" && sellingRows.length > 0 && (
          <div>
            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-secondary)", marginBottom: "8px" }}>{t("search.publishedSellingPrices")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {sellingRows.slice(0, 4).map(s => (
                <div key={s.month} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border-light)", fontSize: "12px", flexWrap: "wrap" }}>
                  <span className="badge" style={{ fontSize: "10px" }}>{formatMonthLabel(s.month)}</span>
                  <strong style={{ color: "var(--success)" }}>{formatCurrency(s.sell_min)}</strong>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                  <strong style={{ color: "var(--primary)" }}>{formatCurrency(s.sell_max)}</strong>
                  <span className="badge badge-strong" style={{ fontSize: "9px", marginLeft: "auto", marginRight: "auto" }}>{(s.strategy || "—").toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Price history matrix */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-secondary)", margin: 0 }}>{t("search.priceHistory")}</p>
            <div style={{ display: "flex", gap: "3px", background: "var(--bg-muted)", padding: "3px", borderRadius: "7px", border: "1px solid var(--border-light)" }}>
              {([6, 12, "all"] as const).map(w => (
                <button key={String(w)} type="button" onClick={() => setWindow(w as any)}
                  style={{ padding: "3px 10px", fontSize: "10px", fontWeight: 700, borderRadius: "5px", border: "none", cursor: "pointer", background: window === w ? "var(--primary)" : "transparent", color: window === w ? "#fff" : "var(--text-muted)", transition: "all 150ms" }}>
                  {w === "all" ? t("search.all") : t("search.monthsCountShort").replace("{count}", String(w))}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: "260px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  <th style={{ padding: "7px 12px", textAlign: locale === "ar" ? "right" : "left", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, insetInlineStart: 0, background: "var(--bg-elevated)", zIndex: 3, whiteSpace: "nowrap", boxShadow: "1px 0 0 var(--border-light), 0 1px 0 var(--border)" }}>{t("search.supplier")}</th>
                  {visibleMonths.map((m, mi) => {
                    const isLatest = mi === 0;
                    return (
                      <th key={m} style={{ padding: "7px 12px", textAlign: "center", fontWeight: isLatest ? 800 : 700, fontSize: "10px", color: isLatest ? "var(--primary)" : "var(--text-muted)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>
                        {formatMonthLabel(m)}
                        {isLatest && <span style={{ fontSize: "7px", fontWeight: 800, marginInlineStart: "4px", color: "var(--primary)", verticalAlign: "super" }}>{t("search.latestLabel")}</span>}
                      </th>
                    );
                  })}
                  <th style={{ padding: "7px 12px", textAlign: "center", fontWeight: 700, fontSize: "10px", color: "var(--primary)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)" }}>{t("search.avg")}</th>
                </tr>
              </thead>
              <tbody>
                {supplierNames.map((sName, si) => {
                  const color = COLORS[si % COLORS.length];
                  const allPrices = visibleMonths.map(m => grid.get(m)?.get(sName)?.price).filter((p): p is number => p !== undefined);
                  const avg = allPrices.length ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : null;
                  return (
                    <tr key={sName} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "8px 12px", position: "sticky", insetInlineStart: 0, background: "var(--bg-surface)", zIndex: 1, boxShadow: "1px 0 0 var(--border-light)", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>{sName}</span>
                        </span>
                      </td>
                      {visibleMonths.map(m => {
                        const entry = grid.get(m)?.get(sName);
                        // Find the cheapest price in this month across all suppliers
                        const monthPrices = supplierNames.map(s => grid.get(m)?.get(s)?.price).filter((p): p is number => p !== undefined);
                        const minP = monthPrices.length ? Math.min(...monthPrices) : null;
                        const isBest = entry && minP !== null && entry.price === minP;
                        return (
                          <td key={m} style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap", fontWeight: isBest ? 800 : 400, color: isBest ? "var(--info)" : entry ? "var(--text-primary)" : "var(--text-dim)", background: isBest ? "rgba(2,132,199,0.08)" : "transparent" }}>
                            {entry ? formatCurrency(entry.price) : "—"}
                          </td>
                        );
                      })}
                      <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>{avg !== null ? formatCurrency(avg) : "—"}</td>
                    </tr>
                  );
                })}
                {/* SC: Sell Range row */}
                {role === "SC" && sellingRows.length > 0 && (
                  <tr style={{ borderTop: "2px solid var(--border)", background: "rgba(245,158,11,0.04)" }}>
                    <td style={{ padding: "8px 12px", position: "sticky", insetInlineStart: 0, background: "var(--bg-surface)", zIndex: 1, boxShadow: "1px 0 0 var(--border-light)", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--warning)", textTransform: "uppercase" }}>{t("search.sellRange")}</span>
                    </td>
                    {visibleMonths.map(m => {
                      const sell = sellingRows.find(s => s.month === m);
                      return (
                        <td key={m} style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap", fontSize: "11px" }}>
                          {sell ? <><span style={{ color: "var(--success)", fontWeight: 700 }}>{formatCurrency(sell.sell_min)}</span><span style={{ color: "var(--text-muted)", margin: "0 3px" }}>–</span><span style={{ color: "var(--primary)", fontWeight: 700 }}>{formatCurrency(sell.sell_max)}</span></> : <span style={{ color: "var(--text-dim)" }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding: "8px 12px" }}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {renderLightbox()}
        </div>
      </div>
    </div>
  );
}

// ── Supplier Detail ───────────────────────────────────────────────────────────
function SupplierDetail({ data, role, onClose }: { data: NonNullable<SupplierCardData>; role: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [catFilter, setCatFilter] = useState("all");
  const { supplier, itemStats, monthStats } = data;
  const categories = Array.from(new Set(itemStats.map(i => i.categoryName))).sort();
  const filtered = catFilter === "all" ? itemStats : itemStats.filter(i => i.categoryName === catFilter);
  const totalQuotes = itemStats.reduce((s, i) => s + i.quoteCount, 0);
  const avgDev = itemStats.length ? itemStats.reduce((s, i) => s + i.avgDeviation, 0) / itemStats.length : 0;
  const maxCount = Math.max(...monthStats.map(m => m.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-light)", background: "linear-gradient(135deg, rgba(59,130,246,0.07), transparent)" }}>
        <div className="supplier-detail-header" style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>🏭</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "#3b82f6", marginBottom: "3px" }}>{t("search.supplierCard")}</div>
            <h2 style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{supplier.fame_name || supplier.name}</h2>
            {supplier.fame_name && supplier.fame_name !== supplier.name && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{supplier.name}</div>
            )}
            {supplier.contact_person && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>{supplier.contact_person}{supplier.phone ? ` · ${supplier.phone}` : ""}</div>}
            <div style={{ display: "flex", gap: "8px", marginTop: "7px", flexWrap: "wrap" }}>
              <span className="badge badge-strong">{t("search.quotesCount").replace("{count}", String(totalQuotes))}</span>
              <span className="badge">{t("search.itemsCount").replace("{count}", String(itemStats.length))}</span>
              <span className="badge">{t("search.monthsCount").replace("{count}", String(data.months.length))}</span>
              {avgDev < -1 && <span className="badge badge-success">{t("search.belowMarket")}</span>}
              {avgDev > 1 && <span className="badge badge-warning">{t("search.aboveMarket")}</span>}
            </div>
          </div>
          <Link
            href={`/dashboard/admin/suppliers/${supplier.id}`}
            onClick={onClose}
            className="button button-secondary"
            style={{ fontSize: "12px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, alignSelf: "center" }}
          >
            <span>{t("search.viewAll")}</span>
          </Link>
        </div>

        {/* KPI row */}
        <div className="supplier-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", marginTop: "14px" }}>
          {[
            { label: t("search.avgVsMarket"), value: `${avgDev > 0 ? "+" : ""}${avgDev.toFixed(1)}%`, color: avgDev < -1 ? "var(--success)" : avgDev > 1 ? "var(--danger)" : "var(--text-secondary)" },
            { label: t("search.bestPriceItems"), value: `${itemStats.filter(i => i.avgDeviation < 0).length} / ${itemStats.length}`, color: "var(--success)" },
            { label: t("search.activeMonths"), value: String(data.months.length), color: "var(--primary)" },
          ].map(kpi => (
            <div key={kpi.label} style={{ padding: "9px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border-light)" }}>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>{kpi.label}</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Activity sparkline */}
        {monthStats.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "5px" }}>{t("search.quoteActivity")}</div>
            <div style={{ display: "flex", gap: "3px", alignItems: "flex-end", height: "24px" }}>
              {[...monthStats].reverse().map((ms, i, arr) => {
                const isLatest = i === arr.length - 1;
                return (
                  <div key={ms.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }} title={`${ms.month}: ${ms.count}`}>
                    <div style={{ width: "100%", height: `${Math.max(4, (ms.count / maxCount) * 20)}px`, borderRadius: "2px 2px 0 0", background: isLatest ? "#3b82f6" : "var(--border-medium)" }} />
                    <span style={{ fontSize: "7px", color: isLatest ? "#3b82f6" : "var(--text-muted)", fontWeight: isLatest ? 800 : 400 }}>{formatMonthLabel(ms.month)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Items list */}
      <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Category filter */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("search.filter")}</span>
          {["all", ...categories].map(cat => (
            <button key={cat} type="button" onClick={() => setCatFilter(cat)} style={{ padding: "3px 10px", fontSize: "11px", fontWeight: 600, borderRadius: "20px", border: `1.5px solid ${catFilter === cat ? "var(--primary)" : "var(--border)"}`, background: catFilter === cat ? "var(--primary-light)" : "var(--bg-elevated)", color: catFilter === cat ? "var(--primary)" : "var(--text-secondary)", cursor: "pointer", transition: "all 150ms" }}>
              {cat === "all" ? t("search.all") : cat}
            </button>
          ))}
        </div>
        <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-secondary)" }}>{t("search.itemsQuoted")} ({filtered.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {filtered.map(item => {
            const devColor = item.avgDeviation < -1 ? "var(--success)" : item.avgDeviation > 1 ? "var(--danger)" : "var(--text-muted)";
            return (
              <div key={item.itemId} className="search-detail-row" style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "12px", alignItems: "center", padding: "9px 12px", borderRadius: "var(--radius)", background: "var(--bg-elevated)", border: "1px solid var(--border-light)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>{item.categoryName} · {item.unit} · {t("search.quotesShort").replace("{count}", String(item.quoteCount))}</div>
                </div>
                <div className="search-detail-prices-wrapper">
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{t("search.latest")}</div>
                    <div style={{ fontSize: "13px", fontWeight: 800 }}>{formatCurrency(item.latestPrice)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{t("search.avg")}</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary)" }}>{formatCurrency(item.avg)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{t("search.vsMkt")}</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: devColor }}>{item.avgDeviation > 0 ? "+" : ""}{item.avgDeviation.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Universal Search ─────────────────────────────────────────────────────
export default function UniversalSearch({ index, role }: { index: SearchIndex; role: string }) {
  const { t, locale } = useI18n();
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const deferredQuery = useDeferredValue(query);
  const [card, setCard]       = useState<CardState>(null);
  const [loading, startLoad]  = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openModal = () => { setOpen(true); setCard(null); setTimeout(() => inputRef.current?.focus(), 60); };
  const closeModal = () => { setOpen(false); setQuery(""); setCard(null); };

  const filteredItems     = deferredQuery.trim().length >= 1 ? index.items.filter(i => fuzzy(deferredQuery, i.name) || fuzzy(deferredQuery, i.category_name)) : [];
  const filteredSuppliers = (deferredQuery.trim().length >= 1 && role !== "SA") ? index.suppliers.filter(s => fuzzy(deferredQuery, s.name) || fuzzy(deferredQuery, s.fame_name || "")) : [];
  const hasResults = filteredItems.length > 0 || filteredSuppliers.length > 0;

  const categoriesList = useMemo(() => {
    return Array.from(new Set(index.items.map(i => i.category_name))).slice(0, 4);
  }, [index.items]);

  const openItemCard = useCallback((id: number) => {
    startLoad(async () => {
      const data = await fetchItemCard(id);
      if (data) setCard({ type: "item", data });
    });
  }, []);

  const openSupplierCard = useCallback((id: number) => {
    startLoad(async () => {
      const data = await fetchSupplierCard(id);
      if (data) setCard({ type: "supplier", data });
    });
  }, []);

  // ⌘K / Ctrl+K global shortcut & Details Card event listeners
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openModal(); }
      if (e.key === "Escape") { if (card) setCard(null); else { setOpen(false); setQuery(""); } }
    };
    window.addEventListener("keydown", onKey);

    const handleShowSupplier = (ev: Event) => {
      const customEvent = ev as CustomEvent<{ supplierId: number }>;
      const id = customEvent.detail.supplierId;
      if (id) {
        setOpen(true);
        openSupplierCard(id);
      }
    };

    const handleShowItem = (ev: Event) => {
      const customEvent = ev as CustomEvent<{ itemId: number }>;
      const id = customEvent.detail.itemId;
      if (id) {
        setOpen(true);
        openItemCard(id);
      }
    };

    window.addEventListener("show-supplier-details", handleShowSupplier);
    window.addEventListener("show-item-details", handleShowItem);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("show-supplier-details", handleShowSupplier);
      window.removeEventListener("show-item-details", handleShowItem);
    };
  }, [card, openItemCard, openSupplierCard]);

  return (
    <>
      {/* ── Sidebar trigger button ── */}
      <button
        type="button"
        onClick={openModal}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.12)",
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 150ms ease",
          textAlign: "left",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
        onMouseEnter={e => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = "rgba(255,255,255,0.18)";
          btn.style.borderColor = "rgba(96,165,250,0.6)";
          btn.style.boxShadow = "0 0 12px rgba(59, 130, 246, 0.4)";
        }}
        onMouseLeave={e => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = "rgba(255,255,255,0.12)";
          btn.style.borderColor = "rgba(255,255,255,0.25)";
          btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
        }}
      >
        <span style={{ fontSize: "13px" }}>🔍</span>
        <span style={{ flex: 1 }}>{t("sidebar.search")}</span>
        <span style={{
          fontSize: "9px",
          padding: "2px 5px",
          borderRadius: "4px",
          border: "1px solid rgba(255,255,255,0.3)",
          background: "rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.8)",
          fontFamily: "monospace",
          fontWeight: "bold"
        }}>⌘K</span>
      </button>

      {/* ── Full-screen modal ── */}
      {open && mounted && createPortal(
        <div
          className="universal-search-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(6,9,15,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 4000, padding: "60px 20px 20px", animation: "fadeIn 0.15s ease-out" }}
        >
          <div className="universal-search-content" style={{ width: "100%", maxWidth: card ? "860px" : "580px", transition: "max-width 300ms ease", display: "flex", flexDirection: "column", gap: "0", background: "var(--bg-surface)", border: "1px solid var(--border-medium)", borderRadius: "16px", boxShadow: "var(--shadow-xl)", maxHeight: "80vh", overflow: "hidden", animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)" }}>

            {/* Search input bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
              {card ? (
                <button type="button" onClick={() => setCard(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "0 4px", lineHeight: 1, flexShrink: 0, display: "flex", alignItems: "center" }}>←</button>
              ) : (
                <span style={{ fontSize: "16px", color: "var(--text-muted)", flexShrink: 0 }}>🔍</span>
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setCard(null); }}
                placeholder={t("search.placeholder")}
                autoComplete="off"
                style={{ flex: 1, border: "none", background: "transparent", color: "var(--text-primary)", fontSize: "15px", outline: "none", fontFamily: "inherit" }}
              />
              {loading && <span style={{ fontSize: "13px", color: "var(--text-muted)", animation: "spin 0.8s linear infinite", display: "inline-block" }}>⟳</span>}
              {query && !loading && <button type="button" onClick={() => { setQuery(""); setCard(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", padding: "0" }}>×</button>}
              <button type="button" onClick={closeModal} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: "11px", padding: "4px 8px", borderRadius: "6px", fontFamily: "monospace", flexShrink: 0 }}>ESC</button>
            </div>

            {/* Body — either results list or card detail */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {!card ? (
                /* ── Results list ── */
                <div>
                  {query.trim().length < 1 ? (
                    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px", color: "var(--text-muted)", fontSize: "13px" }}>
                      
                      {/* Categories section */}
                      {categoriesList.length > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>
                            📁 {t("search.browseCategories")}
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {categoriesList.map(cat => (
                              <button key={cat} type="button" onClick={() => { setQuery(cat); inputRef.current?.focus(); }}
                                style={{ padding: "5px 12px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer", transition: "all 150ms" }}>
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Suggested Items section */}
                      {index.items.length > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>
                            📦 {t("search.suggestedItems")}
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {index.items.slice(0, 3).map(item => (
                              <button key={item.id} type="button" onClick={() => openItemCard(item.id)}
                                style={{ padding: "5px 12px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer", transition: "all 150ms" }}>
                                {item.name.slice(0, 35)}…
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Suppliers section (SC & WH only) */}
                      {role !== "SA" && index.suppliers.length > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>
                            🏭 {t("search.suggestedSuppliers")}
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {index.suppliers.slice(0, 3).map(sup => (
                              <button key={sup.id} type="button" onClick={() => openSupplierCard(sup.id)}
                                style={{ padding: "5px 12px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer", transition: "all 150ms" }}>
                                {sup.fame_name || sup.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                    </div>
                  ) : !hasResults ? (
                    <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      <div style={{ fontSize: "28px", marginBottom: "10px" }}>😶</div>
                      {t("search.noResults")} "{query}"
                    </div>
                  ) : (
                    <div style={{ padding: "8px 0" }}>
                      {filteredItems.length > 0 && (
                        <>
                          <div style={{ padding: "8px 18px 4px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
                            {t("search.items")} ({filteredItems.length})
                          </div>
                          {filteredItems.slice(0, 8).map(item => (
                            <button key={item.id} type="button" onClick={() => openItemCard(item.id)}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", transition: "background 100ms" }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)"}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                            >
                              <span style={{ width: "34px", height: "34px", borderRadius: "9px", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>📦</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{item.category_name} · {item.unit}</div>
                              </div>
                              <span style={{ fontSize: "18px", color: "var(--text-muted)", flexShrink: 0 }}>›</span>
                            </button>
                          ))}
                        </>
                      )}
                      {filteredSuppliers.length > 0 && (
                        <>
                          <div style={{ padding: "8px 18px 4px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", borderTop: filteredItems.length > 0 ? "1px solid var(--border-light)" : "none", marginTop: filteredItems.length > 0 ? "4px" : "0" }}>
                            {t("search.suppliers")} ({filteredSuppliers.length})
                          </div>
                          {filteredSuppliers.slice(0, 5).map((sup, i) => (
                            <button key={sup.id} type="button" onClick={() => openSupplierCard(sup.id)}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", transition: "background 100ms" }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)"}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                            >
                              <span style={{ width: "34px", height: "34px", borderRadius: "9px", background: COLORS[i % COLORS.length] + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>🏭</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{sup.fame_name || sup.name}</div>
                                 <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{sup.quote_count} {locale === "ar" ? "عروض" : "quotes"}{sup.contact_person ? ` · ${sup.contact_person}` : ""}</div>
                              </div>
                              <span style={{ fontSize: "18px", color: "var(--text-muted)", flexShrink: 0 }}>›</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Detail card ── */
                <div style={{ animation: "fadeIn 0.18s ease-out" }}>
                  {card.type === "item"     && <ItemDetail     data={card.data} role={role} onClose={closeModal} />}
                  {card.type === "supplier" && <SupplierDetail data={card.data} role={role} onClose={closeModal} />}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, background: "var(--bg-elevated)", fontSize: "11px", color: "var(--text-muted)" }}>
              <span>{t("search.selectLabel")}</span>
              <span>ESC {card ? t("search.back") : t("search.close")}</span>
              <span style={{ marginInlineStart: "auto" }}>{filteredItems.length + filteredSuppliers.length > 0 ? t("search.resultsCount").replace("{count}", String(filteredItems.length + filteredSuppliers.length)) : ""}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
