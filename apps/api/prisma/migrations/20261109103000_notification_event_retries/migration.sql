ALTER TABLE "InterventionEvent"
  ADD COLUMN "notificationNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "notificationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notificationLastError" TEXT;

DROP INDEX "InterventionEvent_notificationProcessedAt_createdAt_idx";
CREATE INDEX "InterventionEvent_notification_retry_idx"
  ON "InterventionEvent"("notificationProcessedAt", "notificationNextAttemptAt", "createdAt", "id");
