"use client";

import { useEffect } from "react";

export default function PrintButton({ autoprint = false }: { autoprint?: boolean }) {
  useEffect(() => {
    if (autoprint) {
      // Small delay lets the page fully render before opening the print dialog
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoprint]);

  return (
    <button
      onClick={() => window.print()}
      style={{
        border: 0,
        borderRadius: "12px",
        padding: "12px 18px",
        background: "#2f6fed",
        color: "#fff",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      🖨 Print / Save as PDF
    </button>
  );
}
