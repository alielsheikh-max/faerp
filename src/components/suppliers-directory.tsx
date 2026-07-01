"use client";

import { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n-context";
import SupplierDetailModal from "@/components/supplier-detail-modal";

import { createSupplierAction, updateSupplierAction, deleteSupplierAction } from "@/app/actions/admin";

export type FullSupplier = {
  id: number;
  name: string;
  fame_name?: string | null;
  code: string | null;
  contact_person: string | null;
  contact_job_title: string | null;
  phone: string | null;
  email: string | null;
  region: string | null;
  address: string | null;
  represented_products: string | null;
  quote_count: number;
  quoted_item_names?: string | null;
  category_ids?: number[];
  fav_item_ids?: number[];
};

type Category = {
  id: number;
  name: string;
  description?: string;
};

type Item = {
  id: number;
  name: string;
  category_id: number;
};

type Props = {
  suppliers: FullSupplier[];
  categories: Category[];
  items?: Item[];
  role?: string;
};

type QuoteFilter = "all" | "with_quotes" | "no_quotes";

export default function SuppliersDirectory({ suppliers, categories, items = [], role }: Props) {
  const { locale, t } = useI18n();

  // ── Search & Filter State ──
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<FullSupplier | null>(null);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<FullSupplier | null>(null);
  const [supplierFavSearch, setSupplierFavSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const isRTL = locale === "ar";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("addSupplier") === "true") {
      setShowAddSupplierModal(true);
    }
  }, []);

  // Derive unique regions from data
  const regions = useMemo(() => {
    const r = new Set(suppliers.map((s) => s.region).filter(Boolean) as string[]);
    return Array.from(r).sort();
  }, [suppliers]);

  // ── Filtered List ──
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return suppliers.filter((s) => {
      // Text search: name, code, contact, phone, email, address, products, quoted items
      const matchesText =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.contact_person ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.region ?? "").toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q) ||
        (s.represented_products ?? "").toLowerCase().includes(q) ||
        (s.quoted_item_names ?? "").toLowerCase().includes(q);

      // Region preset
      const matchesRegion = regionFilter === "all" || s.region === regionFilter;

      // Quote status preset
      const matchesQuote =
        quoteFilter === "all" ||
        (quoteFilter === "with_quotes" && s.quote_count > 0) ||
        (quoteFilter === "no_quotes" && s.quote_count === 0);

      return matchesText && matchesRegion && matchesQuote;
    });
  }, [suppliers, query, regionFilter, quoteFilter]);

  const lbl = (en: string, ar: string) => (locale === "ar" ? ar : en);

  return (
    <div>
      {/* ── Search Bar ──────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: "14px" }}>
        <span style={{
          position: "absolute", insetInlineStart: "14px", top: "50%", transform: "translateY(-50%)",
          fontSize: "16px", pointerEvents: "none", userSelect: "none",
        }}>
          🔍
        </span>
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lbl(
            "Search by name, code, contact, product, region…",
            "ابحث بالاسم، الكود، المنتج، المنطقة…"
          )}
          style={{ width: "100%", paddingInlineStart: "40px", paddingInlineEnd: "36px", boxSizing: "border-box" }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            style={{
              position: "absolute", insetInlineEnd: "10px", top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", fontSize: "16px",
              color: "var(--text-muted)", padding: "4px",
            }}
            title={lbl("Clear search", "مسح البحث")}
          >
            ×
          </button>
        )}
      </div>

      {/* ── Filter Bar ──────────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px", alignItems: "center" }}>

        {/* Quote-status pills */}
        <div style={{ display: "flex", gap: "6px" }}>
          {([
            { id: "all",         labelEn: "All Suppliers", labelAr: "جميع الموردين" },
            { id: "with_quotes", labelEn: "With Quotes",   labelAr: "لديهم عروض" },
            { id: "no_quotes",   labelEn: "No Quotes Yet", labelAr: "بدون عروض" },
          ] as { id: QuoteFilter; labelEn: string; labelAr: string }[]).map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setQuoteFilter(pill.id)}
              style={{
                padding: "6px 14px", fontSize: "12px", fontWeight: "600",
                borderRadius: "20px", border: "1px solid",
                borderColor: quoteFilter === pill.id ? "var(--primary)" : "var(--border-medium)",
                backgroundColor: quoteFilter === pill.id ? "var(--primary)" : "transparent",
                color: quoteFilter === pill.id ? "#fff" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 150ms",
              }}
            >
              {locale === "ar" ? pill.labelAr : pill.labelEn}
            </button>
          ))}
        </div>

        {/* Region dropdown */}
        {regions.length > 0 && (
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            style={{
              padding: "6px 12px", fontSize: "12px", borderRadius: "8px",
              border: "1px solid var(--border-medium)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            <option value="all">{lbl("All Regions", "كل المناطق")}</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}

        {role === "AD" && (
          <button
            type="button"
            onClick={() => setShowAddSupplierModal(true)}
            className="button button-primary"
            style={{ padding: "6px 14px", fontSize: "12px", fontWeight: "800", height: "30px", display: "inline-flex", alignItems: "center", gap: "6px", marginInlineStart: "auto" }}
          >
            ➕ {lbl("Onboard Supplier", "إضافة مورد جديد")}
          </button>
        )}

        {/* Result count */}
        <span style={{ marginInlineStart: role === "AD" ? "12px" : "auto", fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {filtered.length} {lbl("of", "من")} {suppliers.length} {lbl("suppliers", "مورد")}
        </span>
      </div>

      {/* ── Supplier Cards Grid ──────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{
          padding: "60px 24px", textAlign: "center", color: "var(--text-muted)",
          backgroundColor: "var(--bg-subtle)", borderRadius: "12px",
          border: "1px solid var(--border-light)",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
          <div style={{ fontWeight: "700", color: "var(--text-secondary)", fontSize: "15px" }}>
            {lbl("No suppliers match your search.", "لا يوجد موردون يطابقون بحثك.")}
          </div>
          <div style={{ fontSize: "12px", marginTop: "6px" }}>
            {lbl("Try adjusting your filters or search term.", "حاول تعديل الفلاتر أو مصطلح البحث.")}
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "14px",
        }}>
          {filtered.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              locale={locale}
              onClick={() => setSelectedSupplier(supplier)}
            />
          ))}
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────── */}
      {selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          role={role}
          onEdit={() => {
            setEditingSupplier(selectedSupplier);
            setSelectedSupplier(null);
          }}
        />
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="animate-scale-in" style={{ background: "var(--bg-elevated)", borderRadius: "20px", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-xl)", padding: "30px", width: "100%", maxWidth: "900px", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button type="button" onClick={() => { setShowAddSupplierModal(false); setSupplierFavSearch(""); }} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px", borderBottom: "2.5px solid var(--primary)", paddingBottom: "10px" }}>
              {isRTL ? "إضافة مورد جديد" : "Onboard New Supplier"}
            </h2>
            <form action={createSupplierAction} className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Left Column: Basic Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label className="field">
                  <span>{t("admin.commNameFull")} *</span>
                  <input name="name" type="text" placeholder={t("admin.commNameFull")} required style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{t("admin.fameNameShort")}</span>
                  <input name="fameName" type="text" placeholder={t("admin.fameNamePlaceholder")} style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{t("admin.contact")}</span>
                  <input name="contactPerson" type="text" placeholder={t("admin.contact")} style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{isRTL ? "المسمى الوظيفي لجهة الاتصال" : "Contact Person Job Title"}</span>
                  <input name="contactJobTitle" type="text" placeholder="e.g. Sales Director" style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{t("admin.phone")} *</span>
                  <input name="phone" type="text" placeholder="+20..." required style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{isRTL ? "البريد الإلكتروني" : "Email Address"}</span>
                  <input name="email" type="email" placeholder="example@supplier.com" style={{ background: "var(--bg-subtle)" }} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label className="field">
                    <span>{isRTL ? "كود المورد" : "Supplier Code"}</span>
                    <input name="code" type="text" placeholder="e.g. SUP-101" style={{ background: "var(--bg-subtle)" }} />
                  </label>
                  <label className="field">
                    <span>{isRTL ? "المنطقة / المحافظة" : "Region / Governorate"}</span>
                    <input name="region" type="text" placeholder="e.g. Giza" style={{ background: "var(--bg-subtle)" }} />
                  </label>
                </div>
                <label className="field">
                  <span>{isRTL ? "العنوان التفصيلي" : "Full Address"}</span>
                  <input name="address" type="text" placeholder="e.g. 12 Street..." style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{isRTL ? "المنتجات الممثلة" : "Represented Products"}</span>
                  <input name="representedProducts" type="text" placeholder="e.g. Pallets, Plastic bins..." style={{ background: "var(--bg-subtle)" }} />
                </label>
              </div>

              {/* Right Column: Categories & Favorite Products */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                    📁 {isRTL ? "تعيين الفئات المصرح بها" : "Assign Authorized Categories"}
                  </span>
                  <div style={{ border: "1.5px solid var(--border)", borderRadius: "10px", padding: "12px", maxHeight: "150px", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr", gap: "8px", background: "var(--bg-subtle)" }}>
                    {categories.map(c => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input type="checkbox" name="categoryIds" value={c.id} />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                    ⭐ {isRTL ? "تحديد كـ مورد مفضل للمنتجات" : "Set as Favorite Supplier for Products"}
                  </span>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: "100%", padding: "6px 10px", fontSize: "11px", marginBottom: "8px", background: "var(--bg-subtle)" }}
                    placeholder={isRTL ? "البحث عن صنف..." : "Search items..."}
                    value={supplierFavSearch}
                    onChange={e => setSupplierFavSearch(e.target.value)}
                  />
                  <div style={{ border: "1.5px solid var(--border)", borderRadius: "10px", padding: "12px", maxHeight: "180px", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr", gap: "8px", background: "var(--bg-subtle)" }}>
                    {items.filter(item => {
                      if (!supplierFavSearch) return true;
                      return item.name.toLowerCase().includes(supplierFavSearch.toLowerCase());
                    }).map(item => (
                      <label key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input type="checkbox" name="favProductIds" value={item.id} />
                        <span>{item.name} <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>({categories.find(c => c.id === item.category_id)?.name})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="button button-primary" style={{ flex: 1 }}>{t("admin.addSupplierBtn")}</button>
                <button type="button" onClick={() => { setShowAddSupplierModal(false); setSupplierFavSearch(""); }} className="button button-secondary">{t("admin.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="animate-scale-in" style={{ background: "var(--bg-elevated)", borderRadius: "20px", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-xl)", padding: "30px", width: "100%", maxWidth: "900px", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button type="button" onClick={() => { setEditingSupplier(null); setSupplierFavSearch(""); }} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px", borderBottom: "2.5px solid var(--primary)", paddingBottom: "10px" }}>
              {isRTL ? "تعديل تفاصيل المورد" : "Edit Supplier Details"}
            </h2>
            <form action={updateSupplierAction} className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <input type="hidden" name="id" value={editingSupplier.id} />
              
              {/* Left Column: Basic Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label className="field">
                  <span>{t("admin.commNameFull")} *</span>
                  <input name="name" type="text" defaultValue={editingSupplier.name} required style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{t("admin.fameNameShort")}</span>
                  <input name="fameName" type="text" defaultValue={editingSupplier.fame_name ?? ""} style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{t("admin.contact")}</span>
                  <input name="contactPerson" type="text" defaultValue={editingSupplier.contact_person ?? ""} style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{isRTL ? "المسمى الوظيفي لجهة الاتصال" : "Contact Person Job Title"}</span>
                  <input name="contactJobTitle" type="text" defaultValue={editingSupplier.contact_job_title ?? ""} style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{t("admin.phone")} *</span>
                  <input name="phone" type="text" defaultValue={editingSupplier.phone || ""} required style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{isRTL ? "البريد الإلكتروني" : "Email Address"}</span>
                  <input name="email" type="email" defaultValue={editingSupplier.email ?? ""} style={{ background: "var(--bg-subtle)" }} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label className="field">
                    <span>{isRTL ? "كود المورد" : "Supplier Code"}</span>
                    <input name="code" type="text" defaultValue={editingSupplier.code ?? ""} style={{ background: "var(--bg-subtle)" }} />
                  </label>
                  <label className="field">
                    <span>{isRTL ? "المنطقة / المحافظة" : "Region / Governorate"}</span>
                    <input name="region" type="text" defaultValue={editingSupplier.region ?? ""} style={{ background: "var(--bg-subtle)" }} />
                  </label>
                </div>
                <label className="field">
                  <span>{isRTL ? "العنوان التفصيلي" : "Full Address"}</span>
                  <input name="address" type="text" defaultValue={editingSupplier.address ?? ""} style={{ background: "var(--bg-subtle)" }} />
                </label>
                <label className="field">
                  <span>{isRTL ? "المنتجات الممثلة" : "Represented Products"}</span>
                  <input name="representedProducts" type="text" defaultValue={editingSupplier.represented_products ?? ""} style={{ background: "var(--bg-subtle)" }} />
                </label>
              </div>

              {/* Right Column: Categories & Favorite Products */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                    📁 {isRTL ? "تعيين الفئات المصرح بها" : "Assign Authorized Categories"}
                  </span>
                  <div style={{ border: "1.5px solid var(--border)", borderRadius: "10px", padding: "12px", maxHeight: "150px", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr", gap: "8px", background: "var(--bg-subtle)" }}>
                    {categories.map(c => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={(editingSupplier.category_ids || []).includes(c.id)} />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                    ⭐ {isRTL ? "تحديد كـ مورد مفضل للمنتجات" : "Set as Favorite Supplier for Products"}
                  </span>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: "100%", padding: "6px 10px", fontSize: "11px", marginBottom: "8px", background: "var(--bg-subtle)" }}
                    placeholder={isRTL ? "البحث عن صنف..." : "Search items..."}
                    value={supplierFavSearch}
                    onChange={e => setSupplierFavSearch(e.target.value)}
                  />
                  <div style={{ border: "1.5px solid var(--border)", borderRadius: "10px", padding: "12px", maxHeight: "180px", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr", gap: "8px", background: "var(--bg-subtle)" }}>
                    {items.filter(item => {
                      if (!supplierFavSearch) return true;
                      return item.name.toLowerCase().includes(supplierFavSearch.toLowerCase());
                    }).map(item => (
                      <label key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input type="checkbox" name="favProductIds" value={item.id} defaultChecked={(editingSupplier.fav_item_ids || []).includes(item.id)} />
                        <span>{item.name} <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>({categories.find(c => c.id === item.category_id)?.name})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="button button-primary" style={{ flex: 1 }}>{t("admin.save")}</button>
                <button type="button" onClick={() => { setEditingSupplier(null); setSupplierFavSearch(""); }} className="button button-secondary">{t("admin.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Individual Supplier Card
// ─────────────────────────────────────────────────────
function SupplierCard({
  supplier,
  locale,
  onClick,
}: {
  supplier: FullSupplier;
  locale: string;
  onClick: () => void;
}) {
  const hasQuotes = supplier.quote_count > 0;

  return (
    <button
      type="button"
      className="supplier-card-button"
      onClick={onClick}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-light)",
        borderRadius: "14px",
        padding: "18px",
        cursor: "pointer",
        textAlign: locale === "ar" ? "right" : "left",
        transition: "all 200ms cubic-bezier(0.4,0,0.2,1)",
        display: "flex",
        flexDirection: "column",
        gap: "0",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
        el.style.borderColor = "var(--primary)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
        el.style.borderColor = "var(--border-light)";
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "3px",
        background: hasQuotes
          ? "linear-gradient(90deg, #1d4ed8, #3b82f6)"
          : "var(--border-medium)",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginTop: "6px" }}>
        {/* Avatar */}
        <div style={{
          width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
          background: hasQuotes ? "linear-gradient(135deg, #dbeafe, #bfdbfe)" : "var(--bg-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px",
          border: "1px solid var(--border-light)",
        }}>
          🏭
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Supplier name — this is the clickable headline */}
          <div style={{
            fontSize: "14px", fontWeight: "800",
            color: "var(--primary)",
            lineHeight: "1.3",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {supplier.fame_name || supplier.name}
          </div>
          {supplier.fame_name && supplier.fame_name !== supplier.name && (
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {supplier.name}
            </div>
          )}

          {/* Code + Region badges */}
          <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
            {supplier.code && (
              <span style={{
                fontSize: "10px", fontWeight: "700", padding: "1px 8px",
                borderRadius: "20px",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-medium)",
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
              }}>
                {supplier.code}
              </span>
            )}
            {supplier.region && (
              <span style={{
                fontSize: "10px", color: "var(--text-muted)",
                display: "flex", alignItems: "center", gap: "3px",
              }}>
                📍 {supplier.region}
              </span>
            )}
          </div>
        </div>

        {/* Quote badge */}
        <span style={{
          padding: "3px 10px", borderRadius: "20px",
          fontSize: "11px", fontWeight: "700", flexShrink: 0,
          backgroundColor: hasQuotes ? "rgba(29,78,216,0.1)" : "var(--bg-subtle)",
          color: hasQuotes ? "var(--primary)" : "var(--text-muted)",
          border: `1px solid ${hasQuotes ? "rgba(29,78,216,0.2)" : "var(--border-light)"}`,
        }}>
          {supplier.quote_count}
          {" "}
          {locale === "ar" ? "عرض" : "quotes"}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "var(--border-light)", margin: "14px 0" }} />

      {/* Info rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {supplier.contact_person && (
          <InfoRow icon="👤" text={supplier.contact_person} sub={supplier.contact_job_title} />
        )}
        {supplier.phone && (
          <InfoRow icon="📞" text={supplier.phone} />
        )}
        {supplier.email && (
          <InfoRow icon="✉️" text={supplier.email} truncate />
        )}
        {supplier.represented_products && (
          <InfoRow icon="🏷️" text={supplier.represented_products} truncate />
        )}
      </div>

      {/* Footer hint */}
      <div style={{
        marginTop: "14px", paddingTop: "10px",
        borderTop: "1px solid var(--border-light)",
        display: "flex", alignItems: "center", gap: "6px",
        color: "var(--primary)", fontSize: "11px", fontWeight: "700",
      }}>
        <span>👁️</span>
        {locale === "ar" ? "انقر لعرض التفاصيل والتاريخ التجاري" : "Click to view full profile & history"}
      </div>
    </button>
  );
}

function InfoRow({ icon, text, sub, truncate }: { icon: string; text: string; sub?: string | null; truncate?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <span style={{ fontSize: "13px", flexShrink: 0, lineHeight: "1.5" }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: "12px", color: "var(--text-primary)", fontWeight: "600",
          lineHeight: "1.4",
          ...(truncate ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : {}),
        }}>
          {text}
        </div>
        {sub && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{sub}</div>
        )}
      </div>
    </div>
  );
}
