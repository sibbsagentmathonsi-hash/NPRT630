# SyncStock 2.0 — Cloud-Native Inventory & Access Management System

> **A dual-portal, role-isolated inventory governance platform** built with Node.js · Express · TypeScript · React 18 · Vite · PostgreSQL.

SyncStock 2.0 provides dedicated workspaces for each operational role in a retail/logistics organisation: point-of-sale cashiers, stock-floor managers, warehouse receiving staff, procurement officers, and a completely separate administrative governance console for HR and facility management.

---

## Table of Contents

1. [Key Highlights](#key-highlights)
2. [System Architecture](#system-architecture)
3. [Authentication & Security Flow](#authentication--security-flow)
4. [Role Workspaces](#role-workspaces)
5. [Purchase Order Lifecycle](#purchase-order-lifecycle)
6. [Data Model (ER Diagram)](#data-model-er-diagram)
7. [Role Access Matrix](#role-access-matrix)
8. [Feature Deep-Dive](#feature-deep-dive)
9. [Technology Stack](#technology-stack)
10. [Repository Structure](#repository-structure)
11. [Quick Start](#quick-start)
12. [Credentials & Access](#credentials--access)
13. [API Reference](#api-reference)
14. [Testing & Quality Assurance](#testing--quality-assurance)
15. [Environment Variables](#environment-variables)
16. [Production Build](#production-build)

---

## Key Highlights

| Feature | Detail |
| :--- | :--- |
| **Dual-Portal Architecture** | Worker Operations Portal + Admin Governance Console — completely separated HTML entry points and JWT namespaces |
| **Strict RBAC** | Five distinct roles; Admin is intentionally isolated from operational permission hierarchy |
| **Real TOTP MFA** | RFC 6238 Time-based OTP via `otplib` — QR URI generation, enrollment, and verification |
| **PostgreSQL Persistence** | Sequelize ORM; catalogue hydration on startup ensures products survive server restarts |
| **60 / 60 Tests Passing** | Native Node.js test runner across 5 suites: inventory, auth, procurement, forecasting, API integration |
| **Professional Brand Identity** | Dual-variant SVG vector logo (`BrandLogo.jsx`) — inventory cube (worker) / shield crest (admin) |
| **Dark Mode** | Full light/dark design system via CSS custom properties |

---

## System Architecture

```mermaid
flowchart TD
    subgraph Browser["Browser Layer"]
        WP["Worker Operations Portal\nhttp://localhost:5175\nindex.html"]
        AP["Admin Governance Portal\nhttp://localhost:5175/admin.html\nadmin.html"]
    end

    subgraph Frontend["React Frontend (Vite multi-page build)"]
        WA["WorkerApp.jsx\n(Manager · Cashier · Warehouse · Procurement)"]
        AA["AdminApp.jsx\n(Employee mgmt · Warehouse CRUD · Audit logs)"]
    end

    subgraph API["Express REST API — localhost:4000"]
        MW["Auth Middleware\n(verifyToken · hasPermission)"]
        AUTH["Auth Routes\n/api/auth/*"]
        INV["Inventory Routes\n/api/inventory/*"]
        ADMIN["Admin Routes\n/api/admin/*"]
        OPS["Operations Routes\n/api/sales · /api/returns\n/api/purchase-orders · /api/forecast\n/api/orders · /api/cycle-counts"]
    end

    subgraph Domain["Domain Modules (In-Memory)"]
        AUTH_M["auth.ts\nusers · JWT · TOTP · OTP"]
        INV_M["inventory.ts\nproducts · movements · transactions"]
        PROC_M["procurement.ts\npurchaseOrders · suppliers"]
        FORE_M["forecasting.ts\ndemand · safety-stock · risk tier"]
    end

    subgraph Persistence["Persistence Layer"]
        SYNC["persistence.ts\nSequelize sync · hydration"]
        PG[("PostgreSQL 16\ninventory_db")]
    end

    WP --> WA
    AP --> AA
    WA -->|"JWT Bearer token\nsyncstock_worker_token"| API
    AA -->|"JWT Bearer token\nsyncstock_admin_token"| API
    API --> MW
    MW --> AUTH
    MW --> INV
    MW --> ADMIN
    MW --> OPS
    AUTH --> AUTH_M
    INV --> INV_M
    ADMIN --> AUTH_M
    ADMIN --> INV_M
    OPS --> INV_M
    OPS --> PROC_M
    OPS --> FORE_M
    AUTH_M --> SYNC
    INV_M --> SYNC
    PROC_M --> SYNC
    SYNC --> PG
```

---

## Authentication & Security Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as React App
    participant API as Express API
    participant AUTH as auth.ts
    participant DB as PostgreSQL

    U->>FE: Enter email / Employee ID + password
    FE->>API: POST /api/auth/login
    API->>AUTH: authenticateUser(identifier, password)
    AUTH->>AUTH: bcrypt.compare(password, hash)
    alt First Login
        AUTH-->>API: { requiresPasswordSetup: true }
        API-->>FE: 200 { requiresPasswordSetup }
        FE->>U: Show password-setup wizard
        U->>FE: New password (entropy-validated)
        FE->>API: POST /api/auth/set-first-password
        API->>AUTH: setFirstPassword(userId, newPassword)
        AUTH->>DB: persistUser(updatedUser)
    end
    alt MFA Enrolled
        AUTH-->>API: { requiresMfa: true, tempToken }
        API-->>FE: 200 { requiresMfa }
        FE->>U: Prompt TOTP code
        U->>FE: 6-digit TOTP
        FE->>API: POST /api/auth/login (with mfaCode)
        API->>AUTH: verifyMfa(userId, mfaCode)
        AUTH->>AUTH: otplib.verifySync({ token, secret })
    end
    AUTH->>AUTH: generateToken(user) — JWT (24h)
    AUTH->>DB: logSecurityEvent(LOGIN_SUCCESS)
    AUTH-->>API: { token, user: PublicUser }
    API-->>FE: 200 { token, user }
    FE->>FE: Store token in sessionStorage
    FE->>U: Render role workspace
```

---

## Role Workspaces

```mermaid
flowchart LR
    LOGIN["Login\n/api/auth/login"] --> ROLE{Role?}

    ROLE -->|ADMIN| ADMIN_WS["Admin Governance Portal\nadmin.html"]
    ROLE -->|MANAGER| MGR_WS["Manager Workspace"]
    ROLE -->|CASHIER| CSH_WS["Cashier Workspace"]
    ROLE -->|WAREHOUSE_STAFF| WRH_WS["Warehouse Workspace"]
    ROLE -->|PROCUREMENT_STAFF| PRC_WS["Procurement Workspace"]

    ADMIN_WS --> A1["Employee Provisioning\n(create · edit · delete)"]
    ADMIN_WS --> A2["MFA & Password Resets"]
    ADMIN_WS --> A3["Warehouse CRUD"]
    ADMIN_WS --> A4["Security Audit Logs\n(immutable)"]
    ADMIN_WS --> A5["Read-only Oversight\n(products · suppliers · POs · forecasts)"]

    MGR_WS --> M1["KPI Dashboard\n(revenue · margin · turnover)"]
    MGR_WS --> M2["Procurement Management\n(approve · send · receive POs)"]
    MGR_WS --> M3["Demand Forecasting\n(reorder points · risk tiers)"]
    MGR_WS --> M4["Sales & Returns Oversight"]

    CSH_WS --> C1["POS Checkout\n(multi-line · VAT 15% · discount)"]
    CSH_WS --> C2["Product Returns\n(stock restoration)"]

    WRH_WS --> W1["Stock Receiving\n(match POs · partial receipts)"]
    WRH_WS --> W2["Cycle Count Audits\n(discrepancy reconciliation)"]
    WRH_WS --> W3["Online Order Fulfilment\n(reserve · commit · release)"]

    PRC_WS --> P1["Create Purchase Orders"]
    PRC_WS --> P2["Supplier Management"]
    PRC_WS --> P3["Low-Stock Auto Alerts"]
```

---

## Purchase Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: createPurchaseOrder()

    DRAFT --> APPROVED: approvePurchaseOrder()\n[Manager/Admin only]
    DRAFT --> CANCELLED: cancelPurchaseOrder()

    APPROVED --> SENT: sendPurchaseOrder()\n[Notifies supplier]
    APPROVED --> CANCELLED: cancelPurchaseOrder()

    SENT --> PARTIALLY_RECEIVED: receivePurchaseOrder()\n[qty < ordered]
    SENT --> RECEIVED: receivePurchaseOrder()\n[qty == ordered]
    SENT --> CANCELLED: cancelPurchaseOrder()

    PARTIALLY_RECEIVED --> RECEIVED: receivePurchaseOrder()\n[remaining qty fulfilled]
    PARTIALLY_RECEIVED --> CANCELLED: cancelPurchaseOrder()

    RECEIVED --> [*]
    CANCELLED --> [*]
```

---

## Data Model (ER Diagram)

```mermaid
erDiagram
    USER {
        string id PK
        string employeeId UK
        string email UK
        string passwordHash
        string role
        string sector
        string status
        string mfaSecret
        boolean mfaEnabled
        boolean requiresPasswordSetup
        datetime createdAt
    }
    PRODUCT {
        string id PK
        string sku UK
        string name
        string categoryId FK
        number costPrice
        number retailPrice
        number currentStock
        number reservedStock
        number reorderPoint
        string warehouseId FK
        datetime createdAt
    }
    CATEGORY {
        string id PK
        string name
        string description
    }
    WAREHOUSE {
        string id PK
        string name
        string location
        string type
        string status
        number capacity
    }
    SUPPLIER {
        string id PK
        string name
        string contactEmail
        number performanceRating
        number onTimeDeliveryRate
    }
    PURCHASE_ORDER {
        string id PK
        string sku FK
        string supplierId FK
        number quantity
        number receivedQuantity
        number unitCost
        string status
        datetime orderedAt
        datetime approvedAt
        datetime receivedAt
    }
    STOCK_MOVEMENT {
        string id PK
        string productId FK
        string type
        number quantity
        number balanceAfter
        string reference
        string performedBy
        datetime createdAt
    }
    SALE {
        string id PK
        string cashierId FK
        number subtotal
        number taxAmount
        number discountAmount
        number totalAmount
        string paymentMethod
        datetime createdAt
    }
    SALE_ITEM {
        string id PK
        string saleId FK
        string sku FK
        number quantity
        number unitPrice
        number lineTotal
    }
    AUDIT_LOG {
        string id PK
        string userId FK
        string eventType
        string severity
        string description
        string ipAddress
        datetime createdAt
    }

    USER ||--o{ STOCK_MOVEMENT : "performs"
    USER ||--o{ SALE : "processes"
    USER ||--o{ AUDIT_LOG : "generates"
    PRODUCT }o--|| CATEGORY : "belongs to"
    PRODUCT }o--|| WAREHOUSE : "stored in"
    PRODUCT ||--o{ STOCK_MOVEMENT : "tracks"
    PRODUCT ||--o{ SALE_ITEM : "sold as"
    SUPPLIER ||--o{ PURCHASE_ORDER : "fulfils"
    PURCHASE_ORDER }o--|| PRODUCT : "orders"
    SALE ||--|{ SALE_ITEM : "contains"
```

---

## Role Access Matrix

| Capability | Admin | Manager | Cashier | Warehouse | Procurement |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Employee provisioning & deletion | ✅ | ❌ | ❌ | ❌ | ❌ |
| Password & MFA resets | ✅ | ❌ | ❌ | ❌ | ❌ |
| Warehouse CRUD | ✅ | ❌ | ❌ | ❌ | ❌ |
| Security audit log access | ✅ | ❌ | ❌ | ❌ | ❌ |
| Product catalogue read | ✅ | ✅ | ✅ | ✅ | ✅ |
| POS checkout | ❌ | ✅ | ✅ | ❌ | ❌ |
| Product returns | ❌ | ✅ | ✅ | ❌ | ❌ |
| Approve purchase orders | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create purchase orders | ❌ | ✅ | ❌ | ❌ | ✅ |
| Stock receiving (warehouse) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Cycle count audits | ❌ | ❌ | ❌ | ✅ | ❌ |
| Online order reservation | ❌ | ✅ | ❌ | ✅ | ❌ |
| Demand forecasting view | ❌ | ✅ | ❌ | ❌ | ✅ |
| KPI dashboard | ❌ | ✅ | ❌ | ❌ | ❌ |

> [!NOTE]
> Admin is intentionally isolated from the operational permission hierarchy. `hasPermission('ADMIN', 'MANAGER')` returns `false` by design — Admin governs people and facilities, not merchandise transactions.

---

## Feature Deep-Dive

### 🛒 Cashier Workspace

| Feature | Detail |
| :--- | :--- |
| **Barcode / SKU scanner** | Input field accepts physical scanner output or manual entry; matches by barcode string or SKU (case-insensitive) and adds item to cart instantly |
| **Live stock guard** | Adding or incrementing an item beyond its available stock triggers a real-time error — the cart cannot exceed what is physically on hand |
| **Tender & change calculation** | Cash tender amount input; change-due auto-calculated and displayed before checkout confirmation |
| **Multi-payment methods** | Cash, Card, and Mobile Money — selected at checkout modal |
| **South African VAT (15%)** | VAT is extracted from the inclusive price using the formula `total × 15 / 115`, not added on top — correct for SA tax law |
| **Percentage discount** | Discount slider/input applied before VAT extraction; supports 0–100% |
| **Printed receipt** | On successful sale, a formatted receipt is generated in-app with receipt number, line items, VAT breakdown, payment method, cashier ID, and timestamp |
| **Receipt-based returns** | Cashier enters receipt number to look up the original sale; system pre-fills the product, and upon confirmation restores stock and logs a refund movement |
| **Return reason codes** | Structured reason picker: Damaged Product, Expired Item, Defective Goods, Wrong Item/Size, Customer Changed Mind, Packaging Compromised |
| **Receipts history tab** | Third tab shows a paginated list of past sale receipts for the current session |
| **Category filter** | Product grid can be filtered by category tab to speed up item lookup |

---

### 📊 Manager Workspace

| Feature | Detail |
| :--- | :--- |
| **KPI Dashboard** | Live tiles: daily sales revenue, stock-on-hand count, available vs reserved units, inventory cost value, inventory retail value, gross margin %, low-stock count |
| **Product catalogue management** | Managers can create new products and edit existing ones via a full product form (SKU, barcode, name, category, supplier, cost price, retail price, reorder point, reorder quantity, warehouse, bin location, image URL) |
| **Catalogue search & filter** | Full-text search by product name, SKU, or barcode; combined with category tab filter |
| **One-click replenishment PO** | From the forecasting view, each high-risk SKU has a "Create PO" button that auto-fills supplier, SKU, and EOQ-calculated quantity into a draft purchase order |
| **Bulk low-stock PO generation** | Single button generates draft purchase orders for all SKUs currently below reorder point — skips any SKU that already has an open draft PO |
| **Supplier performance ratings** | Supplier list shows on-time delivery rate and quality score alongside contact details |
| **Purchase order approval flow** | Manager can approve (DRAFT → APPROVED) and send (APPROVED → SENT) purchase orders from within the workspace |
| **Forecasting sub-tabs** | Workspace has four tabs: Overview (KPIs), Forecasting (risk table), Suppliers, and Catalogue |

---

### 🏭 Warehouse Workspace

| Feature | Detail |
| :--- | :--- |
| **Goods receiving** | Operator selects an open purchase order, enters received quantity and condition (GOOD / DAMAGED / PARTIAL), then submits — stock is incremented and a movement record is created |
| **Partial receipt support** | If received quantity is less than ordered, PO status moves to PARTIALLY_RECEIVED; remaining quantity is tracked for follow-up receipts |
| **Cycle count auditing** | Warehouse/bin selector; auditor steps through each product with +/− quantity steppers; on submit, system reconciles differences between system quantity and counted quantity and writes an immutable audit record with a unique audit number |
| **Stock adjustment** | Manual ADD or REMOVE quantity with reason code (Supplier Stock Received, Damaged Write-off, Cycle Count Correction, Transfer, Other) — writes a stock movement entry |
| **Online order fulfilment** | Picker selects a reserved order, commits it (RESERVED → COMMITTED) which deducts from physical stock, or releases it back to available if the order is cancelled |
| **Mobile scanner simulation mode** | Toggle switches the UI into a compact, touch-friendly scanner simulation layout suited for handheld devices |
| **Four workspace tabs** | Receiving, Cycle Count, Stock Adjustments, Order Fulfilment |

---

### 🔐 Admin Governance Portal

| Feature | Detail |
| :--- | :--- |
| **Employee registration modal** | Full form: name, email, sector (Store Management / Cashier & Front-of-House / Warehouse & Logistics / Procurement & Supply Chain / System Administration), role, temporary password |
| **Employee search & sector filter** | Search by name/email combined with sector dropdown filter |
| **Inline employee edit** | Click Edit on any employee row to update their name, email, sector, role, or status in-place |
| **Force password reset** | One-click button sets the employee's `requiresPasswordSetup` flag — they will be prompted to change password on next login |
| **MFA revocation** | Admin can revoke an employee's TOTP secret; they can re-enroll on next login |
| **Account deactivation** | Delete action soft-deactivates the account (status → INACTIVE) rather than hard-deleting — preserves audit trail |
| **Security audit log** | Immutable, append-only log of all security events: LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_CHANGED, MFA_ENROLLED, MFA_VERIFIED, EMPLOYEE_REGISTERED, EMPLOYEE_DEACTIVATED. Displays event type, severity badge, actor, description, IP address, and timestamp |
| **Warehouse facility management** | Create, edit, and delete warehouse records with ID, name, city, bin count, active SKUs, capacity %, supervisor assignment, and operational status (OPERATIONAL / STANDBY / MAINTENANCE) |
| **Read-only operational oversight** | Admin can view products, suppliers, and purchase orders without the ability to modify them — governance without operational interference |
| **Policies tab** | Displays the system's access control and security policies in human-readable format |
| **Session expiry detection** | On any 401 response, the portal auto-clears the session and returns to the login screen |

---

### 🔑 Authentication System

| Feature | Detail |
| :--- | :--- |
| **Dual-identifier login** | Accepts email address, Employee ID (`EMP-XXX-NNN`), or generic `identifier` field — any format works |
| **First-login password wizard** | New accounts have `requiresPasswordSetup: true`; a multi-step wizard enforces entropy rules before granting access |
| **Password strength rules** | Minimum 8 characters, at least one uppercase, one lowercase, one digit, one symbol — validated client and server side |
| **Email OTP verification** | 6-digit code sent via SMTP for email address confirmation; 10-minute expiry |
| **TOTP MFA enrollment** | On enrollment, server generates a random secret, returns a QR-compatible URI (`otpauth://`), and the user scans it with any authenticator app |
| **TOTP verification** | Every login with MFA enrolled requires a valid 6-digit TOTP code (30-second window, RFC 6238) verified server-side with `otplib` |
| **JWT session tokens** | 24-hour expiry; signed with `JWT_SECRET`; includes user ID, role, employeeId, name |
| **Separate JWT namespaces** | Worker portal stores token in `syncstock_worker_token`; Admin portal in `syncstock_admin_token` — cross-portal token reuse is rejected |

---



| Layer | Technology | Version |
| :--- | :--- | :--- |
| **Frontend Runtime** | React | 18 |
| **Frontend Build** | Vite (multi-page) | 5 |
| **UI Styling** | Modern CSS custom properties (light/dark) | — |
| **Backend Runtime** | Node.js | v24 |
| **Backend Framework** | Express | 4 |
| **Backend Language** | TypeScript | 5 |
| **Database** | PostgreSQL | 16 |
| **ORM** | Sequelize | 6 |
| **Authentication** | JWT (`jsonwebtoken`) | — |
| **Password Hashing** | bcryptjs | — |
| **TOTP MFA** | otplib | — |
| **Email OTP** | nodemailer | — |
| **Testing** | Node.js native test runner | v24 built-in |

---

## Repository Structure

```text
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts          # Sequelize connection setup
│   │   ├── models/
│   │   │   └── DomainModels.ts      # Sequelize model definitions
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.ts          # Users, JWT, TOTP, OTP, RBAC
│   │   │   │   └── auth.test.ts     # 11 auth & security tests
│   │   │   ├── forecasting/
│   │   │   │   ├── forecasting.ts   # Demand calc, safety stock, risk tiers
│   │   │   │   └── forecasting.test.ts  # 4 forecasting tests
│   │   │   └── procurement/
│   │   │       ├── procurement.ts   # Purchase order lifecycle, supplier ratings
│   │   │       └── procurement.test.ts  # 10 procurement tests
│   │   ├── inventory.ts             # In-memory catalogue, transactions, returns
│   │   ├── persistence.ts           # PostgreSQL sync & catalogue hydration
│   │   ├── server.ts                # Express REST API (938 lines)
│   │   ├── inventory.test.ts        # 23 inventory core tests
│   │   └── server.test.ts           # 12 REST API integration tests
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── apps/
│   │   │   ├── AdminApp.jsx         # Admin governance console
│   │   │   └── WorkerApp.jsx        # Operations console
│   │   ├── components/
│   │   │   ├── admin/               # AdminPortal, employee mgmt, warehouse CRUD
│   │   │   ├── auth/                # WorkerAuthModal, OTP, password wizard
│   │   │   ├── cashier/             # CashierWorkspace (POS, returns)
│   │   │   ├── common/              # BrandLogo.jsx, icons, status pills
│   │   │   ├── manager/             # ManagerWorkspace (KPIs, forecasts, POs)
│   │   │   └── warehouse/           # WarehouseWorkspace (receiving, cycle counts)
│   │   ├── styles.css               # Design system (light & dark mode)
│   │   ├── admin.html               # Admin portal entry point
│   │   └── index.html               # Worker operations entry point
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── package.json                     # Workspace orchestration (dev, build, test)
└── README.md
```

---

## Quick Start

### 1. Prerequisites

- **Node.js**: v18 or later (tested on v24)
- **PostgreSQL**: running on `localhost:5432` — or launch via Docker Compose:

```powershell
docker-compose up -d
```

### 2. Install Dependencies

```powershell
npm.cmd install
```

### 3. Configure Environment

Copy the example file and fill in your database credentials:

```powershell
Copy-Item backend\.env.example backend\.env
```

### 4. Start Development Servers

```powershell
npm.cmd run dev
```

Both the backend API and the Vite dev server start concurrently:

| Service | URL |
| :--- | :--- |
| Backend API | `http://localhost:4000` |
| Worker Operations Portal | `http://localhost:5175` |
| Admin Governance Portal | `http://localhost:5175/admin.html` |
| Health Check | `http://localhost:4000/api/health` |

> [!TIP]
> On Windows PowerShell, always use `npm.cmd` instead of `npm` to ensure npm scripts execute correctly.

---

## Credentials & Access

### System Administrator

> [!CAUTION]
> Admin credentials are **not** stored in this repository. Configure them via `backend/.env` before first run.

| Field | Value |
| :--- | :--- |
| Email | *(set via `ADMIN_EMAIL` in `backend/.env`)* |
| Employee ID | `EMP-ADM-001` |
| Password | *(set via `ADMIN_PASSWORD` in `backend/.env`)* |
| Portal | `http://localhost:5175/admin.html` |

The Administrator can create all other staff accounts (Managers, Cashiers, Warehouse Staff, Procurement Officers) directly within the Admin Portal. Each account receives a sector-prefixed Employee ID automatically:

| Role | Employee ID Prefix | Example |
| :--- | :--- | :--- |
| Administrator | `EMP-ADM-` | `EMP-ADM-001` |
| Manager | `EMP-MGR-` | `EMP-MGR-001` |
| Cashier | `EMP-CSH-` | `EMP-CSH-001` |
| Warehouse Staff | `EMP-WRH-` | `EMP-WRH-001` |
| Procurement Staff | `EMP-PRC-` | `EMP-PRC-001` |

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Service health status |
| `GET` | `/api/auth/demo-accounts` | None | List seeded demo accounts |
| `POST` | `/api/auth/login` | None | Authenticate — accepts `email`, `employeeId`, or `identifier` |
| `POST` | `/api/auth/set-first-password` | None | Complete first-time password setup |

### Inventory

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/inventory/workspace` | Any role | Role-scoped product catalogue |

### Sales & Returns

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/sales` | Manager, Cashier | Process POS checkout (VAT 15%, discount) |
| `POST` | `/api/returns` | Manager, Cashier | Process product return & restore stock |

### Purchase Orders

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/purchase-orders` | Manager, Procurement | List all purchase orders |
| `POST` | `/api/purchase-orders` | Manager, Procurement | Create new purchase order |
| `PATCH` | `/api/purchase-orders/:id/approve` | Manager | Approve DRAFT order |
| `PATCH` | `/api/purchase-orders/:id/send` | Manager | Mark order as sent to supplier |
| `PATCH` | `/api/purchase-orders/:id/cancel` | Manager | Cancel order |
| `PATCH` | `/api/purchase-orders/:id/receive` | Warehouse | Record stock receipt |

### Forecasting & Suppliers

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/forecast` | Manager, Procurement | Demand forecasts ranked by risk |
| `GET` | `/api/forecast/:sku` | Manager, Procurement | Single-SKU forecast detail |
| `GET` | `/api/suppliers` | Manager, Procurement | Supplier list with performance ratings |

### Online Orders

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/orders` | Manager, Warehouse | List online orders |
| `POST` | `/api/orders/reserve` | Manager | Reserve stock for order |
| `PATCH` | `/api/orders/:id/commit` | Warehouse | Commit reserved order |
| `PATCH` | `/api/orders/:id/release` | Manager | Release reservation |

### Cycle Counts

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cycle-counts` | Warehouse, Manager | List cycle count sessions |
| `POST` | `/api/cycle-counts` | Warehouse | Submit new count (discrepancy reconciliation) |

### Admin (ADMIN role only)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/employees` | Admin | List all employees |
| `PATCH` | `/api/admin/employees/:id` | Admin | Update employee details |
| `DELETE` | `/api/admin/employees/:id` | Admin | Deactivate employee account |
| `POST` | `/api/admin/employees/:id/reset-password` | Admin | Force password reset |
| `POST` | `/api/admin/employees/:id/reset-mfa` | Admin | Revoke MFA secret |
| `GET` | `/api/admin/audit-logs` | Admin | Security audit log (immutable) |
| `GET` | `/api/admin/warehouses` | Admin | List warehouse facilities |
| `POST` | `/api/admin/warehouses` | Admin | Create warehouse |
| `PATCH` | `/api/admin/warehouses/:id` | Admin | Update warehouse |
| `DELETE` | `/api/admin/warehouses/:id` | Admin | Remove warehouse |
| `GET` | `/api/admin/products` | Admin | Read-only product oversight |
| `GET` | `/api/admin/suppliers` | Admin | Read-only supplier oversight |
| `GET` | `/api/admin/purchase-orders` | Admin | Read-only procurement oversight |
| `GET` | `/api/admin/forecast` | Admin | Read-only demand forecasts |

---

## Testing & Quality Assurance

Run the complete automated test suite:

```powershell
npm.cmd test --workspace backend
```

### Test Suite Summary

| Suite | File | Tests | Coverage Areas |
| :--- | :--- | :---: | :--- |
| **Inventory Core** | `inventory.test.ts` | 23 | Sales (VAT, discount), returns, stock receiving, cycle counts, reservations, valuation metrics, low-stock detection, dashboard KPIs |
| **Procurement** | `procurement.test.ts` | 10 | PO creation, approval, dispatch, receiving (partial & full), over-receipt rejection, cancellation, auto low-stock PO, supplier ratings |
| **Forecasting** | `forecasting.test.ts` | 4 | Average daily demand, safety stock formula, reorder point, stockout risk tier (`High` / `Medium` / `Low`) |
| **Auth & Security** | `auth.test.ts` | 11 | Password strength validation, Employee ID prefixes, JWT creation/verification, RBAC permissions matrix, TOTP MFA enroll/verify, email OTP lifecycle |
| **API Integration** | `server.test.ts` | 12 | Health check, demo accounts, login validation, JWT issuance, 401/403 middleware, admin endpoints, POS checkout, returns, procurement, forecasting |
| | | **60 / 60** | **0 failures** |

> [!IMPORTANT]
> Tests run against an **in-memory** store — no live database connection required. The server binds to an ephemeral port during integration tests (set via `NODE_ENV=test`) to avoid conflicting with a running instance.

---

## Environment Variables

Configure `backend/.env` (copy from `backend/.env.example`):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `4000` | HTTP port for Express API |
| `NODE_ENV` | `development` | Runtime mode (`development` · `test` · `production`) |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | *(set in `.env`)* | Database password |
| `DB_NAME` | `inventory_db` | PostgreSQL schema / database name |
| `JWT_SECRET` | `dev-secret-key` | HMAC-SHA256 signing key for session tokens |
| `SMTP_HOST` | *(optional)* | SMTP relay for email OTP delivery |
| `SMTP_USER` | *(optional)* | SMTP username |
| `SMTP_PASSWORD` | *(optional)* | SMTP password |

> [!CAUTION]
> Never commit `backend/.env` to version control. It is listed in `.gitignore`. Use `backend/.env.example` as the template — it contains only placeholder values.

---

## Production Build

Compile TypeScript and generate optimised Vite bundles:

```powershell
npm.cmd run build
```

Outputs:
- `backend/dist/` — CommonJS bundle (Node.js)
- `frontend/dist/` — Vite multi-page bundle (`index.html` + `admin.html`, chunked JS/CSS)

---

## License

Academic project — NPRG631. All rights reserved.
