"use client";

import { useRouter } from "next/navigation";
import SupplierDropdown from "./supplier-dropdown";
import { currentMonth, shiftMonth } from "@/lib/format";

type Category = {
  id: number;
  name: string;
};

type Item = {
  id: number;
  name: string;
};

type Supplier = {
  id: number;
  name: string;
  fame_name?: string | null;
};

type AnalyticsFiltersProps = {
  categories: Category[];
  allItems: Item[]; // All items in database (for independence)
  suppliers: Supplier[];
  startMonth: string;
  endMonth: string;
  categoryId: string;
  itemId: string;
  selectedSupplierIds: number[];
  viewMode: string;
};

export default function AnalyticsFilters({
  categories,
  allItems,
  suppliers,
  startMonth,
  endMonth,
  categoryId,
  itemId,
  selectedSupplierIds,
  viewMode,
}: AnalyticsFiltersProps) {
  const router = useRouter();

  // Helper to update URL search parameters on changes
  const handleFieldChange = (name: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value === "") {
      params.delete(name);
    } else {
      params.set(name, value);
    }
    router.push(`?${params.toString()}`);
  };

  const handleSupplierChange = (ids: number[]) => {
    const params = new URLSearchParams(window.location.search);
    params.delete("supplierIds");
    ids.forEach((id) => params.append("supplierIds", String(id)));
    router.push(`?${params.toString()}`);
  };

  return (
    <section className="panel" style={{ padding: "16px 20px" }}>
      {/* T27: Quick Duration Presets */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginRight: "4px" }}>Quick Range:</span>
        {([3, 6, 9, 12, "all"] as const).map((n) => {
          const end = currentMonth();
          const start = n === "all" ? "2024-01" : shiftMonth(end, -(n as number) + 1);
          const isActive = startMonth === start && endMonth === end;
          return (
            <button
              key={String(n)}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("startMonth", start);
                params.set("endMonth", end);
                router.push(`?${params.toString()}`);
              }}
              style={{
                padding: "4px 12px", fontSize: "11px", fontWeight: 700,
                borderRadius: "20px", cursor: "pointer", transition: "all 150ms",
                border: `1.5px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                background: isActive ? "var(--primary-light)" : "var(--bg-elevated)",
                color: isActive ? "var(--primary)" : "var(--text-secondary)",
              }}
            >
              {n === "all" ? "All" : `${n}M`}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
        
        {/* From Month */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 130px", minWidth: "120px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>From</span>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => handleFieldChange("startMonth", e.target.value)}
            style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          />
        </div>

        {/* To Month */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 130px", minWidth: "120px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>To</span>
          <input
            type="month"
            value={endMonth}
            onChange={(e) => handleFieldChange("endMonth", e.target.value)}
            style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
          />
        </div>

        {/* Category Select (Category View only) */}
        {viewMode === "category" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 160px", minWidth: "140px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Category</span>
            <select
              value={categoryId}
              onChange={(e) => handleFieldChange("categoryId", e.target.value)}
              style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Product Select (Single Item View only) */}
        {viewMode === "single" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: "2 1 200px", minWidth: "160px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Product</span>
            <select
              value={itemId}
              onChange={(e) => handleFieldChange("itemId", e.target.value)}
              style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {allItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Supplier checklist Dropdown */}
        <SupplierDropdown
          suppliers={suppliers}
          selectedIds={selectedSupplierIds}
          colors={["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16"]}
          onChange={handleSupplierChange}
        />

      </div>
    </section>
  );
}
