"use client";
import { useEffect, useRef, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
> & {
  value: string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
};
/** Show Indonesian thousands separators while submitting integer rupiah. */
export function RupiahInput({
  name,
  value,
  onValueChange,
  min = 0,
  max = 1_000_000_000,
  disabled,
  ...props
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const amount = Number(value);
    inputRef.current?.setCustomValidity(
      value && amount < min
        ? `Nominal minimal Rp ${min.toLocaleString("id-ID")}.`
        : value && amount > max
          ? `Nominal maksimal Rp ${max.toLocaleString("id-ID")}.`
          : "",
    );
  }, [value, min, max]);
  return (
    <>
      <input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={value.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
        onChange={(event) => {
          const input = event.currentTarget;
          const digitsBeforeCursor = input.value
            .slice(0, input.selectionStart ?? input.value.length)
            .replace(/\D/g, "").length;
          const raw = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
          const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          onValueChange(raw);
          input.value = formatted;
          let cursor = 0,
            digits = 0;
          while (cursor < formatted.length && digits < digitsBeforeCursor) {
            if (/\d/.test(formatted[cursor])) digits++;
            cursor++;
          }
          input.setSelectionRange(cursor, cursor);
        }}
      />
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
    </>
  );
}
