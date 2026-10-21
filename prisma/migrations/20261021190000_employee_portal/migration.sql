
CREATE TABLE portal_leaves (
 id TEXT PRIMARY KEY, "requestKey" TEXT NOT NULL UNIQUE, "employeeId" TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('CUTI','IZIN','LIBUR','SAKIT')), "startDate" DATE NOT NULL, "endDate" DATE NOT NULL CHECK("endDate">="startDate"), reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
 "createdById" TEXT NOT NULL, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "decisionNotes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX portal_leaves_employee_dates ON portal_leaves("employeeId","startDate","endDate");
CREATE TABLE portal_faces (
 "employeeId" TEXT PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT ON UPDATE CASCADE, descriptor JSONB NOT NULL, photo BYTEA NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')), "requestedById" TEXT NOT NULL, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "decisionNotes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE portal_challenges (
 id TEXT PRIMARY KEY, "employeeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "scheduleId" TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('IN','OUT')),
 "scheduleVersion" TEXT NOT NULL, "attendanceVersion" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "verifiedAt" TIMESTAMP(3), "consumedAt" TIMESTAMP(3), attempts INTEGER NOT NULL DEFAULT 0, "facePhoto" BYTEA, distance DOUBLE PRECISION,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX portal_challenges_user_time ON portal_challenges("userId","createdAt");
CREATE TABLE portal_captures (
 id TEXT PRIMARY KEY, "challengeId" TEXT NOT NULL UNIQUE, "employeeId" TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "scheduleId" TEXT NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('IN','OUT')), "scheduleVersion" TEXT NOT NULL, "attendanceVersion" TEXT NOT NULL,
 "facePhoto" BYTEA NOT NULL, "cartPhoto" BYTEA NOT NULL, distance DOUBLE PRECISION NOT NULL, "capturedAt" TIMESTAMP(3) NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')), "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "decisionNotes" TEXT);
CREATE INDEX portal_captures_employee_time ON portal_captures("employeeId","capturedAt");
CREATE UNIQUE INDEX portal_capture_active_kind ON portal_captures("scheduleId",kind) WHERE status IN ('PENDING','APPROVED');
INSERT INTO access_roles(id,name,description,permissions,"updatedAt") VALUES ('ROLE-PORTAL-KARYAWAN','Portal Karyawan','Akses data pribadi karyawan dan pengajuan mandiri.','{"portal-karyawan":true}',CURRENT_TIMESTAMP);
