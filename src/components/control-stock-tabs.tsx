import Link from "next/link";
export function ControlStockTabs({ tab, outletId }: { tab: string; outletId: string }) {
  return (
    <nav aria-label="Submenu Control Stok" className="min-w-0 border-b border-[#dbe7df]">
      <div className="flex gap-1 overflow-x-auto">
        {[
          ["stock", "Stok Outlet"],
          ["requests", "Permintaan & Pengiriman"],
          ["returns", "Retur Barang"],
          ["history", "Riwayat Mutasi"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={"/control-stok?" + new URLSearchParams({ tab: key, outlet: outletId })}
            prefetch={false}
            aria-current={tab === key ? "page" : undefined}
            className={`shrink-0 rounded-t-xl border-b-2 px-4 py-3 text-xs font-semibold ${tab === key ? "border-[#44785a] bg-[#e4f0e7] text-[#244c3a]" : "border-transparent text-slate-500"}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
