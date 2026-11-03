-- Additive change: existing schedule and payroll records remain intact.
ALTER TYPE "ScheduleStatus" ADD VALUE IF NOT EXISTS 'OPENINGAN';
