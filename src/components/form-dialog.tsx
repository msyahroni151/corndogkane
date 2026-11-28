"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import "./form-dialog.css";

const DialogContext = createContext<(() => void) | undefined>(undefined);
let openDialogCount = 0;
let previousBodyOverflow = "";
export function useCloseFormDialog() {
  return useContext(DialogContext);
}

export function FormDialog({
  title,
  trigger,
  children,
  initiallyOpen = false,
  cancelRoute,
  wide = false,
  extraWide = false,
  compact = false,
  subtitle,
  danger = false,
  triggerClassName,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  initiallyOpen?: boolean;
  cancelRoute?: string;
  wide?: boolean;
  extraWide?: boolean;
  compact?: boolean;
  subtitle?: string;
  danger?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const dialog = useRef<HTMLDialogElement>(null);
  const triggerButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const router = useRouter();
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    element.showModal();
    if (openDialogCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogCount += 1;
    return () => {
      element.close();
      openDialogCount -= 1;
      if (openDialogCount === 0) document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    triggerButton.current?.focus();
  };
  const cancel = () => {
    if (dialog.current?.querySelector('form[aria-busy="true"]')) return;
    close();
    if (cancelRoute) router.replace(cancelRoute);
  };
  return (
    <>
      <button
        ref={triggerButton}
        type="button"
        className={triggerClassName ?? ("button-primary" + (danger ? " button-danger" : ""))}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </button>
      {open && (
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          onCancel={(event) => {
            event.preventDefault();
            cancel();
          }}
          className={`form-dialog m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/45 ${compact ? "max-w-[480px]" : extraWide ? "max-w-[1500px]" : wide ? "max-w-5xl" : "max-w-3xl"}`}
        >
          <div className="form-dialog-heading sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <h2 id={titleId} className={compact ? "text-sm font-bold" : "text-xl font-bold"}>
                {title}
              </h2>
              {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
            </div>
            <button
              type="button"
              className={
                compact
                  ? "rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-50"
                  : "button-secondary"
              }
              onClick={cancel}
              onPointerDown={(event) => event.preventDefault()}
              aria-label="Tutup popup"
            >
              {compact ? "\u00d7" : "Tutup"}
            </button>
          </div>
          <DialogContext.Provider value={close}>
            <div className="form-dialog-content [&_.panel]:mt-0 [&_.panel]:rounded-none [&_.panel]:border-0 [&_.panel]:shadow-none">
              {children}
            </div>
          </DialogContext.Provider>
        </dialog>
      )}
    </>
  );
}
