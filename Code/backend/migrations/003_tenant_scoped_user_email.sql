-- Remove obsolete global email uniqueness so the company-scoped indexes match
-- the current user model. Preserve all company-scoped and other user indexes.
DO $$
DECLARE
  unique_constraint RECORD;
  unique_index RECORD;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RETURN;
  END IF;

  FOR unique_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (email)'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', unique_constraint.conname);
  END LOOP;

  FOR unique_index IN
    SELECT ns.nspname AS schema_name, index_class.relname AS index_name
    FROM pg_index AS index_info
    JOIN pg_class AS table_class ON table_class.oid = index_info.indrelid
    JOIN pg_namespace AS ns ON ns.oid = table_class.relnamespace
    JOIN pg_class AS index_class ON index_class.oid = index_info.indexrelid
    JOIN pg_attribute AS email_column
      ON email_column.attrelid = index_info.indrelid
      AND email_column.attname = 'email'
      AND email_column.attnum = index_info.indkey[0]
    WHERE index_info.indrelid = 'public.users'::regclass
      AND index_info.indisunique
      AND index_info.indnatts = 1
      AND index_info.indnkeyatts = 1
      AND index_info.indexprs IS NULL
      AND index_info.indpred IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_info
        WHERE constraint_info.conindid = index_info.indexrelid
      )
  LOOP
    EXECUTE format('DROP INDEX %I.%I', unique_index.schema_name, unique_index.index_name);
  END LOOP;
END
$$;
