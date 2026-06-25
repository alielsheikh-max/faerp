"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect } from "react";
import { ROLE_PROFILES, RoleCode } from "@/lib/constants";
import UniversalSearch from "@/components/universal-search";
import { useI18n } from "@/lib/i18n-context";
import { getUnreadNotificationsAction, markSingleNotificationReadAction } from "@/app/actions/notifications";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light";
    if (saved) setTheme(saved);
    else setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Quick notifications states and handlers
  const [showQuickNotifications, setShowQuickNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [localAckCount, setLocalAckCount] = useState(ackCount);

  useEffect(() => {
    setLocalAckCount(ackCount);
  }, [ackCount]);

  useEffect(() => {
    if (!showQuickNotifications) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".quick-notifications-container")) {
        setShowQuickNotifications(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [showQuickNotifications]);

  const handleToggleQuickNotifications = async () => {
    if (!showQuickNotifications) {
      setLoadingNotifications(true);
      setShowQuickNotifications(true);
      try {
        const res = await getUnreadNotificationsAction();
        if (res.ok && res.notifications) {
          setUnreadNotifications(res.notifications);
          setLocalAckCount(res.notifications.length);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingNotifications(false);
      }
    } else {
      setShowQuickNotifications(false);
    }
  };

  const handleMarkAsRead = async (id: number, type: "acknowledgment" | "rejection", e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setUnreadNotifications(prev => prev.filter(n => !(n.id === id && n.type === type)));
    setLocalAckCount(prev => Math.max(0, prev - 1));

    try {
      const res = await markSingleNotificationReadAction(id, type);
      if (!res.ok) {
        // failed
      }
    } catch (err) {
      console.error(err);
    }
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
      { href: "/dashboard/notifications", labelKey: "nav.notifications",     icon: "📨", pendingKey: "ackCount", iconOnly: true },
    ],
    AD: [
      { href: "/dashboard/admin",           labelKey: "nav.admin",       icon: "⚙️", exact: true },
      { href: "/dashboard/admin/suppliers", labelKey: "nav.suppliers",   icon: "🏭", exact: true },
      { href: "/dashboard/admin/items",     labelKey: "nav.items",       icon: "📦", exact: true },
      { href: "/dashboard/admin/activity",  labelKey: "nav.activityLog", icon: "📜", exact: true },
      { href: "/dashboard/admin/about",     labelKey: "nav.about",       icon: "ℹ️", exact: true },
    ],
    MG: [
      { href: "/dashboard/notifications", labelKey: "nav.notifications", icon: "🔔", pendingKey: "scApprovals", iconOnly: true },
      { href: "/dashboard",               labelKey: "nav.overview",        icon: "⊞", exact: true },
    ],
  };

  const navItems = NAV_BY_ROLE[role];
  const roleTitle = t(`role.${role}.title` as any) || ROLE_PROFILES[role].title;
  const roleDesc = t(`role.${role}.desc` as any) || ROLE_PROFILES[role].description;

  return (
    <div className="app-shell">

      {/* ── Floating alert chips — compact, non-overlapping ── */}
      {/* ── Floating alert chips — compact, non-overlapping ── */}
      {(pendingRequests > 0 || localAckCount > 0) && (
        <div className="no-print" style={{
          position: "fixed", bottom: "16px", insetInlineEnd: "20px",
          display: "flex", flexDirection: "column", gap: "6px", zIndex: 600,
          pointerEvents: "auto", alignItems: "flex-end",
        }}>
          {pendingRequests > 0 && (role === "SC" || role === "WH" || role === "MG") && (
            role === "MG" ? (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("filter-pending-approvals"));
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", borderRadius: "10px",
                  background: "var(--bg-elevated)",
                  color: "#b45309", fontWeight: 700, fontSize: "11.5px",
                  textDecoration: "none",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(245,158,11,0.25)",
                  border: "1.5px solid rgba(245,158,11,0.35)",
                  backdropFilter: "blur(8px)",
                  transition: "transform 150ms, box-shadow 150ms",
                  direction: "ltr",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.18), 0 0 0 1px rgba(245,158,11,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(245,158,11,0.25)"; }}
              >
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "20px", height: "20px", borderRadius: "6px",
                  background: "rgba(245,158,11,0.15)", fontSize: "11px",
                }}>⏳</span>
                <span><strong>{pendingRequests}</strong> {t("shell.approvalsPending")}</span>
              </button>
            ) : (
              <Link
                href={role === "WH" ? "/dashboard/purchasing/approvals" : "/dashboard/approvals"}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", borderRadius: "10px",
                  background: "var(--bg-elevated)",
                  color: "#b45309", fontWeight: 700, fontSize: "11.5px",
                  textDecoration: "none",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(245,158,11,0.25)",
                  border: "1.5px solid rgba(245,158,11,0.35)",
                  backdropFilter: "blur(8px)",
                  transition: "transform 150ms, box-shadow 150ms",
                  direction: "ltr",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.18), 0 0 0 1px rgba(245,158,11,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(245,158,11,0.25)"; }}
              >
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "20px", height: "20px", borderRadius: "6px",
                  background: "rgba(245,158,11,0.15)", fontSize: "11px",
                }}>⏳</span>
                <span><strong>{pendingRequests}</strong> {t("shell.approvalsPending")}</span>
              </Link>
            )
          )}
          {localAckCount > 0 && (
            <div className="quick-notifications-container" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", position: "relative" }}>
              {showQuickNotifications && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  insetInlineEnd: "0",
                  width: "350px",
                  maxHeight: "450px",
                  background: "var(--bg-glass)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-xl)",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 1000,
                  overflow: "hidden",
                  animation: "slideUpFade 0.25s var(--ease-spring)",
                }} onClick={e => e.stopPropagation()}>
                  
                  {/* Header */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: "rgba(99, 102, 241, 0.08)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "16px" }}>📨</span>
                      <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>{t("notif.quickView")}</strong>
                      <span style={{
                        background: "#6366f1",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "99px",
                      }}>{localAckCount}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickNotifications(false)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        fontSize: "14px",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        transition: "background 150ms",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Body/List */}
                  <div style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "8px 0",
                    minHeight: "120px",
                    maxHeight: "320px",
                  }}>
                    {loadingNotifications ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", gap: "8px" }}>
                        <span style={{
                          width: "18px",
                          height: "18px",
                          border: "2px solid rgba(99,102,241,0.2)",
                          borderTopColor: "#6366f1",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                        }} />
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Loading...</span>
                      </div>
                    ) : unreadNotifications.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                        {t("notif.noNotifications")}
                      </div>
                    ) : (
                      unreadNotifications.map(n => {
                        let formattedTime = "";
                        try {
                          formattedTime = new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch (err) {
                          formattedTime = String(n.time);
                        }
                        return (
                          <div key={`${n.type}-${n.id}`} style={{
                            display: "flex",
                            gap: "10px",
                            padding: "10px 16px",
                            borderBottom: "1px solid var(--border-light)",
                            position: "relative",
                          }} className="quick-notif-item">
                            <div style={{ flex: 1, minWidth: 0, textAlign: isRTL ? "right" : "left" }}>
                              <div style={{
                                fontWeight: 600,
                                fontSize: "12px",
                                color: "var(--text-primary)",
                                marginBottom: "2px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexDirection: isRTL ? "row-reverse" : "row",
                              }}>
                                <span>{n.title}</span>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 400 }}>
                                  {formattedTime}
                                </span>
                              </div>
                              <p style={{
                                margin: 0,
                                fontSize: "11px",
                                color: "var(--text-secondary)",
                                lineHeight: "1.4",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}>{n.message}</p>
                              
                              {/* Action Link to the Item */}
                              {n.itemId && (
                                <Link
                                  href={`/dashboard/pricing?searchId=${n.itemId}`}
                                  onClick={() => setShowQuickNotifications(false)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    marginTop: "6px",
                                    fontSize: "11px",
                                    color: "#6366f1",
                                    textDecoration: "none",
                                    fontWeight: 600,
                                    gap: "3px",
                                  }}
                                >
                                  {t("notif.priceHistory")} ➔
                                </Link>
                              )}
                            </div>
                            
                            {/* Check Button to Mark Read */}
                            <button
                              type="button"
                              title={t("notif.markAsRead")}
                              onClick={(e) => handleMarkAsRead(n.id, n.type, e)}
                              style={{
                                alignSelf: "center",
                                background: "rgba(99,102,241,0.06)",
                                border: "1px solid rgba(99,102,241,0.15)",
                                borderRadius: "6px",
                                width: "26px",
                                height: "26px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: "#6366f1",
                                transition: "all 150ms",
                                flexShrink: 0,
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = "#6366f1";
                                e.currentTarget.style.color = "#fff";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = "rgba(99,102,241,0.06)";
                                e.currentTarget.style.color = "#6366f1";
                              }}
                            >
                              ✓
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    textAlign: "center",
                  }}>
                    <Link
                      href="/dashboard/notifications"
                      onClick={() => setShowQuickNotifications(false)}
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#4f46e5",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {t("notif.viewAll")} ➔
                    </Link>
                  </div>
                </div>
              )}

              {/* The Floating Notifications Button itself */}
              <button
                type="button"
                onClick={handleToggleQuickNotifications}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", borderRadius: "10px",
                  background: "var(--bg-elevated)",
                  color: "#4f46e5", fontWeight: 700, fontSize: "11.5px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(99,102,241,0.2)",
                  border: "1.5px solid rgba(99,102,241,0.3)",
                  backdropFilter: "blur(8px)",
                  transition: "transform 150ms, box-shadow 150ms",
                  direction: "ltr",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.18), 0 0 0 1px rgba(99,102,241,0.35)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(99,102,241,0.2)"; }}
              >
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "20px", height: "20px", borderRadius: "6px",
                  background: "rgba(99,102,241,0.12)", fontSize: "11px",
                }}>📨</span>
                <span><strong>{localAckCount}</strong> {t("shell.newNotifications")}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/faerp logo.svg" style={{ width: "28px", height: "28px", objectFit: "contain" }} alt="Logo" />
          <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.02em" }}>{t("app.name")}</span>
        </div>
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? "\u2715" : "\u2630"}
        </button>
      </div>

      {/* Mobile sidebar backdrop */}
      <div
        className={`sidebar-backdrop ${mobileMenuOpen ? "visible" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
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
              const iconOnlyCount = navItems.filter(i => i.iconOnly).length;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={t(item.labelKey)}
                  style={{
                    ...(iconOnlyCount > 1 ? { flex: 1 } : { width: "44px", flexShrink: 0 }),
                    display: "flex", alignItems: "center", justifyContent: "center",
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
                    onClick={() => setMobileMenuOpen(false)}
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
                            onClick={() => setMobileMenuOpen(false)}
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
              <Link key={item.href} href={item.href} className={`nav-link ${isActive ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)}>
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
              onClick={() => { toggleLocale(); setMobileMenuOpen(false); }}
              className="sidebar-icon-btn"
              style={{ flex: 1 }}
              data-tooltip={t("sidebar.langToggle")}
              aria-label={t("sidebar.langToggle")}
            >
              🌐
            </button>
            <button
              type="button"
              onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}
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
