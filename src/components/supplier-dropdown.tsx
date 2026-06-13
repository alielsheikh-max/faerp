"use client";

import { useState, useRef, useEffect } from "react";

type Supplier = {
  id: number;
  name: string;
};

type SupplierDropdownProps = {
  suppliers: Supplier[];
  selectedIds: number[];
  colors: string[];
  onChange?: (selectedIds: number[]) => void;
};

export default function SupplierDropdown({
  suppliers,
  selectedIds,
  colors,
  onChange,
}: SupplierDropdownProps) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set(selectedIds));
  const ref = useRef<HTMLDivElement>(null);

  // Sync state with selectedIds prop from parent / URL
  useEffect(() => {
    setChecked(new Set(selectedIds));
  }, [selectedIds]);

  // Track open state transitions to trigger onChange on close
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      const currentSelected = Array.from(checked);
      const hasChanged = selectedIds.length !== currentSelected.length || 
                         selectedIds.some(id => !checked.has(id));
      if (hasChanged && onChange) {
        onChange(currentSelected);
      }
    }
    prevOpen.current = open;
  }, [open, checked, selectedIds, onChange]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleAll = () => {
    if (checked.size === suppliers.length) {
      // deselect all — keep at least one
      setChecked(new Set([suppliers[0].id]));
    } else {
      setChecked(new Set(suppliers.map((s) => s.id)));
    }
  };

  const toggle = (id: number) => {
    const next = new Set(checked);
    if (next.has(id)) {
      // don't allow deselecting the last one
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setChecked(next);
  };

  const allSelected = checked.size === suppliers.length;
  const noneSelected = checked.size === 0;

  // Build the trigger label
  const selectedSuppliers = suppliers.filter((s) => checked.has(s.id));
  const triggerLabel =
    allSelected
      ? "All Suppliers"
      : selectedSuppliers.length === 1
      ? selectedSuppliers[0].name
      : `${selectedSuppliers.length} of ${suppliers.length} suppliers`;

  return (
    <div
      ref={ref}
      style={{ position: "relative", flex: "1 1 180px", minWidth: "160px" }}
    >
      {/* Hidden inputs submitted with the form */}
      {suppliers
        .filter((s) => checked.has(s.id))
        .map((s) => (
          <input key={s.id} type="hidden" name="supplierIds" value={s.id} />
        ))}

      {/* Label */}
      <span
        style={{
          display: "block",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          marginBottom: "5px",
        }}
      >
        Suppliers
      </span>

      {/* Trigger button — matches other filter selects */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "8px 10px",
          borderRadius: "8px",
          border: `1px solid ${open ? "var(--primary)" : "var(--border)"}`,
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          fontSize: "13px",
          cursor: "pointer",
          outline: "none",
          boxShadow: open ? "var(--glow-primary)" : "none",
          transition: "all 150ms ease",
          textAlign: "left",
        }}
      >
        {/* Color dots for selected suppliers */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
            {selectedSuppliers.slice(0, 4).map((s) => {
              const idx = suppliers.findIndex((x) => x.id === s.id);
              return (
                <span
                  key={s.id}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: colors[idx % colors.length],
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
              );
            })}
            {selectedSuppliers.length > 4 && (
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                }}
              >
                +{selectedSuppliers.length - 4}
              </span>
            )}
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "13px",
            }}
          >
            {triggerLabel}
          </span>
        </span>

        {/* Chevron */}
        <span
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: "220px",
            width: "max-content",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: "10px",
            boxShadow: "var(--shadow-lg)",
            zIndex: 200,
            overflow: "hidden",
            animation: "dropdownIn 150ms ease-out forwards",
          }}
        >
          {/* Toggle all row */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid var(--border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              {checked.size} / {suppliers.length} selected
            </span>
            <button
              type="button"
              onClick={toggleAll}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--primary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          {/* Supplier rows */}
          <div style={{ padding: "6px 0" }}>
            {suppliers.map((sup, idx) => {
              const color = colors[idx % colors.length];
              const isChecked = checked.has(sup.id);
              return (
                <div
                  key={sup.id}
                  onClick={() => toggle(sup.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 14px",
                    cursor: "pointer",
                    background: isChecked ? `${color}0f` : "transparent",
                    transition: "background 100ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = `${color}18`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = isChecked
                      ? `${color}0f`
                      : "transparent";
                  }}
                >
                  {/* Custom checkbox */}
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "5px",
                      border: `2px solid ${isChecked ? color : "var(--border-medium)"}`,
                      background: isChecked ? color : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 150ms",
                    }}
                  >
                    {isChecked && (
                      <svg
                        width="9"
                        height="7"
                        viewBox="0 0 9 7"
                        fill="none"
                      >
                        <path
                          d="M1 3.5L3.5 6L8 1"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>

                  {/* Color dot */}
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: color,
                      flexShrink: 0,
                      boxShadow: isChecked ? `0 0 6px ${color}88` : "none",
                      transition: "box-shadow 150ms",
                    }}
                  />

                  {/* Name */}
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: isChecked ? 700 : 500,
                      color: isChecked ? "var(--text-primary)" : "var(--text-secondary)",
                      flex: 1,
                      transition: "all 150ms",
                    }}
                  >
                    {sup.name}
                  </span>

                  {/* Active indicator */}
                  {isChecked && (
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
