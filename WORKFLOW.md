# FAERP — Full Application Workflow

> On-premise ERP for monthly supplier pricing, margin management, and resale control.  
> Three roles, four stages, one cycle per month.

---

## Role Overview

| Role | Code | Purpose |
|------|------|---------|
| Warehouse / Purchasing | **WH** | Collect supplier quotes every month |
| Supply Chain Manager | **SC** | Analyze quotes, set selling prices, manage margins |
| Sales Agent | **SA** | View approved prices, build client quotes |

---

## Monthly Cycle — High-Level Flow

```mermaid
flowchart TD
    A([Month Start]) --> B[WH collects supplier quotes]
    B --> C{Price already confirmed\nthis month?}
    C -- No --> D[Direct submit to price_entries]
    C -- Yes --> E[Submit Change Request\nwith mandatory reason]
    E --> F[SC reviews Change Request]
    F -- Approve --> G[New price written to\nprice_entries]
    F -- Reject --> H[WH notified — old\nprice stays active]
    D --> I[SC sees new quotes in dashboard]
    G --> I
    I --> J[SC sets selling prices\nper item or per category]
    J --> K{Markup ≥ margin floor?}
    K -- No --> L[🚫 Blocked — floor violation\nshown in UI + DB]
    K -- Yes --> M[Price written to selling_prices\n+ audit trail recorded]
    M --> N[SA views approved catalog]
    N --> O[SA builds client quote\nin deal simulator]
    O --> P{Price within\nmin–max range?}
    P -- Yes --> Q[✓ Approved quote]
    P -- No --> R[⚠️ Warning shown —\nabove max or below min]
    Q --> S([Deal closed / communicated])
    R --> S
```

---

## Stage 1 — Price Collection (WH Role)

```mermaid
sequenceDiagram
    actor WH as WH Purchasing
    participant UI as Purchasing Form
    participant DB as price_entries
    participant PCR as price_change_requests

    WH->>UI: Select category → item
    UI->>UI: Load history pivot table\n(3M / 6M / All toggle)
    WH->>UI: Enter price per supplier

    alt First time entry for this month
        UI->>DB: INSERT price_entry (direct)
        DB-->>UI: Saved ✓
    else Price already confirmed this month
        UI->>UI: Detect confirmed supplier
        UI->>WH: Show change-request modal
        WH->>UI: Enter mandatory change reason
        UI->>PCR: INSERT price_change_request (status = pending)
        PCR-->>WH: "Awaiting SC approval"
    end
```

**Key rules:**
- Month is always locked to the current calendar month — no backdating
- Each supplier × item × month can have multiple raw entries; only the **latest by `recorded_at`** is used for analysis
- Prices are in **EGP** (Egyptian Pound) — all inclusive (transport, customs, handling)
- Change requests remain pending until SC acts; the original price is live until then

---

## Stage 2 — Price Change Request Review (SC Role)

```mermaid
flowchart LR
    A[WH submits change request] --> B[SC sidebar shows\n⚠️ badge with count]
    B --> C[SC opens Admin → Price Change Requests]
    C --> D{SC decision}
    D -- Approve --> E[New price_entry inserted\nwith SC note]
    D -- Reject + note --> F[Request marked rejected\nWH can see outcome]
    E --> G[Market data updated\nfor SC analysis]
```

**SC is notified via:**
- Animated warning badge on the **Admin** nav link in the sidebar
- Count resets to zero when all requests are resolved

---

## Stage 3 — Selling Price Setting (SC Role)

### Option A — Single item via Pricing Calculator

```mermaid
flowchart TD
    A[SC opens dashboard] --> B[Select category + item]
    B --> C[View supplier price cards\n+ trend chart + matrix]
    C --> D[Click ⚙️ Set Selling Prices]
    D --> E[Pricing Calculator modal opens]
    E --> F[Choose base: Min / Avg / Max supplier]
    F --> G[Set markup mode: % or EGP fixed]
    G --> H{Margin floor\nconfigured?}
    H -- Yes --> I{Markup ≥ floor?}
    I -- No --> J[🚫 Red warning\nSubmit disabled]
    I -- Yes --> K[Live sell_min / sell_max\ncalculated in real-time]
    H -- No --> K
    K --> L[Enter change reason\nif updating existing price]
    L --> M[Submit → saved to selling_prices\nAudit trail written]
    M --> N[Revalidate dashboard + sales pages]
```

### Option B — Bulk category via Admin panel

```mermaid
flowchart LR
    A[SC opens Admin → Bulk Pricing] --> B[Select category + month]
    B --> C[Choose strategy: Min / Avg / Max]
    C --> D[Set markup % or EGP\nmin and max]
    D --> E[Click Apply to All Items]
    E --> F{For each active item\nin category}
    F --> G{Has supplier quotes\nthis month?}
    G -- No --> H[Skip — counted in Skipped]
    G -- Yes --> I{Markup ≥ margin floor?}
    I -- No --> J[Skip with floor note]
    I -- Yes --> K[Save selling price\n+ audit trail]
    K --> L[Applied counter +1]
    L --> F
    F --> M[Show result: N applied / N skipped]
```

### Option C — Monthly Review Modal (batch item-by-item)

SC can open the **Monthly Review** modal from the dashboard header to work through all items in one screen — search, filter by Published/Pending, expand each item, see supplier cards + 3–9 month history table, and enter sell_min / sell_max inline with a single Save button per item.

