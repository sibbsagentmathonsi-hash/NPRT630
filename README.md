# Cloud-Native Inventory Management System

This project is a working demo monorepo for the SME retail inventory management system described in the roadmap. It includes:

- React frontend for managers, cashiers, and warehouse staff
- Node.js + Express backend API
- PostgreSQL and Redis via Docker Compose, with in-memory fallback data for easy demos
- Product catalogue, inventory, sales, returns, receiving, cycle counts, procurement, forecasts, reserved online orders, and stock movement audit trails

## Project structure

- `frontend/` — Vite React application
- `backend/` — Express API service
- `docker-compose.yml` — local PostgreSQL and Redis containers

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local infrastructure:
   ```bash
   docker compose up -d
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open the frontend at http://localhost:5173
5. API health check is available at http://localhost:4000/api/health

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@retail.local` | `admin123` |
| Store Manager | `manager@retail.local` | `manager123` |
| Cashier | `cashier@retail.local` | `cashier123` |
| Warehouse Staff | `warehouse@retail.local` | `warehouse123` |

## Demo workflows

- Manager dashboard with daily sales, low stock, reserved units, inventory value, movement history, and stockout risk
- Product catalogue with SKU, barcode, supplier, bin, reorder, cost, price, and availability fields
- Cashier sale basket that supports a five-item sale and validates stock before deduction
- Product returns that restore stock and write an audit movement
- Warehouse receiving and cycle count adjustments
- Low-stock purchase order generation, approval, sending, cancellation, and PO receiving
- Forecasting based on recent sales demand, supplier lead time, safety stock, and recommended order quantity
- Online order reservation, commit, and release flows that protect available stock

## Environment

Create `.env` if you need custom values:

```env
PORT=4000
JWT_SECRET=change-me-for-production
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inventory_db
```

## Production-oriented roadmap

This implementation stays intentionally modular so it can be extended into the production-oriented roadmap: persistent transactional repositories, stronger RBAC permissions, MFA, event-driven integration, external POS/accounting adapters, and Kubernetes/cloud deployment.
