-- Direct messages reuse the Channel/Message tables with type DM, a nullable
-- serverId, a unique dmKey for the participant pair, and ChannelMember rows
-- for access + unread receipts.

ALTER TYPE "ChannelType" ADD VALUE 'DM';

ALTER TABLE "channels" ALTER COLUMN "serverId" DROP NOT NULL;

ALTER TABLE "channels" ADD COLUMN "dmKey" TEXT;

CREATE UNIQUE INDEX "channels_dmKey_key" ON "channels"("dmKey");

CREATE TABLE "channel_members" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_members_channelId_userId_key" ON "channel_members"("channelId", "userId");

CREATE INDEX "channel_members_userId_idx" ON "channel_members"("userId");

ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
