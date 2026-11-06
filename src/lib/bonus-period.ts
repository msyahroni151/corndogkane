// Bonus before this period has already been settled outside this system.
// Keep historical records intact; they must not become payable again.
export const BONUS_START_DATE = "2026-11-01";
export const bonusStartDate = () => new Date(BONUS_START_DATE + "T00:00:00.000Z");
export function isCurrentBonusDate(date: Date) {
  return date.getTime() >= bonusStartDate().getTime();
}
export function isCurrentLedgerEntry(entry: { kind: string; date: Date }) {
  return (
    !["BONUS_EARNED", "BONUS_WITHDRAWAL"].includes(entry.kind) || isCurrentBonusDate(entry.date)
  );
}
