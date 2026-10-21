"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { UiIcon } from "@/components/ui-icon";
import "./password-input.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  visibilityLabel?: string;
};
export function PasswordInput({ id, visibilityLabel = "password", ...props }: Props) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const label = `${visible ? "Sembunyikan" : "Tampilkan"} ${visibilityLabel}`;
  return (
    <span className="password-control">
      <input {...props} id={inputId} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-visibility-toggle"
        aria-label={label}
        aria-controls={inputId}
        aria-pressed={visible}
        title={label}
        disabled={props.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible(!visible)}
      >
        <UiIcon name={visible ? "eye-off" : "eye"} size={19} />
      </button>
    </span>
  );
}
