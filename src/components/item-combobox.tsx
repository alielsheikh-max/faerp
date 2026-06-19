"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ItemComboboxOption = {
  id: string | number;
  label: string;
  unit?: string;
  /** Shown as small grey tag */
  category?: string;
  /**
   * undefined → no published-status styling (neutral)
   * true      → normal row
   * false     → red shaded row + "⛔ No Price" badge
   */
  isPublished?: boolean;
  /**
   * Optional badge text (e.g. "2/5" for WH submission count).
   * Rendered as a pill on the right side of the row.
   */
  badge?: string;
  /**
   * Controls badge pill colour:
   *  "empty"    → grey   (0 submissions)
   *  "partial"  → amber  (some submitted)
   *  "complete" → green  (all submitted)
   */
  badgeVariant?: "empty" | "partial" | "complete";
};

type ItemComboboxProps = {
  items: ItemComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  locale?: string;
};

// ── Badge colour map ──────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  empty:    { bg: "rgba(107,114,128,0.12)", color: "#6b7280", border: "rgba(107,114,128,0.3)" },
  partial:  { bg: "rgba(217,119,6,0.12)",  color: "#b45309", border: "rgba(217,119,6,0.3)"   },
  complete: { bg: "rgba(5,150,105,0.12)",  color: "#047857", border: "rgba(5,150,105,0.3)"   },
};

