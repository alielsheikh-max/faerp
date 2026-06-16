"use client";

import { purgeDataAction } from "@/app/actions/admin";

export default function PurgeDatabasePanel() {
  return (
    <div style={{ padding: "4px" }}>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5" }}>
        This utility wipes all transactional, catalog, and pricing data from the system, including: 
        <strong> Categories, Items, Suppliers, Price Change Requests, Margin Floor Rules, Quote Entries, and Sell Price History</strong>. 
        All registered <strong>User Accounts will be preserved</strong>. This action is irreversible.
      </div>

      <form action={purgeDataAction} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="field" style={{ flex: "1 1 240px", maxWidth: "320px" }}>
          <span style={{ color: "var(--danger)", fontWeight: 700 }}>Purge Protection Password</span>
          <input 
            name="password" 
            type="password" 
            placeholder="Enter password" 
            required 
            style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "var(--bg-elevated)" }}
          />
        </label>
        <button 
          type="submit" 
          className="button button-danger" 
          style={{ padding: "10px 20px", fontSize: "13px", height: "38px" }}
          onClick={(e) => {
            if (!confirm("WARNING: Are you absolutely sure you want to purge all pricing and catalog data? This cannot be undone!")) {
              e.preventDefault();
            }
          }}
        >
          ☢️ Wipe All Data Except Users
        </button>
      </form>
    </div>
  );
}
