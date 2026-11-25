-- Roles: patient / doctor / ASHA worker, consent-based care access
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'PATIENT';
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

ALTER TABLE "PatientProfile" ADD COLUMN "city" TEXT;
ALTER TABLE "PatientProfile" ADD COLUMN "registeredByUserId" TEXT;

ALTER TABLE "HealthRecord" ADD COLUMN "authorUserId" TEXT;

ALTER TABLE "ConsentRecord" ADD COLUMN "grantedToUserId" TEXT;
ALTER TABLE "ConsentRecord" ADD COLUMN "recordedByUserId" TEXT;
CREATE INDEX "ConsentRecord_grantedToUserId_status_idx" ON "ConsentRecord"("grantedToUserId", "status");

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "facilityName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

-- CreateTable
CREATE TABLE "AshaProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ashaId" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "phcName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AshaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AshaProfile_userId_key" ON "AshaProfile"("userId");

-- Neutral status names for existing rows
UPDATE "HealthRecord" SET "verificationStatus" = 'PROVIDER_ISSUED' WHERE "verificationStatus" = 'DEMO_VERIFIED';
UPDATE "HealthRecord" SET "source" = 'PROVIDER' WHERE "source" = 'DEMO_SEED';
UPDATE "Appointment" SET "status" = 'SCHEDULED' WHERE "status" = 'DEMO_SCHEDULED';
UPDATE "Appointment" SET "status" = 'REQUESTED' WHERE "status" = 'DEMO_REQUESTED';
