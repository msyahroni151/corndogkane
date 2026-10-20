export const APP_TIME_ZONE = "Asia/Jakarta";

// Civil dates remain ISO in storage; only the visible order changes.
export function dateToDisplay(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}
export function dateFromDisplay(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match || Number(match[3]) < 1000) return "";
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : "";
}
