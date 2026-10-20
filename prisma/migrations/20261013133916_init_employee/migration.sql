-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "nik" TEXT,
    "fullName" TEXT NOT NULL,
    "employeeCode" TEXT,
    "department" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "supervisorId" TEXT,
    "supervisorName" TEXT,
    "workPattern" TEXT,
    "employmentStatus" TEXT,
    "salaryBasis" TEXT,
    "joinedAt" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "leftAt" DATE,
    "phone" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_nik_key" ON "employees"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE INDEX "employees_department_active_idx" ON "employees"("department", "active");
