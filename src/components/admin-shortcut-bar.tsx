"use client";

import Link from "next/link";

export default function AdminShortcutBar() {
  const goToSection = (section: string) => {
    window.dispatchEvent(new CustomEvent("expand-admin-section", { detail: section }));
    setTimeout(() => {
      document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  return (
    <div className="mobile-tabs-scroll" style={{
      display: "flex", gap: "8px", flexWrap: "wrap",
      background: "var(--bg-surface)", padding: "12px 16px",
      borderRadius: "var(--radius)", border: "1px solid var(--border-light)",
      marginBottom: "20px", position: "sticky", top: "10px", zIndex: 1000,
      boxShadow: "var(--shadow-md)", backdropFilter: "blur(12px)",
      alignItems: "center"
    }}>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginRight: "4px" }}>
        ⚡ Quick Nav:
      </span>

      {/* ── On-page section scrollers ───────────────────── */}
      <button
        type="button"
        className="button button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px" }}
        onClick={() => goToSection("users")}
      >
        👤 Users
      </button>
      <button
        type="button"
        className="button button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px" }}
        onClick={() => goToSection("csv-import")}
      >
        📤 CSV Import
      </button>
      <button
        type="button"
        className="button button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px" }}
        onClick={() => goToSection("floors")}
      >
        📈 Margin Floors
      </button>
      <button
        type="button"
        className="button button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px" }}
        onClick={() => goToSection("tiers")}
      >
        📊 Volume Tiers
      </button>

      {/* ── Divider ──────────────────────────────────────── */}
      <span style={{
        width: "1px", height: "22px", background: "var(--border-medium)",
        margin: "0 4px", flexShrink: 0, alignSelf: "center"
      }} />

      {/* ── Dedicated-page navigations ───────────────────── */}
      <Link
        href="/dashboard/admin/suppliers"
        className="button button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
      >
        🏭 Suppliers <span style={{ fontSize: "9px", opacity: 0.65 }}>↗</span>
      </Link>
      <Link
        href="/dashboard/admin/items"
        className="button button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
      >
        📦 Items &amp; Categories <span style={{ fontSize: "9px", opacity: 0.65 }}>↗</span>
      </Link>

      {/* ── Divider ──────────────────────────────────────── */}
      <span style={{
        width: "1px", height: "22px", background: "var(--border-medium)",
        margin: "0 4px", flexShrink: 0, alignSelf: "center"
      }} />

      {/* ── Danger zone ──────────────────────────────────── */}
      <button
        type="button"
        className="button button-danger"
        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
        onClick={() => goToSection("purge")}
      >
        ☢️ Purge DB
      </button>
    </div>
  );
}
