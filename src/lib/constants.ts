export const APP_NAME = "FAERP";
export const SESSION_COOKIE = "faerp-user";

export const ROLE_PROFILES = {
  WH: {
    code: "WH",
    title: "Purchasing",
    shortTitle: "Price Collection",
    description: "Collect monthly quotes from multiple suppliers and keep the market view current."
  },
  SC: {
    code: "SC",
    title: "Pricing Control",
    shortTitle: "SC Pricing",
    description: "Compare supplier prices, review historical trends, and submit resale limits for Manager approval."
  },
  MG: {
    code: "MG",
    title: "Manager",
    shortTitle: "Manager Control",
    description: "Approve or reconsider pricing control submissions before publishing to sales catalog."
  },
  SA: {
    code: "SA",
    title: "Sales",
    shortTitle: "Sales Catalog",
    description: "Review approved minimum and maximum selling prices for the active month."
  },
  AD: {
    code: "AD",
    title: "Admin",
    shortTitle: "System Admin",
    description: "Manage system master data, users, margin floors, and system tools."
  }
} as const;

export type RoleCode = keyof typeof ROLE_PROFILES;

export const QUICK_LOGIN_CREDENTIALS: Record<
  RoleCode,
  { username: string; password: string; displayName: string }
> = {
  WH: {
    username: "wh",
    password: "wh123",
    displayName: "WH Purchasing"
  },
  SC: {
    username: "sc",
    password: "sc123",
    displayName: "SC Pricing"
  },
  MG: {
    username: "mg",
    password: "mg123",
    displayName: "MG Manager"
  },
  SA: {
    username: "sa",
    password: "sa123",
    displayName: "SA Sales"
  },
  AD: {
    username: "admin",
    password: "admin123",
    displayName: "System Admin"
  }
};