"use client";

import { useState, useEffect } from "react";

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  badgeText?: string;
  badgeClass?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function CollapsiblePanel({ id, eyebrow, title, badgeText, badgeClass, subtitle, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleExpand = (e: Event) => {
      const sectionId = (e as CustomEvent).detail;
      if (sectionId === id) {
        setIsOpen(true);
        setTimeout(() => {
          const el = document.getElementById(`section-${id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    };
    window.addEventListener("expand-admin-section", handleExpand);
    return () => window.removeEventListener("expand-admin-section", handleExpand);
  }, [id]);

  return (
    <section className="panel" id={`section-${id}`} style={{ paddingBottom: isOpen ? "24px" : "12px" }}>
      <div 
        className="panel-header" 
        onClick={() => setIsOpen(v => !v)}
        style={{ cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <p className="eyebrow" style={{ fontSize: "10px", margin: 0 }}>{eyebrow}</p>
          <h2 style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0 0" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", transition: "transform 0.2s" }}>
              {isOpen ? "▼" : "▶"}
            </span> 
            {title}
          </h2>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {badgeText && <span className={`badge ${badgeClass}`}>{badgeText}</span>}
        </div>
      </div>
      
      <div style={{ display: isOpen ? "block" : "none", marginTop: "16px" }}>
        {subtitle && (
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px" }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
