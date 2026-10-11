-- Multi-tenant database hardening.
-- The API must set `SET LOCAL app.company_id = '<verified-token-company-id>'`
-- inside every transaction before enabling these policies in production.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS "subscriptionStatus" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';

CREATE OR REPLACE FUNCTION app_current_company_id()
RETURNS VARCHAR
LANGUAGE SQL
STABLE
AS $$ SELECT NULLIF(current_setting('app.company_id', true), '') $$;

-- Run this section after the application has been updated to set app.company_id
-- on every database transaction. It is intentionally separate so a deployment
-- cannot accidentally lock out all traffic while the application is still on
-- the legacy connection path.
--
-- DO $$ DECLARE table_name TEXT;
-- BEGIN
--   FOREACH table_name IN ARRAY ARRAY[
--     'users', 'products', 'suppliers', 'warehouses', 'inventory_items',
--     'stock_movements', 'sales', 'sale_items', 'returns', 'return_items',
--     'purchase_orders', 'purchase_order_items', 'cycle_counts',
--     'customer_orders', 'customer_order_items', 'inventory_reservations',
--     'security_audit_logs', 'company_policies'
--   ] LOOP
--     EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
--     EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
--     EXECUTE format(
--       'CREATE POLICY tenant_isolation ON %I USING ("companyId" = app_current_company_id()) WITH CHECK ("companyId" = app_current_company_id())',
--       table_name
--     );
--   END LOOP;
-- END $$;
