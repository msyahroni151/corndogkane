export function DemoNotice() {
  if (process.env.HRIS_DEMO_MODE !== "1") return null;
  return (
    <div
      role="note"
      className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"
    >
      <strong>MODE DEMO</strong> · Seluruh data adalah contoh. Gunakan data contoh saat mencoba;
      perubahan hanya tersimpan di lingkungan demo.
    </div>
  );
}
