-- Backing store for the "custom" theme option: user-chosen colors for the
-- sidebar, the central screen and the font, applied on top of the dark
-- token defaults on the client.

ALTER TABLE "user_settings"
  ADD COLUMN "customColors" JSONB;
