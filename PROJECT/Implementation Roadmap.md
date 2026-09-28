# Implementation Roadmap

Project: Cloud-Native Inventory Management System for SME Retail Businesses

Source documents reviewed:
- `Documents/PROJECT PROBLEM STATEMEN1.docx`
- `Documents/Inventory System Development Plan.docx`
- `Documents/System Design Specification.docx`
- `Group Names.txt`

## 1. Implementation Strategy

The project should be implemented in staged releases. The documents describe a full cloud-native, microservices-based inventory platform with real-time synchronization, forecasting, supplier procurement, integrations, mobile warehouse workflows, security, and auditability. To make the project achievable, the first release should prove the core business value before expanding into the complete architecture.

The implementation should therefore follow this order:

1. Build a functional MVP with authentication, inventory tracking, sales/returns, receiving, stock movement logs, and dashboards.
2. Add order lifecycle handling, stock reservation, low-stock alerts, and purchase order workflows.
3. Add forecasting, reorder recommendations, supplier scoring, and reporting.
4. Add event-driven integration, external adapters, observability, deployment automation, and final operational readiness.

## 2. Proposed Technology Stack

- Frontend: React web application for managers, admins, and cashiers.
- Mobile workflow: Responsive/mobile-first React screens for warehouse staff. React Native can be added later if a separate mobile app is required.
- Backend: Node.js with Express or NestJS for service APIs.
- Database: PostgreSQL, following the document's selected technology choice.
- Cache: Redis for fast stock availability checks, added after the MVP.
- Event bus: Kafka, Redpanda, or a lighter message broker for local development; AWS EventBridge can be used for cloud deployment.
- Authentication: JWT-based login first, then MFA/TOTP in a later security hardening phase.
- Deployment: Docker Compose for development, then Kubernetes/cloud deployment if required for final demonstration.
- CI/CD: GitHub Actions for linting, testing, builds, and deployment checks.

## 3. Phase 0: Project Setup and Technical Foundation

Goal: Create the working development base.

Deliverables:
- Repository structure for frontend, backend services, shared types, database migrations, and documentation.
- Development environment using Docker Compose.
- PostgreSQL database with migration tooling.
- Seed data for products, categories, suppliers, inventory items, users, and sample orders.
- Coding standards, branch workflow, and issue/task board.
- Initial CI pipeline for tests and builds.

Exit criteria:
- A developer can clone the repo, run one setup command, and open the app locally.
- Database migrations and seed data run reliably.

## 4. Phase 1: Core MVP

Goal: Deliver the smallest usable inventory system that addresses the main problem: inaccurate, manual stock control.

Features:
- Login and role-based navigation for Admin, Store Manager, Cashier, and Warehouse Staff.
- Product catalogue with SKU, barcode, category, supplier, unit cost, unit price, reorder point, and reorder quantity.
- Inventory records by warehouse and bin location.
- Stock movement log for SALE, RETURN, RECEIVE, and AUDIT_ADJUSTMENT.
- Cashier sales screen that scans/searches products, validates available stock, and deducts inventory.
- Product returns workflow that restores stock and records return reason.
- Receiving goods workflow that updates stock from supplier deliveries.
- Cycle count workflow with discrepancy logging and manager approval.
- Manager dashboard with low-stock count, daily sales, stock-on-hand, pending receiving tasks, and top products.

Backend modules:
- Auth/User module.
- Inventory module.
- Sales module.
- Stock movement audit module.
- Dashboard summary endpoints.

Exit criteria:
- A five-item sale can be completed and stock is deducted correctly.
- A return restores inventory and creates an immutable stock movement record.
- A receiving task adds stock to the correct product/bin.
- Managers can see low-stock and stock movement data.

## 5. Phase 2: Procurement and Replenishment

Goal: Move from basic tracking to proactive stock control.

Features:
- Supplier management with lead time, contact details, and rating.
- Low-stock alert generation based on reorder point.
- Draft purchase order creation from low-stock items.
- Manager approval/rejection of purchase orders.
- Purchase order status lifecycle: Draft, Approved, Sent, Partially Received, Received, Cancelled.
- Supplier performance tracking for late, short, or damaged deliveries.

Backend modules:
- Supplier/procurement module.
- Purchase order module.
- Notification module for low-stock and receiving alerts.

Exit criteria:
- The system can detect a low-stock SKU and generate a draft purchase order.
- A manager can approve a purchase order.
- Receiving against a purchase order updates stock and closes or partially closes the order.

## 6. Phase 3: Order Lifecycle and Reservation Logic

Goal: Support online and omnichannel orders without overselling.

Features:
- Sales order state machine: Pending, Paid, Picking, Shipped, Delivered, Cancelled.
- Order items with point-in-time SKU, name, quantity, and unit price snapshots.
- Stock reservation using `qty_reserved`.
- Commit stock on payment/fulfilment success.
- Release reservations on payment failure, cancellation, or timeout.
- Picking task generation for warehouse staff.

Architecture improvement:
- Start separating Inventory, Order Management, and Procurement into clear service boundaries.
- Introduce asynchronous domain events internally, even if first implemented with a database-backed event table.

Exit criteria:
- Two simultaneous orders cannot sell the final available unit twice.
- Cancelling an order releases reserved stock.
- Warehouse staff can see and complete picking tasks.

## 7. Phase 4: Analytics, Forecasting, and Reporting

Goal: Turn inventory history into management insight.

