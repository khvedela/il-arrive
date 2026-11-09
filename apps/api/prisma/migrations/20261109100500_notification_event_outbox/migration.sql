ALTER TABLE "InterventionEvent" ADD COLUMN "notificationProcessedAt" TIMESTAMP(3);
CREATE INDEX "InterventionEvent_notificationProcessedAt_createdAt_idx" ON "InterventionEvent"("notificationProcessedAt", "createdAt");