---

## Stage 4 — Sales Catalog & Deal Quoting (SA Role)

```mermaid
sequenceDiagram
    actor SA as Sales Agent
    participant CATALOG as Sales Catalog
    participant SIM as Deal Simulator

    SA->>CATALOG: View approved sell_min / sell_max
    note over CATALOG: Only published prices shown\nBuy costs hidden from SA
    SA->>SIM: Select product
    SA->>SIM: Enter quantity + target unit price
    SIM->>SIM: Calculate total deal value
    SIM->>SA: Show compliance status
    alt Price within min–max
        SIM-->>SA: ✓ Approved — green badge
    else Below min
        SIM-->>SA: ⚠️ Under pricing warning
    else Above max
        SIM-->>SA: ⚠️ Above max warning
    end
    SA->>SIM: Add to session deal board
    SA->>SA: Copy formatted quote text\nto clipboard
```

---

## Margin Floor Enforcement (SC Role — Admin)

```mermaid
flowchart TD
    A[SC configures margin floor\nin Admin panel] --> B{Floor type?}
    B -- Category --> C[Applies to all items\nin that category]
    B -- Item --> D[Applies to that item only\nOverrides category floor]
    C & D --> E[Floor stored in margin_floors table]
    E --> F[Every saveSellingPrice call\nchecks effective floor]
    F --> G{Markup ≥ floor?}
    G -- Yes --> H[Price saved normally]
    G -- No --> I[FLOOR_VIOLATION thrown\nUI shows red banner\nSubmit button disabled]
```

**Precedence:** Item-level floor > Category-level floor > No floor

---

## Audit Trail (Automatic — no user action required)

Every time a selling price is **created or updated**, the system automatically:
1. Snapshots the **previous** values (sell_min, sell_max, markup%, strategy, buy_avg)
2. Records the **new** values
3. Stores who changed it, when, and any change reason entered
4. Marks whether it was a **first publish** or an **update**

This is visible inside the Pricing Calculator modal as a collapsible "Price Change Audit Trail" — newest entry first.

---

## Data Model Summary

```mermaid
erDiagram
    categories ||--o{ items : contains
    items ||--o{ price_entries : "quoted by"
    suppliers ||--o{ price_entries : "quotes for"
    items ||--o| selling_prices : "priced at"
    items ||--o{ selling_price_history : "audit trail"
    items ||--o{ price_change_requests : "WH change requests"
    suppliers ||--o{ price_change_requests : "for supplier"
    items ||--o{ margin_floors : "floor rule"
    categories ||--o{ margin_floors : "floor rule"
    users ||--o{ price_entries : "collected by"

    categories {
        int id PK
        text name
        text description
    }
    items {
        int id PK
        int category_id FK
        text name
        text unit
        int active
    }
    suppliers {
        int id PK
        text name
        text contact_person
        text phone
    }
    users {
        int id PK
        text username
        text role
        text display_name
        int active
    }
    price_entries {
        int id PK
        int item_id FK
        int supplier_id FK
        text month
        real price
        text currency
        text collected_by
        text recorded_at
    }
    selling_prices {
        int id PK
        int item_id FK
        text month
        text strategy
        text markup_type
        real buy_avg
        real markup_min
        real markup_max
        real sell_min
        real sell_max
        text created_by
        text created_at
    }
    selling_price_history {
        int id PK
        int item_id FK
        text month
        real prev_sell_min
        real prev_sell_max
        real new_sell_min
        real new_sell_max
        text changed_by
        text changed_at
        text change_reason
        int is_update
    }
    margin_floors {
        int id PK
        text floor_type
        int item_id FK
        int category_id FK
        real min_markup_pct
        text set_by
        text set_at
    }
    price_change_requests {
        int id PK
        int item_id FK
        int supplier_id FK
        text month
        real old_price
        real new_price
        text reason
        text requested_by
        text status
        text reviewed_by
        text review_note
    }
```

---

## Navigation by Role

| Page | WH | SC | SA |
|------|----|----|----|
| `/dashboard` — Overview + pricing engine | ✓ read | ✓ full | ✗ |
| `/dashboard/purchasing` — Price collection | ✓ | ✓ | ✗ |
| `/dashboard/manager/analytics` — Market intelligence | ✗ | ✓ | ✗ |
| `/dashboard/sales` — Approved catalog + deal simulator | ✗ | ✓ read | ✓ |
| `/dashboard/reports` — CSV / print reports | ✗ | ✓ | ✗ |
| `/dashboard/admin` — Users, categories, suppliers, items, margin floors, bulk markup, change requests | ✗ | ✓ | ✗ |
| `/dashboard` — Approved price list only | ✗ | ✗ | ✓ |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (React Server Components + Server Actions) |
| Database | SQLite via `better-sqlite3` — single file at `data/faerp.sqlite` |
| Auth | Cookie-based session (`faerp-user`) — role stored in cookie |
| Styling | Plain CSS custom properties — light default, dark theme toggle |
| i18n | Custom context — English / Arabic with RTL layout support |
| Charts | Hand-crafted SVG (no chart library dependency) |
| Currency | Egyptian Pound (EGP) — all prices stored and displayed in EGP |
| Deployment | On-premise — runs on any Node.js 18+ machine on the local network |
