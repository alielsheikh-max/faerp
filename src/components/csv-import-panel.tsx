"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { importItemsCSVActionDirect, importSuppliersCSVActionDirect } from "@/app/actions/admin";

type Props = {
  type: "items" | "suppliers";
};

// ── Client-side CSV parser (handles quoted fields + BOM) ──────────────────────
function parseCSVText(raw: string): { headers: string[]; rows: string[][] } {
  // Strip UTF-8 BOM if present
  const text = raw.startsWith("\ufeff") ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div style={{ height: "8px", background: "var(--bg-subtle)", borderRadius: "999px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--primary), var(--primary-light, #6366f1))",
          borderRadius: "999px",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

export default function CsvImportPanel({ type }: Props) {
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isItems = type === "items";
  const templateUrl = `/api/templates?type=${type}`;
  const templateFileName = isItems ? "items_template.csv" : "suppliers_template.csv";

  const PREVIEW_ROWS = 8;

  // ── Read file and show preview ─────────────────────────────────────────────
  const readAndPreview = useCallback((file: File) => {
    setResult(null);
    setParseError(null);
    setPreview(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseCSVText(text);
        if (parsed.headers.length === 0) {
          setParseError("The file appears to be empty or invalid.");
          return;
        }
        setPreview(parsed);
      } catch {
        setParseError("Could not parse the CSV file. Make sure it is a valid CSV.");
      }
    };
    reader.onerror = () => setParseError("Failed to read the file.");
    // Explicitly read as UTF-8 to handle Arabic correctly
    reader.readAsText(file, "UTF-8");
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readAndPreview(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Inject into the hidden input so FormData picks it up
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileRef.current) fileRef.current.files = dt.files;
      readAndPreview(file);
    }
  }

  function handleClear() {
    setFileName("");
    setPreview(null);
    setResult(null);
    setParseError(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview) return;
    const formData = new FormData(e.currentTarget);

    setProgress(10);
    startTransition(async () => {
      try {
        setProgress(30);
        const res = isItems
          ? await importItemsCSVActionDirect(formData)
          : await importSuppliersCSVActionDirect(formData);
        setProgress(90);
        // Small delay so progress reaches 90 visually
        await new Promise((r) => setTimeout(r, 300));
        setProgress(100);
        setResult(res);
        if (res.success) {
          setTimeout(handleClear, 1500);
        }
      } catch {
        setProgress(0);
        setResult({ success: false, error: "Unexpected error during import." });
      }
    });
  }

  const totalRows = preview ? preview.rows.length : 0;

  return (
    <div id="csv-import" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Step 1: Download Template ────────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-accent)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>
            Step 1 — Download Template
          </p>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {isItems ? "Items & Categories CSV Template" : "Suppliers CSV Template"}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
            {isItems
              ? "Category · MOQ · Item Name · Trans/EGP · TIER · Range 1–4 · Discount 1–4"
              : "Supplier Name · Code · Contact Job · Contact Person · Phone · Products · Email · Region · Address"}
          </p>
        </div>
        <a
          href={templateUrl}
          download={templateFileName}
          className="button button-secondary"
          style={{ padding: "9px 18px", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          ⬇ Download Template
        </a>
      </div>

      {/* ── Step 2: Upload ────────────────────────────────────────────────────── */}
      <div style={{
        padding: "18px 20px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>
            Step 2 — Upload & Preview
          </p>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {isItems ? "Import Items & Categories" : "Import Suppliers"}
          </p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Always-mounted file input — stays in DOM even when preview is shown so FormData can read it */}
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {/* Drop zone — only shown before a file is selected */}
          {!preview && (
            <label
              htmlFor="csv-file-input"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "8px", padding: "32px 20px",
                border: `2px dashed ${isDragging ? "var(--primary)" : "var(--border-medium)"}`,
                borderRadius: "10px",
                background: isDragging ? "var(--primary-muted, rgba(99,102,241,0.06))" : "var(--bg-subtle)",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <span style={{ fontSize: "32px" }}>📂</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Click to browse or drag &amp; drop a CSV file
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                UTF-8 encoded CSV — Arabic text supported ✓
              </span>
            </label>
          )}

          {/* Parse error */}
          {parseError && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#fee2e2", color: "var(--danger)", fontSize: "12px", border: "1px solid var(--danger)" }}>
              ❌ {parseError}
            </div>
          )}

          {/* ── CSV Preview table ──────────────────────────────────────────── */}
          {preview && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* File info bar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-light)",
                borderRadius: "8px",
                fontSize: "12px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>📄</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fileName}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      {totalRows} data row{totalRows !== 1 ? "s" : ""} detected · {preview.headers.length} columns
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  style={{ background: "none", border: "1px solid var(--border-medium)", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  ✕ Clear
                </button>
              </div>

              {/* Preview table */}
              <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)" }}>
                      <th style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap", minWidth: "32px" }}>#</th>
                      {preview.headers.map((h, i) => (
                        <th key={i} style={{
                          padding: "7px 10px",
                          textAlign: "start",
                          borderBottom: "1px solid var(--border-light)",
                          color: "var(--text-secondary)",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          // RTL-aware: check if header has Arabic
                          direction: /[\u0600-\u06FF]/.test(h) ? "rtl" : "ltr",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, PREVIEW_ROWS).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: "1px solid var(--border-light)", background: ri % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)" }}>
                        <td style={{ padding: "6px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: "10px" }}>{ri + 1}</td>
                        {preview.headers.map((_, ci) => {
                          const cell = row[ci] ?? "";
                          const isArabic = /[\u0600-\u06FF]/.test(cell);
                          return (
                            <td key={ci} style={{
                              padding: "6px 10px",
                              color: "var(--text-primary)",
                              direction: isArabic ? "rtl" : "ltr",
                              textAlign: isArabic ? "right" : "left",
                              fontFamily: isArabic ? "'Cairo', 'Noto Sans Arabic', sans-serif" : "inherit",
                              maxWidth: "180px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {cell || <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalRows > PREVIEW_ROWS && (
                  <div style={{ padding: "8px 14px", fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-subtle)", borderTop: "1px solid var(--border-light)", textAlign: "center" }}>
                    Showing {PREVIEW_ROWS} of {totalRows} rows — remaining {totalRows - PREVIEW_ROWS} row{totalRows - PREVIEW_ROWS !== 1 ? "s" : ""} will also be imported
                  </div>
                )}
              </div>

              {/* Import rules */}
              <div style={{ fontSize: "11px", color: "var(--text-muted)", padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: "8px", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--text-secondary)" }}>⚠ Import rules:</strong>
                {isItems ? (
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    <li>Categories are auto-created if they don&apos;t exist.</li>
                    <li>Items matched by <em>Category + Item Name</em> — existing items are updated.</li>
                    <li>Set <strong>TIER = yes</strong> and fill Range/Discount columns (up to 4 tiers).</li>
                    <li>Leave Range 4 / Discount 4 blank if only 3 tiers are needed.</li>
                  </ul>
                ) : (
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    <li>Suppliers matched by <em>Supplier Name</em> — existing records are updated.</li>
                    <li>All fields except Supplier Name are optional.</li>
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Progress bar (shown during import) */}
          {isPending && progress > 0 && (
            <ProgressBar
              progress={progress}
              label={`Importing ${totalRows} row${totalRows !== 1 ? "s" : ""}… please wait`}
            />
          )}

          {/* Result banner */}
          {result && (
            <div style={{
              padding: "12px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              background: result.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              color: result.success ? "var(--success)" : "var(--danger)",
              border: `1px solid ${result.success ? "var(--success)" : "var(--danger)"}`,
            }}>
              {result.success ? "✅ " : "❌ "}
              {result.success ? result.message : result.error}
            </div>
          )}

          {/* Submit button */}
          {preview && !result && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="button button-primary"
                disabled={isPending || !preview}
                style={{ padding: "10px 28px", fontSize: "13px", fontWeight: 700, opacity: isPending ? 0.7 : 1, display: "flex", alignItems: "center", gap: "8px" }}
              >
                {isPending
                  ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> Importing…</>
                  : `⬆ Confirm & Import ${totalRows} Row${totalRows !== 1 ? "s" : ""}`
                }
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
