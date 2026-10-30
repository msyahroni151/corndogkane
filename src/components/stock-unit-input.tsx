"use client";
import { EditableCombobox } from "@/components/editable-combobox";
import { defaultStockUnits, normalizeInputUnit, normalizeStockUnit } from "@/lib/stock-units";
export function StockUnitInput({
  value,
  onChange,
  units = [],
  name,
  receipt = false,
}: {
  value: string;
  onChange: (value: string) => void;
  units?: readonly string[];
  name?: string;
  receipt?: boolean;
}) {
  const options = [
    ...new Set([...defaultStockUnits, ...(receipt ? ["KG", "LITER"] : []), ...units]),
  ];
  return (
    <>
      <EditableCombobox
        name={name}
        value={value}
        options={options.map((unit) => ({ value: unit, label: unit.toLowerCase() }))}
        onValueChange={onChange}
        onBlur={() => onChange(receipt ? normalizeInputUnit(value) : normalizeStockUnit(value))}
        required
        maxLength={24}
        placeholder="Pilih atau ketik satuan baru..."
      />
      <span className="text-xs font-normal text-slate-500">
        Pilih satuan atau ketik yang baru, misalnya botol, lembar, atau ikat.
        {!receipt && " Kg memakai acuan gram; liter memakai acuan ml."}
      </span>
    </>
  );
}
