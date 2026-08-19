-- The "maselview" role the app has connected as until now is the database's initdb
-- bootstrap role, which Postgres always makes a superuser. Superusers bypass Row-Level
-- Security unconditionally — FORCE ROW LEVEL SECURITY on user_settings has no effect on
-- them at all, so the RLS added in the previous migration was not actually being enforced.
--
-- This creates a separate, unprivileged role for the application's runtime queries to
-- connect as instead. Migrations keep running as the superuser (via DIRECT_DATABASE_URL);
-- the app's DATABASE_URL now points at this role, so RLS policies are genuinely enforced.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'maselview_app') THEN
    CREATE ROLE maselview_app LOGIN PASSWORD 'maselview_app';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE maselview TO maselview_app;
GRANT USAGE ON SCHEMA public TO maselview_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maselview_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO maselview_app;

-- So tables created by future migrations (still run as the superuser) are usable by the
-- app role without a follow-up grant every time.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO maselview_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO maselview_app;
