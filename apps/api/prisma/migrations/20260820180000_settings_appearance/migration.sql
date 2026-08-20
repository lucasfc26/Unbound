-- Appearance prefs (tema/densidade) live on the same user_settings row as
-- profile/privacy/voice. Also tighten the RLS write policies so a missing
-- session GUC can't slip through as an empty string.

ALTER TABLE "user_settings"
  ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'dark',
  ADD COLUMN "density" TEXT NOT NULL DEFAULT 'normal';

DROP POLICY IF EXISTS "user_settings_insert" ON "user_settings";
DROP POLICY IF EXISTS "user_settings_update" ON "user_settings";
DROP POLICY IF EXISTS "user_settings_delete" ON "user_settings";

CREATE POLICY "user_settings_insert" ON "user_settings"
  FOR INSERT
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );

CREATE POLICY "user_settings_update" ON "user_settings"
  FOR UPDATE
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );

CREATE POLICY "user_settings_delete" ON "user_settings"
  FOR DELETE
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );
