"use client";

type Props = {
  curMonth: string;
  prevMonth: string;
  defaultValue: string;
  curLabel: string;
  prevLabel: string;
};

export default function MonthSwitcher({ curMonth, prevMonth, defaultValue, curLabel, prevLabel }: Props) {
  return (
    <form method="GET" style={{ display: "flex", alignItems: "center" }}>
      <select
        name="month"
        defaultValue={defaultValue}
        onChange={(e) => e.target.form?.submit()}
        style={{
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer"
        }}
      >
        <option value={curMonth}>{curLabel}</option>
        <option value={prevMonth}>{prevLabel}</option>
      </select>
    </form>
  );
}
