-- Local and CI only. Production roles get their passwords from the secret store.
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['identity','catalog','lead','listing','billing','notification','handshake','kit_test']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_' || s) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', 'svc_' || s, 'svc_' || s);
    END IF;
    EXECUTE format('ALTER ROLE %I SET search_path = %I, public', 'svc_' || s, s);
  END LOOP;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['identity','catalog','lead','listing','billing','notification','handshake']
  LOOP
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', s, 'svc_' || s);
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
  END LOOP;
END $$;
