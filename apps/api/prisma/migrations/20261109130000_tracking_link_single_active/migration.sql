-- At most one non-revoked tracking link per intervention (prisma cannot express partial indexes).
CREATE UNIQUE INDEX "TrackingLink_interventionId_active_key" ON "TrackingLink"("interventionId") WHERE "revokedAt" IS NULL;
