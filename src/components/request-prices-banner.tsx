"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import * as XLSX from "xlsx-js-style";

type Category = {
  id: number;
  name: string;
  description: string;
};

type Item = {
  id: number;
  name: string;
  unit: string;
  description: string;
  active: number;
  category_id: number;
  category_name: string;
};

export default function RequestPricesBanner({
  categories,
  items,
  simulate = false,
}: {
  categories: Category[];
  items: Item[];
  simulate?: boolean;
}) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");
  const [checkedItemIds, setCheckedItemIds] = useState<Record<number, boolean>>({});

  const isAr = locale === "ar";

  // Calculate next month
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthName = nextMonthDate.toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "long" });
  const nextMonthYear = nextMonthDate.getFullYear();

  // Banner visibility: visible from the 25th of the month onwards, or if simulation is active
  const day = simulate ? 25 : now.getDate();
  const isVisible = day >= 25;

  // For testing/demonstration, if we need to see it during development we can keep it visible or rely on day >= 25.
  // We will respect the user's requirement: "on 25th of June, a banner appears ... and remain there till July 1st"
  if (!isVisible) {
    return null;
  }

  // Filter items based on selected category in customize mode
  const currentCategoryItems = items.filter(
    (item) => item.category_id === selectedCategoryId && item.active === 1
  );

  const handleSelectCategory = (catId: number | "") => {
    setSelectedCategoryId(catId);
    // Auto-check all items of this category initially
    if (catId !== "") {
      const initialChecked: Record<number, boolean> = {};
      items
        .filter((item) => item.category_id === catId && item.active === 1)
        .forEach((item) => {
          initialChecked[item.id] = true;
        });
      setCheckedItemIds(initialChecked);
    } else {
      setCheckedItemIds({});
    }
  };

  const handleToggleItem = (itemId: number) => {
    setCheckedItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSelectAll = () => {
    const updated = { ...checkedItemIds };
    currentCategoryItems.forEach((item) => {
      updated[item.id] = true;
    });
    setCheckedItemIds(updated);
  };

  const handleDeselectAll = () => {
    const updated = { ...checkedItemIds };
    currentCategoryItems.forEach((item) => {
      updated[item.id] = false;
    });
    setCheckedItemIds(updated);
  };

  const downloadExcel = (title: string, filename: string, headers: string[], dataRows: any[][]) => {
    const sheetData = [
      [title],
      [
        isAr 
          ? "يرجى تعبئة الأسعار في العمود الأصفر وإعادة إرسال الملف." 
          : "Please fill in your prices in the yellow column and send the file back."
      ],
      [],
      headers,
      ...dataRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Merge cells: A1:E1 for Title, A2:E2 for Instructions
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
    ];

    // Enable RTL if locale is Arabic
    worksheet["!views"] = [{ RTL: isAr }];

    // Auto-fit column widths based on content length
    const cols = headers.map((header, colIdx) => {
      let maxLen = String(header).length;
      dataRows.forEach((row) => {
        const cellVal = row[colIdx];
        if (cellVal !== undefined && cellVal !== null) {
          const len = String(cellVal).length;
          if (len > maxLen) maxLen = len;
        }
      });
      return { wch: Math.max(maxLen + 5, 12) };
    });
    worksheet["!cols"] = cols;

    // Set row heights
    worksheet["!rows"] = [
      { hpt: 35 }, // Title row
      { hpt: 22 }, // Instructions row
      { hpt: 10 }, // Spacer row
      { hpt: 28 }, // Headers row
      ...Array(dataRows.length).fill({ hpt: 22 }) // Data rows
    ];

    // Styles definitions
    const titleStyle = {
      font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "1E3A8A" } },
      alignment: { horizontal: isAr ? "right" : "left", vertical: "center" }
    };

    const subtitleStyle = {
      font: { name: "Segoe UI", sz: 10, italic: true, color: { rgb: "475569" } },
      alignment: { horizontal: isAr ? "right" : "left", vertical: "center" }
    };

    const headerStyleAD = {
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "1F2937" } },
      fill: { fgColor: { rgb: "F1F5F9" } }, // Slate-100
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "medium", color: { rgb: "94A3B8" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } }
      }
    };

    const headerStyleE = {
      font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "1F2937" } },
      fill: { fgColor: { rgb: "F59E0B" } }, // Amber-500 (Gold)
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "D97706" } },
        bottom: { style: "medium", color: { rgb: "B45309" } },
        left: { style: "thin", color: { rgb: "D97706" } },
        right: { style: "thin", color: { rgb: "D97706" } }
      }
    };

    const cellStyleNormalCenter = {
      font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } }
      }
    };

    const cellStyleNormalLeftRight = {
      font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
      alignment: { horizontal: isAr ? "right" : "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } }
      }
    };

    // Soft yellow fill for supplier input cells
    const cellStyleYellowInput = {
      font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "1E293B" } },
      fill: { fgColor: { rgb: "FEF9C3" } }, // Yellow-100
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "FDE047" } },
        bottom: { style: "thin", color: { rgb: "FDE047" } },
        left: { style: "thin", color: { rgb: "FDE047" } },
        right: { style: "thin", color: { rgb: "FDE047" } }
      }
    };

    // Iterate over cells and apply style
    for (const key in worksheet) {
      if (key.startsWith("!")) continue;
      const cell = worksheet[key];
      const addr = XLSX.utils.decode_cell(key);
      const r = addr.r;
      const c = addr.c;

      if (r === 0) {
        cell.s = titleStyle;
      } else if (r === 1) {
        cell.s = subtitleStyle;
      } else if (r === 3) {
        // Headers row
        if (c === 4) {
          cell.s = headerStyleE;
        } else {
          cell.s = headerStyleAD;
        }
      } else if (r >= 4) {
        // Data rows
        if (c === 0 || c === 3) {
          // ID and Unit
          cell.s = cellStyleNormalCenter;
        } else if (c === 1 || c === 2) {
          // Category and Name
          cell.s = cellStyleNormalLeftRight;
        } else if (c === 4) {
          // Supplier Price Column (yellow fill)
          cell.s = cellStyleYellowInput;
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Price Request");
    XLSX.writeFile(workbook, filename);
  };

  const generateCollectiveExcel = () => {
    // Group active items by category
    const activeItems = items.filter((item) => item.active === 1);
    
    // Sort by category_name then item name
    activeItems.sort((a, b) => {
      const catCompare = a.category_name.localeCompare(b.category_name);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });

    const title = isAr 
      ? `نموذج طلب الأسعار الجماعي لشهر ${nextMonthName} ${nextMonthYear}` 
      : `Collective Supplier Price Request - ${nextMonthName} ${nextMonthYear}`;
      
    const headers = [
      isAr ? "معرف الصنف" : "Item ID",
      isAr ? "الفئة" : "Category",
      isAr ? "اسم الصنف" : "Item Name",
      isAr ? "الوحدة" : "Unit",
      isAr ? "سعر المورد (جنيه)" : "Supplier Price (EGP)"
    ];

    const dataRows = activeItems.map((item) => [
      item.id,
      item.category_name,
      item.name,
      item.unit,
      ""
    ]);

    downloadExcel(title, `Price_Request_All_Categories_${nextMonthName}_${nextMonthYear}.xlsx`, headers, dataRows);
    setOpen(false);
  };

  const generateCustomizedExcel = () => {
    if (!selectedCategoryId) {
      alert(isAr ? "الرجاء اختيار الفئة أولاً." : "Please select a category first.");
      return;
    }

    const category = categories.find((c) => c.id === selectedCategoryId);
    const categoryName = category ? category.name : "";

    const checkedItems = currentCategoryItems.filter((item) => checkedItemIds[item.id]);

    if (checkedItems.length === 0) {
      alert(isAr ? "الرجاء اختيار صنف واحد على الأقل." : "Please check at least one item.");
      return;
    }

    // Sort by name
    checkedItems.sort((a, b) => a.name.localeCompare(b.name));

    const title = isAr 
      ? `نموذج طلب أسعار فئة ${categoryName} لشهر ${nextMonthName} ${nextMonthYear}`
      : `Supplier Price Request: ${categoryName} - ${nextMonthName} ${nextMonthYear}`;

    const headers = [
      isAr ? "معرف الصنف" : "Item ID",
      isAr ? "الفئة" : "Category",
      isAr ? "اسم الصنف" : "Item Name",
      isAr ? "الوحدة" : "Unit",
      isAr ? "سعر المورد (جنيه)" : "Supplier Price (EGP)"
    ];

    const dataRows = checkedItems.map((item) => [
      item.id,
      item.category_name,
      item.name,
      item.unit,
      ""
    ]);

    const filenameSafeCategory = categoryName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_");
    downloadExcel(title, `Price_Request_${filenameSafeCategory}_${nextMonthName}_${nextMonthYear}.xlsx`, headers, dataRows);
    setOpen(false);
  };

  return (
    <>
      {/* ── Banner trigger ── */}
      <div
        onClick={() => {
          setOpen(true);
          setCustomizing(false);
          setSelectedCategoryId("");
          setCheckedItemIds({});
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "16px 20px",
          borderRadius: "14px",
          border: "1.5px solid rgba(37,99,235,0.4)",
          background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
          cursor: "pointer",
          transition: "all 220ms ease",
          boxShadow: "0 2px 10px rgba(37,99,235,0.12)",
          position: "relative",
          overflow: "hidden",
          marginBottom: "16px",
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget as HTMLDivElement;
          b.style.borderColor = "rgba(37,99,235,0.7)";
          b.style.boxShadow = "0 6px 22px rgba(37,99,235,0.22)";
          b.style.transform = "translateY(-2px)";
          b.style.background = "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)";
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget as HTMLDivElement;
          b.style.borderColor = "rgba(37,99,235,0.4)";
          b.style.boxShadow = "0 2px 10px rgba(37,99,235,0.12)";
          b.style.transform = "translateY(0)";
          b.style.background = "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)";
        }}
      >
        {/* Animated Badge pulse */}
        <div style={{
          position: "absolute", top: "10px", right: "10px",
          width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb",
          boxShadow: "0 0 0 0 rgba(37,99,235,0.7)",
          animation: "pulse 1.8s infinite",
        }} />
        
        {/* Icon block */}
        <div style={{
          width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0,
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
          fontSize: "22px",
        }}>
          📅
        </div>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.01em" }}>
            {isAr ? `طلب أسعار لشهر ${nextMonthName}` : `Request Prices for ${nextMonthName}`}
          </div>
          <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "2px", fontWeight: 500 }}>
            {isAr 
              ? "أنشئ نماذج Excel لتعبئة الأسعار وإرسالها إلى الموردين للشهر القادم" 
              : "Generate Excel templates for suppliers to input quotes for next month."}
          </div>
        </div>
        {/* Action text / Arrow */}
        <div style={{
          padding: "6px 12px", borderRadius: "8px",
          background: "rgba(37,99,235,0.1)",
          fontSize: "12px", color: "#1d4ed8", fontWeight: 700,
          transition: "all 200ms ease",
          display: "flex", alignItems: "center", gap: "6px",
        }}>
          <span>{isAr ? "ابدأ الآن" : "Get Started"}</span>
          <span>→</span>
        </div>
      </div>

      {/* ── Modal overlay wrapper ── */}
      {open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,9,15,0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Modal Content */}
          <div style={{
            width: "100%", maxWidth: "600px", maxHeight: "88vh",
            display: "flex", flexDirection: "column",
            background: "var(--bg-surface)", border: "1px solid var(--border-medium)",
            borderRadius: "16px", boxShadow: "var(--shadow-xl)",
            animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ 
              padding: "20px 24px 16px", 
              borderBottom: "1px solid var(--border-light)", 
              display: "flex", 
              alignItems: "center", 
              gap: "14px", 
              flexShrink: 0, 
              background: "linear-gradient(135deg, rgba(37,99,235,0.08), transparent)" 
            }}>
              <div style={{ 
                width: "44px", height: "44px", borderRadius: "12px", 
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)", 
                display: "flex", alignItems: "center", justifyContent: "center", 
                fontSize: "20px", flexShrink: 0, 
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)" 
              }}>
                📅
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "#2563eb", marginBottom: "3px" }}>
                  {isAr ? `تخطيط أسعار شهر ${nextMonthName}` : `${nextMonthName} Price Planning`}
                </p>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                  {isAr ? `توليد نموذج طلب الأسعار لشهر ${nextMonthName}` : `Request Prices for ${nextMonthName}`}
                </h2>
              </div>
              <button 
                onClick={() => setOpen(false)} 
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {!customizing ? (
                // ── Option Selection Mode ──
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 8px" }}>
                    {isAr 
                      ? "اختر طريقة توليد ملفات Excel لإرسالها إلى الموردين لجمع عروض أسعار الشهر القادم:" 
                      : "Choose how you would like to generate the Excel price collection sheets for suppliers:"}
                  </p>
                  
                  {/* Button 1: Collective File */}
                  <div
                    onClick={generateCollectiveExcel}
                    style={{
                      padding: "18px",
                      borderRadius: "12px",
                      border: "1.5px solid var(--border-medium)",
                      background: "var(--bg-elevated)",
                      cursor: "pointer",
                      transition: "all 180ms",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "#2563eb";
                      el.style.background = "rgba(37,99,235,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "var(--border-medium)";
                      el.style.background = "var(--bg-elevated)";
                    }}
                  >
                    <div style={{ fontSize: "24px", marginTop: "2px" }}>📦</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>
                        {isAr ? "تحميل النموذج الجماعي لكافة الأصناف" : "Collective Price Request File"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {isAr 
                          ? "ملف واحد يحتوي على جميع الأصناف مصنفة ومرتبة حسب فئاتها لتسعيرها بالكامل." 
                          : "A single spreadsheet containing all items categorized by category, ready to be filled out by any supplier."}
                      </div>
                    </div>
                  </div>

                  {/* Button 2: Customize List */}
                  <div
                    onClick={() => setCustomizing(true)}
                    style={{
                      padding: "18px",
                      borderRadius: "12px",
                      border: "1.5px solid var(--border-medium)",
                      background: "var(--bg-elevated)",
                      cursor: "pointer",
                      transition: "all 180ms",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "#2563eb";
                      el.style.background = "rgba(37,99,235,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "var(--border-medium)";
                      el.style.background = "var(--bg-elevated)";
                    }}
                  >
                    <div style={{ fontSize: "24px", marginTop: "2px" }}>⚙️</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>
                        {isAr ? "تخصيص وتحديد قائمة الأصناف" : "Customize Price Request List"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {isAr 
                          ? "اختر فئة معينة وحدد يدوياً الأصناف التي تريد إرسالها للمورد للحصول على أسعارها." 
                          : "Select a specific category, then check only the specific items you need supplier quotes for."}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // ── Customize Checklist Mode ──
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Category Selection Dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "6px" }}>
                      {isAr ? "اختر الفئة:" : "Select Category:"}
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => handleSelectCategory(e.target.value ? Number(e.target.value) : "")}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1.5px solid var(--border-medium)",
                        background: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    >
                      <option value="">-- {isAr ? "اختر فئة" : "Choose a category"} --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Items Checklist */}
                  {selectedCategoryId !== "" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {isAr ? "الأصناف المتوفرة:" : "Available Items:"} ({currentCategoryItems.length})
                        </span>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            type="button"
                            onClick={handleSelectAll}
                            style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            {isAr ? "تحديد الكل" : "Select All"}
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAll}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            {isAr ? "إلغاء التحديد" : "Deselect All"}
                          </button>
                        </div>
                      </div>

                      {/* Checklist Box */}
                      <div style={{
                        maxHeight: "220px",
                        overflowY: "auto",
                        border: "1px solid var(--border-light)",
                        borderRadius: "8px",
                        padding: "10px",
                        background: "var(--bg-elevated)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}>
                        {currentCategoryItems.length === 0 ? (
                          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                            {isAr ? "لا توجد أصناف في هذه الفئة." : "No items found in this category."}
                          </div>
                        ) : (
                          currentCategoryItems.map((item) => {
                            const isChecked = !!checkedItemIds[item.id];
                            return (
                              <label
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  background: isChecked ? "rgba(37,99,235,0.05)" : "transparent",
                                  border: `1px solid ${isChecked ? "rgba(37,99,235,0.2)" : "transparent"}`,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  color: "var(--text-primary)",
                                  userSelect: "none",
                                  transition: "all 120ms",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleItem(item.id)}
                                  style={{
                                    width: "16px",
                                    height: "16px",
                                    accentColor: "#2563eb",
                                    cursor: "pointer",
                                  }}
                                />
                                <span style={{ flex: 1 }}>{item.name}</span>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-surface)", padding: "1px 6px", borderRadius: "4px" }}>
                                  {item.unit}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ 
              padding: "12px 24px", 
              borderTop: "1px solid var(--border-light)", 
              background: "var(--bg-elevated)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              flexShrink: 0 
            }}>
              {customizing ? (
                <button
                  type="button"
                  onClick={() => setCustomizing(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isAr ? "← عودة للخلف" : "← Back"}
                </button>
              ) : (
                <span />
              )}
              
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1.5px solid var(--border-medium)",
                    background: "var(--bg-surface)",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                
                {customizing && selectedCategoryId !== "" && (
                  <button
                    type="button"
                    onClick={generateCustomizedExcel}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
                    }}
                  >
                    {isAr ? "توليد ملف Excel مخصص" : "Generate Custom Excel"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pulse Animation Keyframes */}
      <style>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
          }
        }
      `}</style>
    </>
  );
}
