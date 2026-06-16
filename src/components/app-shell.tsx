"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect } from "react";
import { ROLE_PROFILES, RoleCode } from "@/lib/constants";
import UniversalSearch from "@/components/universal-search";
import { useI18n } from "@/lib/i18n-context";

type SearchIndex = {
  items: Array<{ id: number; name: string; unit: string; active: number; category_name: string; category_id: number }>;
  suppliers: Array<{ id: number; name: string; contact_person: string; phone: string; quote_count: number }>;
};

const ROLE_COLORS: Record<RoleCode, { badge: string; dot: string }> = {
  SC: { badge: "#818cf8", dot: "#6366f1" },
  WH: { badge: "#34d399", dot: "#10b981" },
  SA: { badge: "#fbbf24", dot: "#f59e0b" },
  AD: { badge: "#ec4899", dot: "#db2777" },
};

export function AppShell({ role, children, searchIndex, pendingRequests = 0 }: { role: RoleCode; children: ReactNode; searchIndex?: SearchIndex; pendingRequests?: number }) {
  const { t, toggleLocale, isRTL, locale } = useI18n();
  const pathname = usePathname();
  const colors = ROLE_COLORS[role];

  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light";
    if (saved) setTheme(saved);
    else setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Nav items defined here so they pick up translations
  const NAV_BY_ROLE: Record<RoleCode, Array<{ href: string; labelKey: "nav.overview"|"nav.priceCollection"|"nav.analytics"|"nav.salesView"|"nav.reports"|"nav.admin"|"nav.approvedPriceList"|"nav.approvals"|"nav.suppliers"|"nav.items"; icon: string; exact?: boolean; pendingKey?: "scApprovals" | "whApprovals" }>> = {
    WH: [
      { href: "/dashboard",                        labelKey: "nav.overview",        icon: "⊞",  exact: true },
      { href: "/dashboard/purchasing",             labelKey: "nav.priceCollection", icon: "📋", exact: true },
      { href: "/dashboard/purchasing/approvals",   labelKey: "nav.approvals",       icon: "🔔", pendingKey: "whApprovals" },
      { href: "/dashboard/admin/suppliers",        labelKey: "nav.suppliers",       icon: "🏭" },
      { href: "/dashboard/admin/items",            labelKey: "nav.items",           icon: "📦" },
    ],
    SC: [
      { href: "/dashboard",                   labelKey: "nav.overview",    icon: "⊞",  exact: true },
      { href: "/dashboard/manager/analytics", labelKey: "nav.analytics",   icon: "📈" },
      { href: "/dashboard/sales",             labelKey: "nav.salesView",   icon: "💰" },
      { href: "/dashboard/reports",           labelKey: "nav.reports",     icon: "📄" },
      { href: "/dashboard/approvals",         labelKey: "nav.approvals",   icon: "🔔", pendingKey: "scApprovals" },
      { href: "/dashboard/admin/suppliers",   labelKey: "nav.suppliers",   icon: "🏭" },
      { href: "/dashboard/admin/items",       labelKey: "nav.items",       icon: "📦" },
    ],
    SA: [
      { href: "/dashboard", labelKey: "nav.approvedPriceList", icon: "💰", exact: true },
    ],
    AD: [
      { href: "/dashboard/admin",           labelKey: "nav.admin",     icon: "⚙️", exact: true },
      { href: "/dashboard/admin/suppliers", labelKey: "nav.suppliers", icon: "🏭", exact: true },
      { href: "/dashboard/admin/items",     labelKey: "nav.items",     icon: "📦", exact: true },
    ],
  };

  const navItems = NAV_BY_ROLE[role];
  const roleTitle = t(`role.${role}.title` as any) || ROLE_PROFILES[role].title;
  const roleDesc = t(`role.${role}.desc` as any) || ROLE_PROFILES[role].description;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Brand */}
        <div className="brand-block">
          <div className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="8" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.9)"/>
              <rect x="12" y="8" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.55)"/>
              <rect x="7" y="3" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.75)"/>
              <rect x="4" y="17" width="14" height="2.5" rx="1.25" fill="rgba(255,255,255,0.4)"/>
            </svg>
          </div>
          <div>
            <p className="eyebrow">{t("app.tagline")}</p>
            <h1>{t("app.name")}</h1>
          </div>
        </div>

        {/* Role identity */}
        <div style={{
          padding: "14px 16px", margin: "16px 12px 12px",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "14px", display: "flex", flexDirection: "column" as const, gap: "6px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#a7f3d0", boxShadow: "0 0 8px rgba(167,243,208,0.9)", animation: "pulse-ring 2.5s ease-out infinite" }} />
            <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: "rgba(255,255,255,0.8)" }}>
              {role} · {t("role.activeSession")}
            </span>
          </div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>{roleTitle}</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{roleDesc}</div>
        </div>

        {/* Navigation */}
        <div className="nav-section-label">{t("nav.navigation")}</div>
        <nav className="nav-stack">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const badgeCount =
              item.pendingKey === "scApprovals" && role === "SC" ? pendingRequests :
              item.pendingKey === "whApprovals" && role === "WH" ? pendingRequests :
              item.labelKey === "nav.admin" && role === "SC" ? 0 : 0;
            const showBadge = badgeCount > 0;
            return (
              <Link key={item.href} href={item.href} className={`nav-link ${isActive ? "active" : ""}`}>
                <span style={{ fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                <span>{t(item.labelKey)}</span>
                {showBadge && (
                  <span style={{
                    marginInlineStart: "auto", marginInlineEnd: isActive ? "6px" : "0",
                    fontSize: "9px", fontWeight: 900, lineHeight: 1,
                    background: "var(--warning)", color: "#fff",
                    padding: "2px 6px", borderRadius: "99px", flexShrink: 0,
                    animation: "pulse-ring 2s ease-out infinite",
                  }}>
                    {badgeCount}
                  </span>
                )}
                {isActive && (
                  <span className="nav-active-dot" style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 8px rgba(99,102,241,0.8)", flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "12px", flexShrink: 0 }}>

          {/* Universal Search */}
          {(role === "WH" || role === "SC") && searchIndex && (
            <UniversalSearch index={searchIndex} role={role} />
          )}

          {/* System status */}
          <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="pulse-dot" />
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>{t("sidebar.systemOnline")}</span>
          </div>

          {/* Language toggle */}
          <button
            type="button"
            onClick={toggleLocale}
            className="button button-secondary button-block"
            style={{ fontSize: "13px", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", fontWeight: 700, background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.22)", color: "#ffffff" }}
          >
            <span>🌐</span>
            {t("sidebar.langToggle")}
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="button button-secondary button-block"
            style={{ fontSize: "13px", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.22)", color: "#ffffff" }}
          >
            {theme === "dark" ? `☀️ ${t("sidebar.lightMode")}` : `🌙 ${t("sidebar.darkMode")}`}
          </button>

          {/* Sign out */}
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" });
              } catch (e) {}
              window.location.href = "/";
            }}
            className="button button-secondary button-block"
            style={{ fontSize: "13px", padding: "10px", background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.22)", color: "#ffffff", cursor: "pointer" }}
          >
            {t("sidebar.signOut")}
          </button>
        </div>
      </aside>

      <main className="content-area">{children}</main>
    </div>
  );
}

export function SectionIntro({ eyebrow, title, description, actions }: {
  eyebrow: string; title: string; description: string; actions?: ReactNode;
}) {
  return (
    <div className="section-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="section-copy">{description}</p>
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, note, accent, children }: {
  label: string; value: string | number; note: string;
  accent?: "indigo" | "green" | "amber" | "red" | "cyan"; children?: ReactNode;
}) {
  const accentColors: Record<string, string> = {
    indigo: "#818cf8", green: "#34d399", amber: "#fbbf24", red: "#f87171", cyan: "#22d3ee",
  };
  const color = accent ? accentColors[accent] : "#818cf8";
  return (
    <article className="stat-card" style={accent ? { borderTopColor: color, borderTopWidth: "2px" } : {}}>
      <p>{label}</p>
      <strong style={accent ? { color } : {}}>{value}</strong>
      <span>{note}</span>
      {children}
    </article>
  );
}
