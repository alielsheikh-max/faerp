"use client";

import { useTransition } from "react";
import { toggleMonthlyTierPricingAction } from "@/app/actions/pricing";

interface MonthlyTierToggleProps {
  month: string;
  initialEnabled: boolean;
}

export default function MonthlyTierToggle({ month, initialEnabled }: MonthlyTierToggleProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const formData = new FormData();
    formData.append("month", month);
    if (checked) {
      formData.append("tierPricingEnabled", "on");
    }

    startTransition(async () => {
      await toggleMonthlyTierPricingAction(formData);
    });
  };

  return (
    <div className="panel" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "center", opacity: isPending ? 0.7 : 1, transition: "opacity 150ms" }}>
      <form style={{ display: "flex", flexDirection: "column", gap: "6px" }} onSubmit={(e) => e.preventDefault()}>
        <input type="hidden" name="month" value={month} />
        <div>
          <p className="eyebrow" style={{ fontSize: "9px", marginBottom: "2px" }}>Monthly Policy</p>
          <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Tier Pricing Options</h3>
        </div>
        <label className="checkbox-row" style={{ marginTop: "4px", cursor: "pointer" }}>
          <input 
            type="checkbox" 
            name="tierPricingEnabled" 
            defaultChecked={initialEnabled} 
            onChange={handleToggle}
            disabled={isPending}
          />
          <span style={{ fontSize: "12.5px", fontWeight: 600 }}>
            {isPending ? "Updating..." : "Enable Volume Tiers"}
          </span>
        </label>
      </form>
    </div>
  );
}
