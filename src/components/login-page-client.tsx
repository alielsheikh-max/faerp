"use client";

import { useState, useEffect, Fragment } from "react";
import { loginAs } from "@/app/actions/auth";
import { QUICK_LOGIN_CREDENTIALS, ROLE_PROFILES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n-context";

const loginCards = Object.values(ROLE_PROFILES);

export default function LoginPageClient({ error }: { error?: string }) {
  const { t, toggleLocale, locale } = useI18n();
  const [signingIn, setSigningIn] = useState(false);
  const [signingInRole, setSigningInRole] = useState<string | null>(null);

  // ── Reset loading overlay when the server returns an error ──────────────
  // Next.js App Router does a soft navigation back to the same page, so the
  // component does NOT unmount — we have to reset state manually.
  useEffect(() => {
    if (error) {
      setSigningIn(false);
      setSigningInRole(null);
    }
  }, [error]);

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

      {/* ── Sign-in transition overlay ─────────────────────────────────────── */}
      {signingIn && (
        <div className="signin-overlay">
          <div className="signin-overlay-inner">
            {/* Logo */}
            <div className="signin-logo-wrap">
              <img src="/faerp logo.svg" alt="FAERP" className="signin-logo-img" />
            </div>
            {/* App name */}
            <div className="signin-overlay-appname">FAERP</div>
            {/* Role label */}
            <div className="signin-overlay-text">
              <span>
                {signingInRole && signingInRole !== "user"
                  ? `Signing in as ${signingInRole}…`
                  : "Authenticating…"}
              </span>
            </div>
            {/* Calm progress bar */}
            <div className="signin-progress-track">
              <div className="signin-progress-bar" />
            </div>
          </div>
        </div>
      )}


      {/* Language toggle — top right, inside page flow */}
      <div style={{ position: "absolute", top: "18px", right: "18px", zIndex: 200 }}>
        <button
          type="button"
          onClick={toggleLocale}
          style={{
            padding: "7px 14px",
            background: "rgba(30,58,138,0.82)",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: "20px", color: "#fff",
            fontSize: "12px", fontWeight: 700, cursor: "pointer",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 150ms",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(30,58,138,1)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(30,58,138,0.82)")}
        >
          🌐 {t("sidebar.langToggle")}
        </button>
      </div>

      <section className="login-hero">
        {/* Left Brand */}
        <div className="hero-copy">

          {/* ── Brand Identity Block ── */}
          <div className="hero-brand-identity">
            <div className="hero-logo-tile">
              <img src="/faerp logo.svg" alt="FAERP" className="hero-logo-img" />
            </div>
            <div className="hero-wordmark">FAERP</div>
            <div className="hero-wordmark-tag">Enterprise Resource Platform</div>
          </div>

          {/* ── Headline & Features ── */}
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

            {/* ── Error banners ───────────────────────────────────────── */}
            {error === "disabled" && (
              <div style={{
                background: "rgba(217,119,6,0.08)",
                borderColor: "rgba(217,119,6,0.35)",
                color: "#92400e",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid",
                fontSize: "12.5px",
                marginTop: "8px",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                lineHeight: 1.55,
              }}>
                <span style={{ fontSize: "18px", flexShrink: 0 }}>🔒</span>
                <div>
                  <strong style={{ display: "block", marginBottom: "3px" }}>Account Disabled</strong>
                  This account has been suspended by the system administrator. Please contact your System Administrator to restore access.
                </div>
              </div>
            )}
            {error && error !== "disabled" && (
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
