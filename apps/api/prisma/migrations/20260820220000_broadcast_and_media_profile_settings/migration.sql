ALTER TABLE "user_settings"
  ADD COLUMN "mediaProfile" TEXT NOT NULL DEFAULT 'quality',
  ADD COLUMN "broadcastMode" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "broadcastResolution" TEXT NOT NULL DEFAULT '720p',
  ADD COLUMN "broadcastMaxBitrateKbps" INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN "broadcastCodec" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "broadcastTransport" TEXT NOT NULL DEFAULT 'auto';
