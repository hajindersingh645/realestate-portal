-- Local and CI only. Production roles get their passwords from the secret store.
-- Safe to run again on an existing database.
--
-- Two roles per service:
--   svc_<s>      owns the schema and its tables; runs migrations only.
--   svc_<s>_app  what the running service connects as; data access only. Migrations take
--                UPDATE and DELETE away from it on append-only tables (settings, audit logs).
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['identity','catalog','lead','listing','billing','notification','handshake','kit_test']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_' || s) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', 'svc_' || s, 'svc_' || s);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_' || s || '_app') THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', 'svc_' || s || '_app', 'svc_' || s || '_app');
    END IF;
    EXECUTE format('ALTER ROLE %I SET search_path = %I, public', 'svc_' || s, s);
    EXECUTE format('ALTER ROLE %I SET search_path = %I, public', 'svc_' || s || '_app', s);
  END LOOP;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['identity','catalog','lead','listing','billing','notification','handshake']
  LOOP
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', s, 'svc_' || s);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', s, 'svc_' || s || '_app');
    -- Covers tables the owner creates from now on. Tables that already exist are granted
    -- by the service's own migration.
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
      'svc_' || s, s, 'svc_' || s || '_app');
  END LOOP;
END $$;

SELECT 'CREATE DATABASE real_estate_test'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'real_estate_test') \gexec

\connect real_estate_test

CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['identity','catalog','lead','listing','billing','notification','handshake','kit_test']
  LOOP
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', s, 'svc_' || s);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', s, 'svc_' || s || '_app');
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
      'svc_' || s, s, 'svc_' || s || '_app');
  END LOOP;
END $$;
