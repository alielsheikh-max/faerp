"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n-context";
import type { ActivityLogEntry } from "@/lib/db";

/* ── Event type → i18n key mapping ───────────────────────────────────── */
const EVENT_KEY_MAP: Record<string, { labelKey: string; icon: string; color: string; bg: string }> = {
  sign_in:                  { labelKey: "activity.signIn",           icon: "🔓", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  sign_out:                 { labelKey: "activity.signOut",          icon: "🔒", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  price_quote_submitted:    { labelKey: "activity.quoteSubmitted",   icon: "💰", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  price_quote_updated:      { labelKey: "activity.quoteUpdated",     icon: "✏️", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  bulk_quotes_submitted:    { labelKey: "activity.bulkQuotes",       icon: "📋", color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  price_change_requested:   { labelKey: "activity.changeRequested",  icon: "🔄", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  price_change_approved:    { labelKey: "activity.changeApproved",   icon: "✅", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  price_change_rejected:    { labelKey: "activity.changeRejected",   icon: "❌", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  selling_price_published:  { labelKey: "activity.pricePublished",   icon: "📢", color: "#1e3a8a", bg: "rgba(30,58,138,0.12)" },
  user_created:             { labelKey: "activity.userCreated",      icon: "👤", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  user_updated:             { labelKey: "activity.userUpdated",      icon: "🔧", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  user_deleted:             { labelKey: "activity.userDeleted",      icon: "🗑️", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  item_created:             { labelKey: "activity.itemCreated",      icon: "📦", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  item_updated:             { labelKey: "activity.itemUpdated",      icon: "📝", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  item_deleted:             { labelKey: "activity.itemDeleted",      icon: "🗑️", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  category_created:         { labelKey: "activity.categoryCreated",  icon: "🗂️", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  category_updated:         { labelKey: "activity.categoryUpdated",  icon: "📝", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  category_deleted:         { labelKey: "activity.categoryDeleted",  icon: "🗑️", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  supplier_created:         { labelKey: "activity.supplierCreated",  icon: "🏭", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  supplier_updated:         { labelKey: "activity.supplierUpdated",  icon: "📝", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  supplier_deleted:         { labelKey: "activity.supplierDeleted",  icon: "🗑️", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const ROLE_KEY_MAP: Record<string, { labelKey: string; color: string; bg: string }> = {
  AD: { labelKey: "activity.roleAD", color: "#1e3a8a", bg: "rgba(30,58,138,0.12)" },
  SC: { labelKey: "activity.roleSC", color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
  WH: { labelKey: "activity.roleWH", color: "#0891b2", bg: "rgba(8,145,178,0.12)"  },
  SA: { labelKey: "activity.roleSA", color: "#059669", bg: "rgba(5,150,105,0.12)"  },
};

const ALL_EVENT_KEYS = Object.keys(EVENT_KEY_MAP);
const ALL_ROLE_KEYS  = Object.keys(ROLE_KEY_MAP);
const PAGE_SIZE = 60;

export default function ActivityLogClient() {
  const { t, locale, isRTL } = useI18n();

  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [role,    setRole]    = useState("");
  const [event,   setEvent]   = useState("");
  const [loading, startLoad]  = useTransition();

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function formatTime(iso: string) {
    try {
      const d = new Date(iso.replace(" ", "T") + (iso.includes("T") ? "" : "Z"));
      return d.toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  }

  async function fetchData(p: number, r: string, ev: string) {
    startLoad(async () => {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (r)  params.set("role", r);
      if (ev) params.set("event", ev);
      const res = await fetch(`/api/activity-log?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEntries(json.entries ?? []);
        setTotal(json.total ?? 0);
      }
    });
  }

  useEffect(() => { fetchData(page, role, event); }, [page, role, event]);

  const filterSelectStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg-elevated)",
    color: "var(--text-primary)", fontSize: 13,
    textAlign: isRTL ? "right" : "left",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
    textTransform: "uppercase", display: "block", marginBottom: 4,
    textAlign: isRTL ? "right" : "left",
  };
  const thStyle: React.CSSProperties = {
    textAlign: isRTL ? "right" : "left",
    padding: "10px 12px", fontSize: 11, fontWeight: 700,
    color: "var(--text-muted)", textTransform: "uppercase",
    letterSpacing: "0.05em", whiteSpace: "nowrap" as const,
  };

  return (
    <div className="page-stack">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="panel-header" style={{ marginBottom: 0 }}>
        <div>
          <p className="eyebrow">{t("activity.eyebrow")}</p>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>📜</span> {t("activity.title")}
          </h2>
        </div>
        <span className="badge badge-strong">
          {total.toLocaleString(locale === "ar" ? "ar-EG" : "en")} {t("activity.events")}
        </span>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
          padding: "14px 0", borderBottom: "1px solid var(--border-light)",
          direction: isRTL ? "rtl" : "ltr",
        }}
      >
        <label style={{ minWidth: 160, margin: 0 }}>
          <span style={labelStyle}>{t("activity.roleFilter")}</span>
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setPage(1); }}
            style={filterSelectStyle}
          >
            <option value="">{t("activity.allRoles")}</option>
            {ALL_ROLE_KEYS.map(r => (
              <option key={r} value={r}>{t(ROLE_KEY_MAP[r].labelKey as any)}</option>
            ))}
          </select>
        </label>

        <label style={{ minWidth: 200, margin: 0 }}>
          <span style={labelStyle}>{t("activity.eventFilter")}</span>
          <select
            value={event}
            onChange={e => { setEvent(e.target.value); setPage(1); }}
            style={filterSelectStyle}
          >
            <option value="">{t("activity.allEvents")}</option>
            {ALL_EVENT_KEYS.map(ev => (
              <option key={ev} value={ev}>{t(EVENT_KEY_MAP[ev].labelKey as any)}</option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, alignSelf: "flex-end" }}>
          <button
            onClick={() => { setRole(""); setEvent(""); setPage(1); }}
            className="btn btn-ghost"
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            {t("gen.clear")}
          </button>
        </div>
      </div>

      {/* ── Loading indicator ────────────────────────────────────────── */}
      {loading && (
        <div style={{ padding: "8px 0", color: "var(--text-muted)", fontSize: 13 }}>
          {t("gen.loading")}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      {!loading && entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{t("activity.emptyTitle")}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{t("activity.emptyDesc")}</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", direction: isRTL ? "rtl" : "ltr" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {(["activity.colTime","activity.colActor","activity.colRole","activity.colEvent","activity.colSummary"] as const).map(k => (
                  <th key={k} style={thStyle}>{t(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const meta     = EVENT_KEY_MAP[entry.event_type];
                const roleMeta = ROLE_KEY_MAP[entry.role];
                return (
                  <tr
                    key={entry.id}
                    style={{
                      borderBottom: "1px solid var(--border-light)",
                      background: i % 2 === 0 ? "transparent" : "var(--bg-elevated)",
                    }}
                  >
                    {/* Time */}
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }}>
                      {formatTime(entry.performed_at)}
                    </td>

                    {/* Actor */}
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                      {entry.actor}
                    </td>

                    {/* Role badge */}
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 9px", borderRadius: 20,
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                        color: roleMeta?.color ?? "var(--text-muted)",
                        background: roleMeta?.bg ?? "var(--bg-elevated)",
                        border: `1px solid ${roleMeta?.color ?? "var(--border)"}22`,
                      }}>
                        {roleMeta ? t(roleMeta.labelKey as any) : entry.role}
                      </span>
                    </td>

                    {/* Event type badge */}
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        color: meta?.color ?? "var(--text-secondary)",
                        background: meta?.bg ?? "var(--bg-elevated)",
                        border: `1px solid ${meta?.color ?? "var(--border)"}22`,
                        direction: "ltr", // always LTR for icon+label pill
                      }}>
                        <span>{meta?.icon}</span>
                        <span>{meta ? t(meta.labelKey as any) : entry.event_type}</span>
                      </span>
                    </td>

                    {/* Summary */}
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", maxWidth: 480 }}>
                      {entry.summary}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", paddingTop: 16, flexWrap: "wrap" }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 13,
                fontWeight: p === page ? 700 : 500, cursor: "pointer",
                background: p === page ? "var(--primary)" : "var(--bg-elevated)",
                color: p === page ? "#fff" : "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
