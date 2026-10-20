"use client";
export default function WorkspaceError({ retry }: { retry: () => void }) {
  return (
    <div className="panel p-8">
      <h2 className="text-xl font-bold">Data belum dapat dimuat</h2>
      <p className="mt-3 text-sm text-slate-500">
        Pastikan database lokal sudah aktif melalui Mulai-Database.cmd, lalu coba lagi.
      </p>
      <button className="button-primary mt-6" onClick={retry}>
        Coba lagi
      </button>
    </div>
  );
}