Features:
- Inventory turnover report.
- Stockout risk report.
- Sales trends by product/category/date.
- Forecasting using simple moving average and exponential smoothing first.
- Reorder point calculation:
  - Reorder Point = Average Daily Demand x Lead Time Days + Safety Stock
- EOQ-based suggested order quantity.
- Recommended purchase orders report with manager approval actions.

Implementation note:
- Start with explainable forecasting models before adding heavier ML. This fits the SME usability goal and makes the project easier to test and present.

Exit criteria:
- Managers can view forecasted demand for selected SKUs.
- The system recommends reorder quantities using historical sales and supplier lead time.
- Forecast recommendations can be converted into purchase orders.

## 8. Phase 5: Integration and Event-Driven Architecture

Goal: Move the application closer to the architecture promised in the documents.

Features:
- API gateway layer for authentication, routing, and rate limits.
- Event bus for stock, order, payment, receiving, return, and notification events.
- Standard domain events such as:
  - `OrderCreated`
  - `StockReserved`
  - `StockCommitted`
  - `StockUnavailable`
  - `PaymentSucceeded`
  - `PaymentFailed`
  - `StockReturned`
  - `GoodsReceived`
  - `LowStockDetected`
- Integration adapter pattern for external systems.
- Prototype adapters for one POS/e-commerce system and one accounting/export integration.

Exit criteria:
- Inventory and orders communicate through events for the critical order-placement flow.
- Failed reservations trigger compensating actions.
- At least one external integration/export path is demonstrated.

## 9. Phase 6: Security, Auditability, and Compliance Hardening

Goal: Meet the security and accountability expectations from the design documents.

Features:
- Fine-grained RBAC permissions.
- MFA/TOTP setup and reset workflow.
- Immutable audit logs for user actions and inventory movements.
- TLS-ready deployment configuration.
- Password reset and account deactivation.
- Tenant-aware data model if multi-tenant demonstration is required.
- Input validation, rate limiting, and secure error handling.

Exit criteria:
- Admins can manage users and roles.
- Permission changes and stock changes are traceable to user and timestamp.
- Sensitive actions require the correct role.

## 10. Phase 7: Deployment, Testing, and Operational Readiness

Goal: Prepare for final demonstration and production-style deployment.

Deliverables:
- Automated test suite covering inventory, sales, returns, receiving, reservations, and purchase orders.
- End-to-end tests for cashier, warehouse, manager, and admin workflows.
- Dockerized deployment.
- Health checks for services.
- Structured logging and basic metrics.
- Backup and restore procedure for PostgreSQL.
- Data migration template for legacy spreadsheets.
- Role-based user guide/training notes.

Exit criteria:
- The system can be deployed cleanly from a fresh environment.
- Demo data can be imported.
- Critical workflows pass automated and manual tests.
- The team can demonstrate a 48-hour onboarding scenario using scripted setup, import, validation, and go-live steps.

## 11. Suggested Team Allocation

- Sibusiso Mathonsi: Architecture lead, backend service structure, inventory/order consistency.
- Kegoikantse Sebetseba: Frontend manager/admin dashboards and reports.
- Lebogang Malatjie: Warehouse/cashier workflows, receiving, returns, cycle count UX.
- Agcobile Qabo: Database schema, migrations, testing, documentation, deployment support.

The team can rotate responsibilities, but each phase should have one clear owner responsible for merging and demo readiness.

## 12. Milestone Timeline

Recommended academic build timeline:

- Week 1: Project setup, architecture decisions, database schema, seed data.
- Week 2: Authentication, roles, product catalogue, inventory records.
- Week 3: Sales, returns, receiving, stock movements.
- Week 4: Cycle counts, dashboard MVP, audit trail.
- Week 5: Suppliers, low-stock alerts, purchase orders.
- Week 6: Order lifecycle, reservation logic, picking tasks.
- Week 7: Forecasting, reorder recommendations, reports.
- Week 8: Event bus, integration prototype, notifications.
- Week 9: Security hardening, MFA, RBAC refinement.
- Week 10: Testing, deployment, migration scripts, documentation, final demo.

## 13. Main Risks and Mitigations

- Scope creep: Build the MVP first before full microservices and ML.
- Data integrity bugs: Use transactions, optimistic locking, and stock movement tests from the start.
- Overcomplicated architecture: Use modular services locally first, then split into deployable services once workflows are stable.
- Weak demo readiness: Maintain seed data and scripted demo scenarios throughout development.
- Forecasting complexity: Begin with simple moving average and exponential smoothing before advanced ML.
- User adoption risk: Keep cashier and warehouse screens barcode-first, mobile-friendly, and low text.

## 14. Final Target Demo Scenario

The final demonstration should show the complete business story:

1. Admin creates users and assigns roles.
2. Manager adds products, suppliers, reorder points, and initial stock.
3. Cashier completes a sale, and stock reduces immediately.
4. Cashier processes a return, and stock is restored with an audit record.
5. Warehouse receives supplier goods into a bin location.
6. Warehouse performs a cycle count and logs a discrepancy.
7. Manager sees low-stock alerts and approves a purchase order.
8. Forecasting report recommends reorder quantities.
9. An online order reserves stock, then commits or releases it based on payment outcome.
10. Audit logs prove who did what and when.

This scenario directly demonstrates the project's promised value: real-time visibility, reduced manual error, better replenishment decisions, auditability, and SME-friendly usability.
