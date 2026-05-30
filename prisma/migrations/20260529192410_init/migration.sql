-- CreateEnum
CREATE TYPE "TrackingReason" AS ENUM ('MENTIONED', 'THREAD_REPLY', 'DIRECT_MESSAGE', 'ACTION_PHRASE');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'DONE', 'SNOOZED');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_items" (
    "id" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageTz" TEXT NOT NULL,
    "threadTs" TEXT,
    "authorId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "slackLink" TEXT NOT NULL,
    "reason" "TrackingReason" NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_items_workspaceId_userId_messageTz_key" ON "tracked_items"("workspaceId", "userId", "messageTz");

-- AddForeignKey
ALTER TABLE "tracked_items" ADD CONSTRAINT "tracked_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
