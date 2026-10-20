"use client";
import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { dateFromDisplay, dateToDisplay } from "@/lib/local-date";

type Props = InputHTMLAttributes<HTMLInputElement>;

/** Form payloads keep ISO dates and HH:mm, independently of browser locale. */
export function LocalInput(props: Props) {
  if (props.type === "date") return <DateInput {...props} />;
  if (props.type === "time")
    return (
      <input
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="HH:mm"
        maxLength={5}
        pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
        title="Jam WIB, format 24 jam (contoh 14:00)"
        onChange={(event) => {
          const input = event.currentTarget;
          const raw = input.value;
          const digitsBeforeCursor = raw
            .slice(0, input.selectionStart ?? raw.length)
            .replace(/\D/g, "").length;
          const digits = raw.replace(/\D/g, "").slice(0, 4);
          const formatted = digits.length > 2 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits;
          input.value = formatted;
          const cursor = Math.min(
            formatted.length,
            digitsBeforeCursor + (digitsBeforeCursor > 2 ? 1 : 0),
          );
          input.setSelectionRange(cursor, cursor);
          props.onChange?.(event);
        }}
      />
    );
  return <input {...props} />;
}

function DateInput({
  value,
  defaultValue,
  name,
  onChange,
  min,
  max,
  required,
  disabled,
  readOnly,
  className,
  ...props
}: Props) {
  const initial = String(value ?? defaultValue ?? "");
  const [draft, setDraft] = useState({ iso: initial, text: dateToDisplay(initial) });
  const iso = value !== undefined ? String(value) : draft.iso;
  const text = iso === draft.iso ? draft.text : dateToDisplay(iso);
  const visible = useRef<HTMLInputElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const parsed = dateFromDisplay(text);
    const error =
      text && !parsed
        ? "Gunakan tanggal yang valid dengan format DD/MM/YYYY."
        : parsed && min && parsed < String(min)
          ? `Tanggal paling awal ${dateToDisplay(String(min))}.`
          : parsed && max && parsed > String(max)
            ? `Tanggal paling akhir ${dateToDisplay(String(max))}.`
            : "";
    visible.current?.setCustomValidity(error);
  }, [text, min, max]);

  function change(event: ChangeEvent<HTMLInputElement>, nextIso: string, nextText: string) {
    setDraft({ iso: nextIso, text: nextText });
    // Existing form handlers receive the same ISO value as a native date input.
    if (hidden.current) {
      hidden.current.value = nextIso;
      onChange?.({ ...event, target: hidden.current, currentTarget: hidden.current });
    }
  }
  return (
    <span className="relative flex min-w-0 items-center">
      <input
        {...props}
        ref={visible}
        type="text"
        name={undefined}
        value={text}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
        title="Tanggal/bulan/tahun, contoh 15/10/2026"
        className={`${className || ""} w-full pr-10`}
        onChange={(e) => change(e, dateFromDisplay(e.target.value), e.target.value)}
      />
      <input ref={hidden} type="hidden" name={name} value={iso} disabled={disabled} readOnly />
      {!readOnly && (
        <>
          <input
            ref={picker}
            type="date"
            value={iso}
            min={min}
            max={max}
            disabled={disabled}
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
            onChange={(e) => change(e, e.target.value, dateToDisplay(e.target.value))}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="Pilih tanggal"
            title="Pilih tanggal"
            className="absolute right-2 rounded p-1 text-slate-500 hover:text-emerald-700 disabled:opacity-40"
            onClick={() => {
              if (picker.current?.showPicker) picker.current.showPicker();
              else visible.current?.focus();
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 11h18" />
            </svg>
          </button>
        </>
      )}
    </span>
  );
}
