"use client";

import { ReactNode } from "react";

type Props = {
  type: "item" | "supplier";
  id: number;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
};

export default function ClickableDetailTrigger({ type, id, className, style, children }: Props) {
  const handleClick = () => {
    const eventName = type === "item" ? "show-item-details" : "show-supplier-details";
    const detailKey = type === "item" ? "itemId" : "supplierId";
    window.dispatchEvent(new CustomEvent(eventName, { detail: { [detailKey]: id } }));
  };

  return (
    <span onClick={handleClick} className={className} style={style}>
      {children}
    </span>
  );
}
