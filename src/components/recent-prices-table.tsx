"use client";

import { useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";

type Entry = {
  id: number;
  month: string;
  price: number;
  collected_by: string;
  notes: string;
  recorded_at: string;
  item_name: string;
  item_id: number;
  category_name: string;
  supplier_name: string;
  supplier_display_name: string;
};

type Group = {
  key: string;
  month: string;
  category_name: string;
  item_name: string;
  entries: Entry[];
};

function buildGroups(entries: Entry[]): Group[] {
  const groups: Group[] = [];
  const seen = new Map<string, Group>();
  for (const e of entries) {
    const key = `${e.month}||${e.item_id}`;
    if (!seen.has(key)) {
      const g: Group = { key, month: e.month, category_name: e.category_name, item_name: e.item_name, entries: [] };
      groups.push(g);
      seen.set(key, g);
    }
    seen.get(key)!.entries.push(e);
  }
  return groups;
}

export default function RecentPricesTable({ entries }: { entries: Entry[] }) {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const groups = buildGroups(entries);

  // All groups start collapsed; user clicks to expand any
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px", fontSize: "13px" }}>
        {isAr ? "لا توجد أسعار مسجلة بعد." : "No prices recorded yet."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {groups.map(group => {
        const open = expanded.has(group.key);
        const count = group.entries.length;
        const prices = group.entries.map(e => e.price);
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const avgP = prices.reduce((a, b) => a + b, 0) / prices.length;

        return (
          <div key={group.key} style={{
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            background: "var(--bg-surface)",
          }}>
            {/* ── Group header row (always visible) ── */}
            <div
              onClick={() => toggle(group.key)}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto auto auto",
                gap: "10px",
                alignItems: "center",
                padding: "10px 14px",
                cursor: "pointer",
                background: open ? "var(--bg-subtle)" : "var(--bg-surface)",
                transition: "background 120ms",
                userSelect: "none",
              }}
            >
              {/* Expand indicator */}
              <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "14px" }}>
                {open ? "▼" : "▶"}
              </span>

              {/* Item name + category */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {group.item_name}
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                  <span className="badge badge-strong" style={{ fontSize: "9px", padding: "1px 6px" }}>{group.category_name}</span>
                </div>
              </div>

              {/* Month */}
              <span className="badge" style={{ fontSize: "11px", whiteSpace: "nowrap" }}>
                {group.month}
              </span>

              {/* Supplier count */}
              <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {count} {isAr ? "مورد" : count === 1 ? "supplier" : "suppliers"}
              </span>

              {/* Price range */}
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                {minP === maxP ? (
                  <strong style={{ color: "var(--success)", fontSize: "13px" }}>{formatCurrency(minP)}</strong>
                ) : (
                  <span style={{ fontSize: "11.5px" }}>
                    <strong style={{ color: "var(--success)" }}>{formatCurrency(minP)}</strong>
                    <span style={{ color: "var(--text-muted)", margin: "0 3px" }}>–</span>
                    <strong style={{ color: "var(--danger)" }}>{formatCurrency(maxP)}</strong>
                  </span>
                )}
                <div style={{ fontSize: "9.5px", color: "var(--text-muted)" }}>
                  {isAr ? "متوسط" : "avg"} {formatCurrency(avgP)}
                </div>
              </div>

              {/* Best supplier label */}
              {count > 1 && (
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {(() => {
                    const best = group.entries.reduce((a, b) => a.price < b.price ? a : b);
                    return (
                      <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 600 }}>
                        🏆 {best.supplier_display_name}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Expanded supplier rows ── */}
            {open && (
              <div style={{ borderTop: "1px solid var(--border-light)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)" }}>
                      <th style={{ padding: "7px 14px", textAlign: isAr ? "right" : "left", fontWeight: 700, color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light)" }}>
                        {isAr ? "المورد" : "Supplier"}
                      </th>
                      <th style={{ padding: "7px 14px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light)" }}>
                        {isAr ? "السعر" : "Price"}
                      </th>
                      <th style={{ padding: "7px 14px", textAlign: isAr ? "right" : "left", fontWeight: 700, color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light)" }}>
                        {isAr ? "ملاحظات" : "Notes"}
                      </th>
                      <th style={{ padding: "7px 14px", textAlign: isAr ? "right" : "left", fontWeight: 700, color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light)" }}>
                        {isAr ? "جُمع بواسطة" : "By"}
                      </th>
                      <th style={{ padding: "7px 14px", textAlign: isAr ? "right" : "left", fontWeight: 700, color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light)" }}>
                        {isAr ? "وقت التسجيل" : "Recorded"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...group.entries].sort((a, b) => a.price - b.price).map((e, idx) => {
                      const isBest = e.price === minP;
                      return (
                        <tr key={e.id} style={{
                          background: idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)",
                          borderBottom: "1px solid var(--border-light)",
                        }}>
                          <td style={{ padding: "8px 14px", fontWeight: isBest ? 700 : 400, color: isBest ? "var(--success)" : "var(--text-primary)" }}>
                            {isBest && <span style={{ marginInlineEnd: "4px" }}>🏆</span>}
                            {e.supplier_display_name}
                            {e.supplier_display_name !== e.supplier_name && (
                              <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginTop: "1px" }}>{e.supplier_name}</div>
                            )}
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: isBest ? "var(--success)" : e.price === maxP && count > 1 ? "var(--danger)" : "var(--text-primary)", whiteSpace: "nowrap" }}>
                            {formatCurrency(e.price)}
                          </td>
                          <td style={{ padding: "8px 14px", color: "var(--text-muted)", fontSize: "11.5px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.notes || "—"}
                          </td>
                          <td style={{ padding: "8px 14px", color: "var(--text-secondary)", fontSize: "11px", whiteSpace: "nowrap" }}>
                            {e.collected_by}
                          </td>
                          <td style={{ padding: "8px 14px", color: "var(--text-muted)", fontSize: "11px", whiteSpace: "nowrap" }}>
                            {formatDateTime(e.recorded_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
