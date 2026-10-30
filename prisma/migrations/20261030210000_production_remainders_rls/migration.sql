-- Keep production remainder records behind server-side access, consistent with other inventory tables.
ALTER TABLE "production_remainders" ENABLE ROW LEVEL SECURITY;
