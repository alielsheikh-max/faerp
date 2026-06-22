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
  MG: { badge: "#f59e0b", dot: "#d97706" },
};

export function AppShell({ role, children, searchIndex, pendingRequests = 0, ackCount = 0 }: { role: RoleCode; children: ReactNode; searchIndex?: SearchIndex; pendingRequests?: number; ackCount?: number }) {
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
  type NavLabelKey = "nav.overview"|"nav.priceCollection"|"nav.analytics"|"nav.salesView"|"nav.reports"|"nav.admin"|"nav.approvedPriceList"|"nav.approvals"|"nav.suppliers"|"nav.items"|"nav.notifications"|"nav.pricing"|"nav.categoryPricing"|"nav.itemPricing"|"nav.referenceData"|"nav.about"|"nav.activityLog";
  type NavItem = {
    href: string; labelKey: NavLabelKey; icon: string;
    exact?: boolean;
    iconOnly?: boolean;     // renders as compact icon button in top tray
    activePrefix?: string;  // overrides href for group-expansion check
    pendingKey?: "scApprovals" | "whApprovals" | "ackCount";
    children?: Array<{ href: string; labelKey: NavLabelKey; icon: string; exact?: boolean }>;
  };

  const NAV_BY_ROLE: Record<RoleCode, NavItem[]> = {
    WH: [
      { href: "/dashboard/notifications",          labelKey: "nav.notifications",   icon: "📨", pendingKey: "ackCount", iconOnly: true },
      { href: "/dashboard",                        labelKey: "nav.overview",        icon: "⊞",  exact: true },
      { href: "/dashboard/purchasing",             labelKey: "nav.priceCollection", icon: "📋", exact: true },
      { href: "/dashboard/purchasing/approvals",   labelKey: "nav.approvals",       icon: "🔔", pendingKey: "whApprovals" },
      { href: "/dashboard/notifications",          labelKey: "nav.notifications",   icon: "📨", pendingKey: "ackCount" },
      { href: "/dashboard/admin/suppliers",        labelKey: "nav.suppliers",       icon: "🏭" },
      { href: "/dashboard/admin/items",            labelKey: "nav.items",           icon: "📦" },
    ],
    SC: [
      // ── Icon-only quick-access tray (top of sidebar) ─────────────────
      { href: "/dashboard/approvals",     labelKey: "nav.approvals",     icon: "🔔", pendingKey: "scApprovals", iconOnly: true },
      { href: "/dashboard/notifications", labelKey: "nav.notifications", icon: "📨", pendingKey: "ackCount",    iconOnly: true },
      // ── Regular navigation ────────────────────────────────────────────
      { href: "/dashboard",                      labelKey: "nav.overview",  icon: "⊞", exact: true },
      { href: "/dashboard/manager/analytics",    labelKey: "nav.analytics", icon: "📈" },
      {
        href: "/dashboard/pricing",
        labelKey: "nav.pricing",
        icon: "🧮",
        children: [
          { href: "/dashboard/pricing",          labelKey: "nav.itemPricing",     icon: "📐", exact: true },
          { href: "/dashboard/pricing/category", labelKey: "nav.categoryPricing", icon: "📊" },
        ],
      },
      { href: "/dashboard/sales",   labelKey: "nav.salesView", icon: "💰" },
      { href: "/dashboard/reports", labelKey: "nav.reports",   icon: "📄" },
      // ── Reference data (grouped) ──────────────────────────────────────
      {
        href: "/dashboard/admin/suppliers",  // safe for SC (no AD-only page)
        activePrefix: "/dashboard/admin",    // expand when on any /admin/* page
        labelKey: "nav.referenceData",
        icon: "🗂️",
        children: [
          { href: "/dashboard/admin/suppliers", labelKey: "nav.suppliers", icon: "🏭" },
          { href: "/dashboard/admin/items",     labelKey: "nav.items",     icon: "📦" },
        ],
      },
    ],
    SA: [
      { href: "/dashboard",               labelKey: "nav.approvedPriceList", icon: "💰", exact: true },
      { href: "/dashboard/notifications", labelKey: "nav.notifications",     icon: "📨", pendingKey: "ackCount" },
    ],
    AD: [
      { href: "/dashboard/admin",           labelKey: "nav.admin",       icon: "⚙️", exact: true },
      { href: "/dashboard/admin/suppliers", labelKey: "nav.suppliers",   icon: "🏭", exact: true },
      { href: "/dashboard/admin/items",     labelKey: "nav.items",       icon: "📦", exact: true },
      { href: "/dashboard/admin/activity",  labelKey: "nav.activityLog", icon: "📜", exact: true },
      { href: "/dashboard/admin/about",     labelKey: "nav.about",       icon: "ℹ️", exact: true },
    ],
    MG: [
      { href: "/dashboard/notifications", labelKey: "nav.notifications", icon: "📨", pendingKey: "ackCount", iconOnly: true },
      { href: "/dashboard",               labelKey: "nav.overview",        icon: "⊞", pendingKey: "scApprovals", exact: true },
      { href: "/dashboard/notifications", labelKey: "nav.notifications",    icon: "📨", pendingKey: "ackCount" },
    ],
  };

  const navItems = NAV_BY_ROLE[role];
  const roleTitle = t(`role.${role}.title` as any) || ROLE_PROFILES[role].title;
  const roleDesc = t(`role.${role}.desc` as any) || ROLE_PROFILES[role].description;

  return (
    <div className="app-shell">

      {/* ── Floating alert pills — fixed top-right (RTL: top-left), always visible when pending ── */}
      {(pendingRequests > 0 || ackCount > 0) && (
        <div className="no-print" style={{
          position: "fixed", top: "14px", insetInlineEnd: "20px",
          display: "flex", gap: "8px", zIndex: 600,
          pointerEvents: "auto",
        }}>
          {pendingRequests > 0 && (role === "SC" || role === "WH" || role === "MG") && (
            <Link
              href={role === "WH" ? "/dashboard/purchasing/approvals" : role === "MG" ? "/dashboard" : "/dashboard/approvals"}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "8px 16px", borderRadius: "99px",
                background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
                color: "#fff", fontWeight: 800, fontSize: "12px",
                textDecoration: "none", boxShadow: "0 4px 18px rgba(245,158,11,0.55)",
                animation: "pulse-ring-danger 1.8s infinite",
                border: "1.5px solid rgba(255,255,255,0.25)",
                backdropFilter: "blur(4px)",
                transition: "transform 150ms, box-shadow 150ms",
                direction: "ltr",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(245,158,11,0.7)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 18px rgba(245,158,11,0.55)"; }}
            >
              <span style={{ fontSize: "14px" }}>🔔</span>
              <span>{pendingRequests} {t("shell.approvalsPending")}</span>
            </Link>
          )}
          {ackCount > 0 && (
            <Link
              href="/dashboard/notifications"
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "8px 16px", borderRadius: "99px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "#fff", fontWeight: 800, fontSize: "12px",
                textDecoration: "none", boxShadow: "0 4px 18px rgba(99,102,241,0.5)",
                animation: "pulse-ring-warning 1.8s infinite",
                border: "1.5px solid rgba(255,255,255,0.25)",
                transition: "transform 150ms, box-shadow 150ms",
                direction: "ltr",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(99,102,241,0.7)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 18px rgba(99,102,241,0.5)"; }}
            >
              <span style={{ fontSize: "14px" }}>📨</span>
              <span>{ackCount} {t("shell.newNotifications")}</span>
            </Link>
          )}
        </div>
      )}

      <aside className="sidebar">
        {/* Brand */}
        <div className="brand-block">
          <div className="brand-mark">
            <img src="/faerp logo.svg" style={{ width: "28px", height: "28px", objectFit: "contain" }} alt="Logo" />
          </div>
          <div>
            <h1>{t("app.name")}</h1>
            <p className="eyebrow">{t("app.tagline")}</p>
          </div>
        </div>

        {/* Role identity — compact, no description */}
        <div style={{
          padding: "10px 14px", margin: "12px 12px 8px",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "12px", display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#a7f3d0", boxShadow: "0 0 8px rgba(167,243,208,0.9)", animation: "pulse-ring 2.5s ease-out infinite", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "rgba(255,255,255,0.65)" }}>{role} · {t("role.activeSession")}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{roleTitle}</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="nav-section-label">{t("nav.navigation")}</div>

        {/* ── Icon-only tray (Approvals + Notifications for SC) ── */}
        {navItems.some(i => i.iconOnly) && (
          <div style={{ display: "flex", gap: "8px", padding: "0 12px", marginBottom: "10px" }}>
            {navItems.filter(i => i.iconOnly).map(item => {
              const count =
                item.pendingKey === "scApprovals" && (role === "SC" || role === "MG") ? pendingRequests :
                item.pendingKey === "whApprovals" && role === "WH" ? pendingRequests :
                item.pendingKey === "ackCount"    ? ackCount : 0;
              const isActive = pathname.startsWith(item.href);
              const badgeBg  = item.pendingKey === "scApprovals" || item.pendingKey === "whApprovals" ? "#ef4444" : "#6366f1";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={t(item.labelKey)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    height: "42px", borderRadius: "12px", position: "relative",
                    textDecoration: "none",
                    background: isActive
                      ? "rgba(255,255,255,0.22)"
                      : count > 0
                        ? "rgba(255,255,255,0.14)"
                        : "rgba(255,255,255,0.08)",
                    border: isActive
                      ? "1.5px solid rgba(255,255,255,0.4)"
                      : "1px solid rgba(255,255,255,0.15)",
                    boxShadow: count > 0 && !isActive ? `0 0 12px ${badgeBg}50` : "none",
                    transition: "background 150ms, border 150ms, box-shadow 150ms",
                  }}
                >
                  <span style={{ fontSize: "18px", lineHeight: 1 }}>{item.icon}</span>
                  {count > 0 && (
                    <span style={{
                      position: "absolute", top: "-5px", insetInlineEnd: "-5px",
                      minWidth: "18px", height: "18px", padding: "0 4px",
                      borderRadius: "99px", background: badgeBg,
                      color: "#fff", fontSize: "9px", fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "2px solid var(--sidebar-bg, #1e1b4b)",
                      animation: item.pendingKey === "scApprovals" || item.pendingKey === "whApprovals"
                        ? "pulse-ring-danger 1.8s infinite"
                        : "pulse-ring-warning 1.8s infinite",
                    }}>
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                  {isActive && (
                    <span style={{
                      position: "absolute", bottom: "5px",
                      width: "4px", height: "4px", borderRadius: "50%",
                      background: "var(--primary)", boxShadow: "0 0 6px rgba(99,102,241,0.9)",
                    }} />
                  )}
                </Link>
              );
            })}
          </div>
        )}

        <nav className="nav-stack">
          {navItems.filter(i => !i.iconOnly).map((item) => {
            // ── Grouped item (has sub-tabs) ────────────────────────────────
            if (item.children) {
              const isGroupActive = pathname.startsWith(item.activePrefix ?? item.href);
              return (
                <div key={item.href}>
                  {/* Parent link */}
                  <Link href={item.href} className={`nav-link ${isGroupActive ? "active" : ""}`}
                    style={{ justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                      <span>{t(item.labelKey)}</span>
                    </span>
                    <span style={{ fontSize: "10px", opacity: 0.7, marginInlineEnd: isGroupActive ? "6px" : "2px" }}>
                      {isGroupActive ? "▾" : "▸"}
                    </span>
                  </Link>
                  {/* Sub-items — visible when group is active */}
                  {isGroupActive && (
                    <div style={{
                      marginInlineStart: "18px",
                      marginTop: "2px",
                      marginBottom: "4px",
                      borderInlineStart: "2px solid rgba(255,255,255,0.18)",
                      paddingInlineStart: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}>
                      {item.children.map(child => {
                        const isChildActive = child.exact ? pathname === child.href : pathname.startsWith(child.href);
                        return (
                          <Link key={child.href} href={child.href}
                            className={`nav-link ${isChildActive ? "active" : ""}`}
                            style={{ fontSize: "12px", padding: "6px 10px", minHeight: "32px" }}>
                            <span style={{ fontSize: "13px", width: "18px", textAlign: "center", flexShrink: 0 }}>{child.icon}</span>
                            <span>{t(child.labelKey)}</span>
                            {isChildActive && (
                              <span style={{ marginInlineStart: "auto", width: "5px", height: "5px", borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 6px rgba(99,102,241,0.8)", flexShrink: 0 }} />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // ── Standard flat nav item ─────────────────────────────────────
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const badgeCount =
              item.pendingKey === "scApprovals" && (role === "SC" || role === "MG") ? pendingRequests :
              item.pendingKey === "whApprovals" && role === "WH" ? pendingRequests :
              item.pendingKey === "ackCount" ? ackCount :
              0;
            const showBadge = badgeCount > 0;
            return (
              <Link key={item.href} href={item.href} className={`nav-link ${isActive ? "active" : ""}`}>
                <span style={{ fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                <span>{t(item.labelKey)}</span>
                {showBadge && (
                  <span style={{
                    marginInlineStart: "auto", marginInlineEnd: isActive ? "6px" : "0",
                    fontSize: "9px", fontWeight: 900, lineHeight: 1,
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "#fff",
                    padding: "3px 7px", borderRadius: "99px", flexShrink: 0,
                    animation: "pulse-ring-danger 1.8s infinite",
                    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                  }}>
                    {badgeCount}
                  </span>
                )}
                {isActive && !showBadge && (
                  <span className="nav-active-dot" style={{ marginInlineStart: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 8px rgba(99,102,241,0.8)", flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "12px", flexShrink: 0 }}>

          {/* Universal Search */}
          {(role === "WH" || role === "SC" || role === "SA") && searchIndex && (
            <UniversalSearch index={searchIndex} role={role} />
          )}

          {/* System status */}
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="pulse-dot" />
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>{t("sidebar.systemOnline")}</span>
          </div>

          {/* Icon button row: lang · theme · sign out */}
          <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={toggleLocale}
              className="sidebar-icon-btn"
              style={{ flex: 1 }}
              data-tooltip={t("sidebar.langToggle")}
              aria-label={t("sidebar.langToggle")}
            >
              🌐
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="sidebar-icon-btn"
              style={{ flex: 1 }}
              data-tooltip={theme === "dark" ? t("sidebar.lightMode") : t("sidebar.darkMode")}
              aria-label={theme === "dark" ? t("sidebar.lightMode") : t("sidebar.darkMode")}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={async () => {
                try { await fetch("/api/auth/logout", { method: "POST" }); } catch (e) {}
                window.location.href = "/";
              }}
              className="sidebar-icon-btn"
              style={{ flex: 1 }}
              data-tooltip={t("sidebar.signOut")}
              aria-label={t("sidebar.signOut")}
            >
              🚪
            </button>
          </div>
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
