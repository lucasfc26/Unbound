-- Who can see and join a server channel. Staff can still move a member
-- into a restricted voice room; that live presence is the only exception.
CREATE TYPE "ChannelVisibility" AS ENUM ('EVERYONE', 'MODERATORS', 'ADMINS');

ALTER TABLE "channels" ADD COLUMN "visibility" "ChannelVisibility" NOT NULL DEFAULT 'EVERYONE';
