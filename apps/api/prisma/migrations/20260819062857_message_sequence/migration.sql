-- DropIndex
DROP INDEX "messages_channelId_createdAt_idx";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "sequence" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "messages_channelId_sequence_idx" ON "messages"("channelId", "sequence");
