"use client";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import "./editable-combobox.css";
type Choice = string | { value: string; label: string };
type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "list"
> & {
  options: readonly Choice[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};
export function EditableCombobox({
  options,
  value,
  defaultValue = "",
  onValueChange,
  onFocus,
  onBlur,
  onKeyDown,
  className = "",
  disabled,
  readOnly,
  ...props
}: Props) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [searching, setSearching] = useState(false),
    [active, setActive] = useState(-1);
  const [position, setPosition] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const current = value ?? draft;
  const unique = new Map<string, { value: string; label: string }>();
  for (const choice of options) {
    const item = typeof choice === "string" ? { value: choice, label: choice } : choice;
    if (item.value.trim() && !unique.has(item.value.trim().toLowerCase()))
      unique.set(item.value.trim().toLowerCase(), item);
  }
  const visible = [...unique.values()].filter(
    (choice) =>
      !searching ||
      choice.label.toLowerCase().includes(current.trim().toLowerCase()) ||
      choice.value.toLowerCase().includes(current.trim().toLowerCase()),
  );
  const update = (next: string) => {
    if (value === undefined) setDraft(next);
    onValueChange?.(next);
  };
  const select = (next: string) => {
    if (input.current?.matches(":disabled") || readOnly) return;
    update(next);
    setOpen(false);
    setActive(-1);
  };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const below = viewportTop + viewportHeight - rect.bottom - 12,
        above = rect.top - viewportTop - 12;
      const up = below < 160 && above > below;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: Math.min(rect.width, window.innerWidth - 16),
        ...(up ? { bottom: window.innerHeight - rect.top + 5 } : { top: rect.bottom + 5 }),
        maxHeight: Math.max(60, Math.min(240, up ? above : below)),
      });
    };
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    place();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [open]);
  useEffect(() => {
    if (open && active >= 0)
      popup.current
        ?.querySelector(`[id="${CSS.escape(id + "-" + active)}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  return (
    <div className="editable-combobox" ref={root}>
      <input
        {...props}
        ref={input}
        value={current}
        disabled={disabled}
        readOnly={readOnly}
        className={"editable-combobox-input " + className}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={
          open && active >= 0 && active < visible.length ? id + "-" + active : undefined
        }
        autoComplete="off"
        onChange={(e) => {
          update(e.target.value);
          setSearching(true);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={(e) => {
          if (!readOnly) {
            setSearching(false);
            setOpen(true);
            setActive(-1);
          }
          onFocus?.(e);
        }}
        onClick={(e) => {
          if (!readOnly && !open) {
            setSearching(false);
            setOpen(true);
            setActive(-1);
          }
          props.onClick?.(e);
        }}
        onBlur={(e) => {
          setOpen(false);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || readOnly) return;
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((old) =>
              Math.max(0, Math.min(visible.length - 1, old + (e.key === "ArrowDown" ? 1 : -1))),
            );
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (active >= 0 && visible[active]) select(visible[active].value);
            else setOpen(false);
          } else if (e.key === "Tab") setOpen(false);
        }}
      />
      {!readOnly && (
        <button
          type="button"
          disabled={disabled}
          aria-label="Tampilkan pilihan"
          aria-expanded={open}
          className="editable-combobox-toggle"
          tabIndex={-1}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            if (input.current?.matches(":disabled")) return;
            const wasOpen = open;
            input.current?.focus();
            setSearching(false);
            setActive(-1);
            setOpen(!wasOpen);
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
      {open &&
        position &&
        input.current &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="listbox"
            aria-label={props["aria-label"] || props.placeholder || "Pilihan tersedia"}
            className="editable-combobox-list"
            style={{ position: "fixed", ...position }}
          >
            {visible.length ? (
              visible.map((choice, index) => (
                <button
                  type="button"
                  role="option"
                  id={id + "-" + index}
                  key={choice.value}
                  tabIndex={-1}
                  aria-selected={choice.value.toLowerCase() === current.toLowerCase()}
                  data-highlighted={index === active || undefined}
                  className="editable-combobox-option"
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    select(choice.value);
                  }}
                >
                  {choice.label}
                </button>
              ))
            ) : (
              <p className="editable-combobox-empty">
                Tidak ada pilihan yang cocok. Teks baru tetap dapat disimpan.
              </p>
            )}
          </div>,
          input.current.closest("dialog") || document.body,
        )}
    </div>
  );
}