// ── Component ─────────────────────────────────────────────────────────────────
export function ItemCombobox({
  items,
  value,
  onChange,
  placeholder = "— Select an item —",
  disabled = false,
  locale = "en",
}: ItemComboboxProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // SSR safety for portal
  useEffect(() => { setIsMounted(true); }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Re-anchor portal on scroll / resize
  useEffect(() => {
    if (!isOpen) return;
    const sync = () => {
      if (triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.left, width: r.width });
      }
    };
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [isOpen]);

  const selectedOption = items.find((i) => String(i.id) === value);

  const filtered = items.filter((i) =>
    searchQuery === "" ||
    i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.unit?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (i.category?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleTriggerClick = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setIsOpen((prev) => !prev);
    if (!isOpen) setSearchQuery("");
  };

  // ── Trigger ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        dir="rtl"
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px",
          border: "1.5px solid var(--border, #e5e7eb)",
          borderRadius: "8px",
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "var(--bg-subtle, #f9fafb)" : "var(--surface, #fff)",
          minHeight: "40px", fontSize: "13px",
          color: value ? "var(--text-primary, #111827)" : "var(--text-muted, #9ca3af)",
          boxShadow: isOpen ? "0 0 0 2px rgba(99,102,241,0.2)" : "none",
          transition: "box-shadow 0.15s",
          userSelect: "none",
          opacity: disabled ? 0.6 : 1,
          width: "100%",
          textAlign: "right",
        }}
      >
        {/* Chevron on the left (in RTL flow this is the "end" side) */}
        <span style={{ fontSize: "10px", marginLeft: "8px", color: "var(--text-muted, #9ca3af)", flexShrink: 0, order: 1 }}>
          {isOpen ? "▲" : "▼"}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, order: 0, textAlign: "right" }}>
          {selectedOption
            ? `${selectedOption.label}${selectedOption.unit ? ` (${selectedOption.unit})` : ""}`
            : placeholder}
        </span>
      </div>

      {/* ── Portal panel ────────────────────────────────────────────────────── */}
      {isMounted && isOpen && createPortal(
        <div
          ref={panelRef}
          dir="rtl"
          style={{
            position: "fixed",
            top: pos.top, left: pos.left, width: pos.width,
            zIndex: 99999,
            background: "var(--surface, #fff)",
            border: "1.5px solid var(--border, #e5e7eb)",
            borderRadius: "10px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
            overflow: "hidden", display: "flex", flexDirection: "column",
            maxHeight: "340px", fontFamily: "inherit",
            direction: "rtl",
          }}
        >
          {/* Search input — RTL */}
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border-light, #f3f4f6)" }}>
            <input
              autoFocus
              type="text"
              dir="rtl"
              placeholder={locale === "ar" ? "🔍 ابحث بأي كلمة..." : "🔍 Search by any word..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: "6px",
                border: "1px solid var(--border, #e5e7eb)", fontSize: "13px",
                background: "var(--bg, #f9fafb)", color: "var(--text-primary, #111827)",
                outline: "none", fontFamily: "inherit",
                textAlign: "right",
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {/* Clear / placeholder row */}
            <div
              onClick={() => { onChange(""); setIsOpen(false); setSearchQuery(""); }}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: "12px",
                color: "var(--text-muted, #9ca3af)",
                borderBottom: "1px solid var(--border-light, #f3f4f6)",
                fontStyle: "italic", textAlign: "right",
              }}
            >
              {placeholder}
            </div>

            {filtered.map((item) => {
              const isSelected = String(item.id) === value;
              const showRed = item.isPublished === false;
              const badgeStyle = item.badge && item.badgeVariant ? BADGE_STYLES[item.badgeVariant] : null;

              return (
                <div
                  key={item.id}
                  onClick={() => { onChange(String(item.id)); setIsOpen(false); setSearchQuery(""); }}
                  style={{
                    padding: "9px 12px", cursor: "pointer", fontSize: "13px",
                    display: "flex", alignItems: "center", gap: "8px",
                    borderBottom: "1px solid var(--border-light, #f3f4f6)",
                    // borderInlineStart is RTL-aware: right border in RTL, left border in LTR
                    borderInlineStart: isSelected ? "3px solid #6366f1"
                      : showRed ? "3px solid rgba(239,68,68,0.5)"
                      : "3px solid transparent",
                    background: isSelected ? "rgba(99,102,241,0.08)"
                      : showRed ? "rgba(239,68,68,0.05)"
                      : "transparent",
                    color: showRed ? "#b91c1c" : "var(--text-primary, #111827)",
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {/* Item name + unit — text right-aligned */}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, lineHeight: 1.5, textAlign: "right" }}>
                    {item.label}
                    {item.unit && (
                      <span style={{ color: "var(--text-muted, #9ca3af)", fontSize: "11px", marginRight: "6px" }}>
                        {" "}({item.unit})
                      </span>
                    )}
                    {item.category && (
                      <span style={{ color: "var(--text-muted, #9ca3af)", fontSize: "10px", marginRight: "6px", opacity: 0.75 }}>
                        {" "}[{item.category}]
                      </span>
                    )}
                  </span>

                  {/* Right-side badges (visually leftmost in RTL layout) */}
                  <span style={{ display: "flex", gap: "5px", alignItems: "center", flexShrink: 0 }}>
                    {/* Submission count badge (WH) */}
                    {item.badge && badgeStyle && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700,
                        background: badgeStyle.bg, color: badgeStyle.color,
                        padding: "2px 8px", borderRadius: "99px",
                        border: `1px solid ${badgeStyle.border}`,
                        whiteSpace: "nowrap", letterSpacing: "0.3px",
                      }}>
                        {item.badge}
                      </span>
                    )}
                    {/* No Price badge */}
                    {showRed && (
                      <span style={{
                        fontSize: "9px", fontWeight: 800,
                        background: "rgba(239,68,68,0.12)", color: "#dc2626",
                        padding: "2px 7px", borderRadius: "99px",
                        border: "1px solid rgba(239,68,68,0.3)", whiteSpace: "nowrap",
                      }}>
                        {locale === "ar" ? "⛔ لم يُنشر" : "⛔ No Price"}
                      </span>
                    )}
                    {/* Selected checkmark */}
                    {isSelected && !showRed && (
                      <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: 700 }}>✓</span>
                    )}
                  </span>
                </div>
              );
            })}

            {/* Empty state */}
            {filtered.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted, #9ca3af)", fontSize: "12px" }}>
                {locale === "ar" ? "لا توجد نتائج" : "No items match your search"}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
