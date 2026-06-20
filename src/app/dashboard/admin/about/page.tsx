import { requireRole } from "@/lib/auth";
import { getServerT } from "@/lib/locale-server";

export default function AboutPage() {
  const session = requireRole(["AD"]);
  const t = getServerT();

  const capabilities = [
    { icon: "⊞", title: "Multi-Role Dashboard", desc: "Dedicated workspaces for Purchasing, Manager, Sales, and Admin roles with contextual tooling per function." },
    { icon: "📋", title: "Price Collection Engine", desc: "Real-time supplier quote gathering with inline notes, multi-supplier grids, and fast-path modal submission." },
    { icon: "🧮", title: "Volume-Tiered Margins", desc: "Automated B-tier and multi-tier pricing computations with configurable divisors and monthly toggle controls." },
    { icon: "💰", title: "Approved Price Workflows", desc: "SC manager reviews, publishes, and locks Min/Max selling price boundaries for the active month." },
    { icon: "💱", title: "Live USD Conversion Panel", desc: "Real-time EGP-to-USD price conversion fetched from a live exchange rate API, exportable as PDF." },
    { icon: "📄", title: "Document Export Suite", desc: "Branded PDF price lists and Excel spreadsheets with landscape layout, auto-fit columns, and logo embedding." },
    { icon: "📈", title: "Insights & Analytics", desc: "Interactive trend charts, supplier scorecards, category matrices, and markup strategy advisory panels." },
    { icon: "🌐", title: "Full Bilingual Support", desc: "Arabic and English fully supported across all pages, PDF exports, navigation, and data labels via Readex Pro." },
  ];

  const techStack = [
    { label: "Framework", value: "Next.js 14", color: "#000000" },
    { label: "UI Layer", value: "React Server Components", color: "#1e3a8a" },
    { label: "Language", value: "TypeScript 5.6", color: "#3178c6" },
    { label: "Database", value: "SQLite · better-sqlite3", color: "#0f9d58" },
    { label: "Styling", value: "Vanilla CSS · Design Tokens", color: "#6366f1" },
    { label: "Typography", value: "Readex Pro Variable", color: "#7c3aed" },
    { label: "Spreadsheets", value: "xlsx-js-style", color: "#059669" },
    { label: "Deployment", value: "On-Premises · Local Node", color: "#d97706" },
  ];

  return (
    <div className="page-stack animate-fade-in">

      {/* ── Hero Banner ─────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 40%, #3730a3 100%)",
        borderRadius: "16px",
        padding: "40px 44px",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "32px",
        flexWrap: "wrap",
      }}>
        {/* decorative circles */}
        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "260px", height: "260px", borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-80px", right: "120px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <img src="/faerp logo.svg" style={{ width: "40px", height: "40px", objectFit: "contain" }} alt="FAERP Logo" />
            </div>
            <div>
              <p style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>
                {t("about.eyebrow")}
              </p>
              <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: 0, lineHeight: 1.1 }}>
                {t("about.title")}
              </h1>
            </div>
          </div>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", maxWidth: "520px", lineHeight: "1.65", margin: 0 }}>
            {t("about.desc")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end", position: "relative", zIndex: 1 }}>
          <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: "10px", padding: "12px 20px", textAlign: "center", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Version</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff" }}>0.1.0</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: "10px", padding: "12px 20px", textAlign: "center", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Edition</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>On-Premises</div>
          </div>
        </div>
      </div>

      {/* ── Capabilities Grid ─────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Modules</p>
            <h2>{t("about.functionalityTitle")}</h2>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
          {capabilities.map((cap, i) => (
            <div key={i} style={{
              display: "flex", gap: "14px", alignItems: "flex-start",
              padding: "16px 18px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              transition: "box-shadow 0.2s, border-color 0.2s, transform 0.15s",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "9px",
                background: "var(--primary-light)",
                border: "1px solid var(--border-accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px", flexShrink: 0,
              }}>
                {cap.icon}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{cap.title}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: 1.55 }}>{cap.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ────────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Specs & Design</p>
            <h2>{t("about.architectureTitle")}</h2>
          </div>
        </div>
        <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: "20px", maxWidth: "680px" }}>
          {t("about.architectureText")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
          {techStack.map((tech, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column", gap: "4px",
              padding: "14px 16px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              borderLeft: `3px solid ${tech.color}`,
            }}>
              <div style={{ fontSize: "9.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)" }}>{tech.label}</div>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>{tech.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Engineering & Copyright Row ───────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* Engineering Spotlight */}
        <section style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: "16px",
          padding: "28px 32px",
          position: "relative",
          overflow: "hidden",
          color: "#fff",
        }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "160px", height: "160px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: "9.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.55)", marginBottom: "12px" }}>
              Credits
            </p>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: "18px" }}>
              {t("about.engineeringTitle")}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.10) 100%)",
                border: "2px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px", flexShrink: 0,
              }}>
                👨‍💻
              </div>
              <div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Ali Elsheikh</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", marginTop: "2px" }}>Lead Systems Architect & Developer</div>
              </div>
            </div>
            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "5px 12px", borderRadius: "99px",
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)",
                fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.85)",
              }}>
                ✦ Developed & Engineered by Ali Elsheikh
              </div>
            </div>
          </div>
        </section>

        {/* Copyright Card */}
        <section className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <div>
              <p className="eyebrow">Legal</p>
              <h2>{t("about.copyrightTitle")}</h2>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)", marginBottom: "5px" }}>Copyright</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{t("about.copyrightText")}</div>
            </div>
            <div style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)", marginBottom: "5px" }}>License</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Proprietary — All rights reserved. Unauthorised reproduction prohibited.</div>
            </div>
            <div style={{ padding: "14px 16px", background: "var(--primary-light)", borderRadius: "10px", border: "1px solid var(--border-accent)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--primary)", marginBottom: "5px" }}>Current Session</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary)" }}>Logged in as: {session.displayName}</div>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
