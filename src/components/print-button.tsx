"use client";

export default function PrintButton() {
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
        cursor: "pointer"
      }}
    >
      Print
    </button>
  );
}
