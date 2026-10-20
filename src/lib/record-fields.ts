import type { FormState } from "@/lib/form-state";
export type RecordField = {
  key: string;
  label: string;
  type?: "text" | "date" | "color";
  required?: boolean;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
  suggestions?: string[];
  defaultValue?: string;
  help?: string;
};
export type SaveRecordAction = (previous: FormState, form: FormData) => Promise<FormState>;
