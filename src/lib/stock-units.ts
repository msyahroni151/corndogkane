export const defaultStockUnits = ["PCS", "GRAM", "ML"] as const;
export function normalizeInputUnit(value: unknown): string {
  const unit = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return (
    (
      {
        G: "GRAM",
        GR: "GRAM",
        GRAM: "GRAM",
        L: "LITER",
        LTR: "LITER",
        LITRE: "LITER",
        PC: "PCS",
        PIECE: "PCS",
        PIECES: "PCS",
      } as Record<string, string>
    )[unit] || unit
  );
}
export function normalizeStockUnit(value: unknown): string {
  const unit = normalizeInputUnit(value);
  return unit === "KG" ? "GRAM" : unit === "LITER" ? "ML" : unit;
}
export const validStockUnit = (unit: string) =>
  /^[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*$/.test(unit) && unit.length <= 24;
