"use client";

import { useState, Fragment } from "react";
import { loginAs } from "@/app/actions/auth";
import { QUICK_LOGIN_CREDENTIALS, ROLE_PROFILES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n-context";

const loginCards = Object.values(ROLE_PROFILES);

export default function LoginPageClient({ error }: { error?: string }) {
  const { t, toggleLocale, locale } = useI18n();
  const [signingIn, setSigningIn] = useState(false);
  const [signingInRole, setSigningInRole] = useState<string | null>(null);

  const handleManualSubmit = () => {
    setSigningIn(true);
    setSigningInRole("user");
  };

  const handleQuickLogin = (code: string) => {
    setSigningIn(true);
    setSigningInRole(code);
  };

  return (
    <main className="login-page">

      {/* ── Sign-in transition overlay ────────────────────────────────────── */}
      {signingIn && (
        <div className="signin-overlay">
          <div className="signin-overlay-inner">
            <div className="signin-spinner" />
            <div className="signin-overlay-text">
              <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}>
                Signing in{signingInRole && signingInRole !== "user" ? ` as ${signingInRole}` : ""}…
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Language toggle — top right corner */}
      <button
        type="button"
        onClick={toggleLocale}
        style={{
          position: "fixed", top: "18px", right: "18px",
          zIndex: 100, padding: "7px 14px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "20px", color: "rgba(255,255,255,0.7)",
          fontSize: "12px", fontWeight: 700, cursor: "pointer",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: "6px",
          transition: "all 150ms",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        🌐 {t("sidebar.langToggle")}
      </button>

      <section className="login-hero">
        {/* Left Brand */}
        <div className="hero-copy">
          <div className="hero-brand">
            <div className="hero-brand-logo">
              <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="8" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.95)"/>
                <rect x="12" y="8" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.6)"/>
                <rect x="7" y="3" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.8)"/>
                <rect x="4" y="17" width="14" height="2.5" rx="1.25" fill="rgba(255,255,255,0.45)"/>
              </svg>
            </div>
            <span className="hero-brand-name">FAERP</span>
          </div>

          <div className="hero-main-content">
            <h1>
              {t("login.heroTitle").split("&").map((part, i) =>
                i === 0 ? part : <Fragment key={i}><span>&</span>{part}</Fragment>
              )}
            </h1>
            <p>{t("login.heroDesc")}</p>
            <div className="hero-feature-list">
              <div className="hero-feature-item">{t("login.feature1")}</div>
              <div className="hero-feature-item">{t("login.feature2")}</div>
              <div className="hero-feature-item">{t("login.feature3")}</div>
              <div className="hero-feature-item">{t("login.feature4")}</div>
            </div>
          </div>

          <div className="hero-footer">{t("login.copyright")}</div>
        </div>

        {/* Right: Auth form */}
        <div className="glass-panel">
          <div className="panel-header" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div>
              <p className="eyebrow">{t("login.securePortal")}</p>
              <h2>{t("login.signIn")}</h2>
            </div>
            <span className="badge badge-success">{t("login.online")}</span>
          </div>

          <form action={loginAs} className="manual-login-form" onSubmit={handleManualSubmit}>
            <label className="field">
              <span>{t("login.username")}</span>
              <input type="text" name="username" placeholder={t("login.usernamePlaceholder")} required />
            </label>
            <label className="field">
              <span>{t("login.password")}</span>
              <input type="password" name="password" placeholder={t("login.passwordPlaceholder")} required />
            </label>
            <button
              type="submit"
              className={`button button-primary${signingIn ? " signin-btn-loading" : ""}`}
              style={{ padding: "12px", width: "100%", cursor: signingIn ? "not-allowed" : "pointer", fontSize: "14px", marginTop: "4px", position: "relative", overflow: "hidden" }}
              disabled={signingIn}
            >
              {signingIn && signingInRole === "user" ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span className="btn-spinner" />
                  Signing in…
                </span>
              ) : t("login.signInBtn")}
            </button>
            {error && (
              <div className="restriction-info-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)", padding: "10px 12px", borderRadius: "8px", border: "1px solid", fontSize: "12.5px", marginTop: "4px" }}>
                <strong>{t("login.invalidCreds")}</strong> {t("login.invalidCredsDesc")}
              </div>
            )}
          </form>

          <div className="quick-access-section">
            <p className="quick-access-label">{t("login.instantAccess")}</p>
            <div className="quick-access-grid">
              {loginCards.map((profile) => (
                <form
                  action={loginAs}
                  key={profile.code}
                  onSubmit={() => handleQuickLogin(profile.code)}
                >
                  <input type="hidden" name="username" value={QUICK_LOGIN_CREDENTIALS[profile.code].username} />
                  <input type="hidden" name="password" value={QUICK_LOGIN_CREDENTIALS[profile.code].password} />
                  <button type="submit" className="quick-role-btn" disabled={signingIn}>
                    <div className="role-icon">
                      {profile.code === "SC" ? "📊" : profile.code === "WH" ? "📦" : profile.code === "SA" ? "💰" : "⚙️"}
                    </div>
                    <div className="role-details">
                      <strong>{t(`role.${profile.code}.title` as any) || profile.title} ({profile.code})</strong>
                      <span>{profile.shortTitle} · {QUICK_LOGIN_CREDENTIALS[profile.code].username}</span>
                    </div>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
