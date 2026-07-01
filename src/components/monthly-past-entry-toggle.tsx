"use client";

import { useTransition } from "react";
import { togglePastMonthEntryAction } from "@/app/actions/pricing";

interface MonthlyPastEntryToggleProps {
  month: string;
  initialEnabled: boolean;
}

export default function MonthlyPastEntryToggle({ month, initialEnabled }: MonthlyPastEntryToggleProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const formData = new FormData();
    formData.append("month", month);
    if (checked) {
      formData.append("allowPastMonthEntries", "on");
    }

    startTransition(async () => {
      await togglePastMonthEntryAction(formData);
    });
  };

  return (
    <div className="panel" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "center", opacity: isPending ? 0.7 : 1, transition: "opacity 150ms" }}>
      <form style={{ display: "flex", flexDirection: "column", gap: "6px" }} onSubmit={(e) => e.preventDefault()}>
        <input type="hidden" name="month" value={month} />
        <div>
          <p className="eyebrow" style={{ fontSize: "9px", marginBottom: "2px" }}>Monthly Entry Lock</p>
          <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Past Month Pricing</h3>
        </div>
        <label className="checkbox-row" style={{ marginTop: "4px", cursor: "pointer" }}>
          <input 
            type="checkbox" 
            name="allowPastMonthEntries" 
            defaultChecked={initialEnabled} 
            onChange={handleToggle}
            disabled={isPending}
          />
          <span style={{ fontSize: "12.5px", fontWeight: 600 }}>
            {isPending ? "Updating..." : "Open entry to previous month"}
          </span>
        </label>
      </form>
    </div>
  );
}
