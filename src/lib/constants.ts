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
    title: "Manager",
    shortTitle: "Pricing Control",
    description: "Compare supplier prices, review historical trends, and publish resale limits."
  },
  SA: {
    code: "SA",
    title: "Sales",
    shortTitle: "Sales Catalog",
    description: "Review approved minimum and maximum selling prices for the active month."
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
    displayName: "SC Manager"
  },
  SA: {
    username: "sa",
    password: "sa123",
    displayName: "SA Sales"
  }
};