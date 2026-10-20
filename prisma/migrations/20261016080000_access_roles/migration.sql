CREATE TABLE "access_roles" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "systemKey" TEXT UNIQUE,
 "description" TEXT, "permissions" JSONB NOT NULL DEFAULT '{}', "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "users" ADD COLUMN "roleId" TEXT, ADD COLUMN "employeeId" TEXT,
 ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "access_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "access_roles" (id,name,"systemKey",permissions,"updatedAt") VALUES ('ROLE-OWNER','Owner','OWNER','{"dashboard": true}',CURRENT_TIMESTAMP);
INSERT INTO "access_roles" (id,name,"systemKey",permissions,"updatedAt") VALUES ('ROLE-FINANCE','Finance',NULL,'{"dashboard": true}',CURRENT_TIMESTAMP);
INSERT INTO "access_roles" (id,name,"systemKey",permissions,"updatedAt") VALUES ('ROLE-ADMIN-MALAM','Admin Operasional Malam',NULL,'{"dashboard": true}',CURRENT_TIMESTAMP);
INSERT INTO "access_roles" (id,name,"systemKey",permissions,"updatedAt") VALUES ('ROLE-PURCHASING','Purchasing',NULL,'{"dashboard": true}',CURRENT_TIMESTAMP);
INSERT INTO "access_roles" (id,name,"systemKey",permissions,"updatedAt") VALUES ('ROLE-GUDANG','Gudang',NULL,'{"dashboard": true}',CURRENT_TIMESTAMP);
INSERT INTO "access_roles" (id,name,"systemKey",permissions,"updatedAt") VALUES ('ROLE-HR','Human Resource',NULL,'{"dashboard": true}',CURRENT_TIMESTAMP);
INSERT INTO "access_roles" (id,name,"systemKey",permissions,"updatedAt") VALUES ('ROLE-CREW-OUTLET','Crew Outlet',NULL,'{"dashboard": true}',CURRENT_TIMESTAMP);
-- Existing login accounts retain their administrator access; no password/session data changes.
UPDATE "users" SET "roleId"='ROLE-OWNER';
