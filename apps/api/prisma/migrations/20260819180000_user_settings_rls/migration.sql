-- CreateEnum
CREATE TYPE "FriendRequestPrivacy" AS ENUM ('EVERYONE', 'NOBODY');

-- AlterTable: added nullable first so existing rows can be backfilled before the
-- NOT NULL + UNIQUE constraints are applied.
ALTER TABLE "users" ADD COLUMN "friendCode" TEXT;

UPDATE "users"
SET "friendCode" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE "friendCode" IS NULL;

ALTER TABLE "users" ALTER COLUMN "friendCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_friendCode_key" ON "users"("friendCode");

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "bio" VARCHAR(190),
    "pronouns" VARCHAR(40),
    "customStatus" VARCHAR(100),
    "friendRequestPrivacy" "FriendRequestPrivacy" NOT NULL DEFAULT 'EVERYONE',
    "shareTypingStatus" BOOLEAN NOT NULL DEFAULT true,
    "desktopNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notificationSound" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: the API always connects as the table-owning role, so RLS must be
-- FORCEd to actually apply to it at all (an owning role bypasses RLS by default). Reads
-- stay open — some fields (customStatus, friendRequestPrivacy) must be legible from other
-- users' requests, e.g. checking a target's friend-request privacy before a Friendship row
-- is created — but every write is pinned to whichever user id the API set via
-- set_config('app.current_user_id', ..., true) for the current transaction, so a missing
-- "WHERE userId = ..." in application code can never let one user's request mutate another
-- user's settings row.
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select" ON "user_settings"
  FOR SELECT
  USING (true);

CREATE POLICY "user_settings_insert" ON "user_settings"
  FOR INSERT
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY "user_settings_update" ON "user_settings"
  FOR UPDATE
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY "user_settings_delete" ON "user_settings"
  FOR DELETE
  USING ("userId" = current_setting('app.current_user_id', true));
