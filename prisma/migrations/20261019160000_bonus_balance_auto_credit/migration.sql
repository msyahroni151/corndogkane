-- The owner explicitly enabled immediate accrual for automatic outlet bonuses.
-- Preserve rejected/manual decisions and every original amount/source/date.
UPDATE "money_entries" SET "status"='APPROVED', "decidedById"="createdById", "decidedAt"=CURRENT_TIMESTAMP, "decisionNotes"='Bonus otomatis langsung masuk saldo crew.'
WHERE "kind"='BONUS_EARNED' AND "status"='PENDING' AND "amount">0 AND "postingKey" LIKE 'OUTLET-BONUS:%';
