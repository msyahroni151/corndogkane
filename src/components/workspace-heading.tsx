"use client";
import { usePathname } from "next/navigation";
import { UiIcon, type IconName } from "@/components/ui-icon";
const headings: Record<string, { title: string; description: string; icon: IconName }> = {
  "/admin-malam/dashboard": {
    title: "Dashboard Admin Operasional Malam",
    description: "Ringkasan data outlet untuk administrasi operasional malam.",
    icon: "dashboard",
  },
  "/admin-malam/monitoring-outlet": {
    title: "Kontrol Operasional Seluruh Outlet",
    description: "Monitoring Outlet · Ringkasan outlet aktif yang terdaftar di Master Outlet.",
    icon: "building",
  },
  "/pos": {
    title: "POS Kasir",
    description: "Pilih menu, susun pesanan, dan tinjau pembayaran.",
    icon: "cart",
  },
  "/template-struk": {
    title: "Template Struk",
    description: "Atur tampilan struk kasir Corndog Kane.",
    icon: "receipt",
  },
  "/retur-pembeli": {
    title: "Retur Pembeli",
    description: "Tinjau pengembalian barang dari pelanggan.",
    icon: "return",
  },
  "/admin-malam/master-akun": {
    title: "Master Akun",
    description: "Daftar akun untuk pencatatan jurnal umum operasional malam.",
    icon: "coins",
  },
  "/pos/draft": {
    title: "Draft Pesanan POS",
    description: "Pesanan sementara yang tersimpan di browser ini.",
    icon: "cart",
  },
  "/finance/budgeting-rab": {
    title: "Budgeting & RAB",
    description: "Rencana anggaran biaya dan pengendalian anggaran.",
    icon: "coins",
  },
  "/finance/pengeluaran-operasional": {
    title: "Pengeluaran Operasional",
    description: "Sabun cuci, perlengkapan, listrik, gaji & pengeluaran rutin.",
    icon: "receipt",
  },
  "/finance/jurnal-umum": {
    title: "Jurnal Umum",
    description: "Catat transaksi debit dan kredit antar akun COA.",
    icon: "receipt",
  },
  "/finance/aset-tetap": {
    title: "Aset Tetap",
    description: "Inventaris aset kantor dan outlet, kondisi, dan riwayat perpindahan.",
    icon: "building",
  },
  "/finance/finance-ledger": {
    title: "Finance & Ledger",
    description: "Buku besar berdasarkan transaksi Jurnal Umum.",
    icon: "wallet",
  },
  "/finance/laporan-akuntansi": {
    title: "Laporan & Akuntansi",
    description: "Pusat Data & Analisa Finansial",
    icon: "coins",
  },
  "/open-transaction": {
    title: "Transfer Antar Akun",
    description: "Catat perpindahan dana antar akun kas dan bank.",
    icon: "wallet",
  },
  "/portal-karyawan": {
    title: "Portal Karyawan",
    description: "Gaji, kasbon, jadwal, absensi, dan pengajuan pribadi.",
    icon: "phone",
  },
  "/portal-karyawan/gaji": {
    title: "Gaji Saya",
    description: "Portal Karyawan - Slip dan rincian gaji yang sudah dibayar.",
    icon: "coins",
  },
  "/portal-karyawan/kasbon": {
    title: "Kasbon",
    description: "Portal Karyawan - Pengajuan, pembayaran, dan sisa kasbon pribadi.",
    icon: "wallet",
  },
  "/portal-karyawan/jadwal": {
    title: "Shift",
    description: "Portal Karyawan - Jadwal dan lokasi bertugas Anda.",
    icon: "calendar",
  },
  "/portal-karyawan/absensi": {
    title: "Absen",
    description: "Portal Karyawan - Absensi kamera dan rekap kehadiran pribadi.",
    icon: "scan-face",
  },
  "/portal-karyawan/cuti": {
    title: "Cuti",
    description: "Portal Karyawan - Pengajuan cuti, izin, sakit, dan libur.",
    icon: "calendar",
  },
  "/portal-karyawan/persetujuan": {
    title: "Persetujuan",
    description: "Portal Karyawan - Pemeriksaan pengajuan oleh admin.",
    icon: "shield",
  },
  "/role": {
    title: "Role",
    description: "Kelola role, hak akses menu, dan akun login karyawan.",
    icon: "shield",
  },
  "/akses-ditolak": {
    title: "Hak Akses",
    description: "Pengaturan akses menu akun Anda.",
    icon: "shield",
  },
  "/barang-masuk": {
    title: "Barang Masuk",
    description: "Penerimaan barang dari supplier dan pembelian.",
    icon: "package-in",
  },
  "/stok-inventory": {
    title: "Stok & Inventori",
    description: "Persediaan barang dan pemantauan stok.",
    icon: "boxes",
  },
  "/supplier": {
    title: "Supplier",
    description: "Data supplier dan saldo hutang usaha.",
    icon: "truck",
  },
  "/pelanggan": {
    title: "Pelanggan",
    description: "Data pelanggan dan kontak bisnis.",
    icon: "people",
  },
  "/dashboard": {
    title: "Dashboard",
    description: "Ringkasan karyawan dan operasional hari ini.",
    icon: "dashboard",
  },
  "/karyawan": { title: "Data Karyawan", description: "Kelola biodata karyawan.", icon: "people" },
  "/penempatan": {
    title: "Penempatan Karyawan",
    description: "Atur area asal dan lokasi kerja sesuai periode penempatan.",
    icon: "placement",
  },
  "/absensi": {
    title: "Absensi Karyawan",
    description: "Rekap kehadiran dari jadwal kerja.",
    icon: "people",
  },
  "/jadwal": {
    title: "Jadwal Kerja",
    description: "Jadwal per tanggal berdasarkan penempatan periode.",
    icon: "calendar",
  },
  "/rekap-saldo": {
    title: "Rekap Saldo",
    description: "Rekap sisa kasbon, bonus disetujui, dan denda untuk periode berikutnya.",
    icon: "wallet",
  },
  "/payroll": {
    title: "Payroll",
    description: "Perhitungan periode, pemeriksaan rincian, dan arsip pembayaran.",
    icon: "coins",
  },
  "/kasbon": {
    title: "Kasbon",
    description: "Kasbon baru, cicilan, dan saldo aktif per karyawan.",
    icon: "wallet",
  },
  "/bonus": {
    title: "Bonus",
    description: "Bonus diperoleh dan pengambilan harian, mingguan, atau bulanan.",
    icon: "gift",
  },
  "/selisih-setor": {
    title: "Selisih Setoran",
    description: "Rekap kekurangan setoran dan pengaturan potongan per karyawan.",
    icon: "receipt",
  },
  "/master-area": {
    title: "Master Area",
    description: "Kelola area operasional untuk penempatan karyawan.",
    icon: "location",
  },
  "/master-outlet": {
    title: "Master Outlet",
    description: "Kelola outlet dan area operasionalnya.",
    icon: "building",
  },
};
export function WorkspaceHeading({ userName }: { userName: string }) {
  const pathname = usePathname();
  const heading = pathname.startsWith("/karyawan/")
    ? {
        title: pathname === "/karyawan/baru" ? "Tambah Karyawan" : "Edit Biodata",
        description: "Kelola identitas dan biodata karyawan.",
        icon: "people" as const,
      }
    : headings[pathname] || {
        title: "HRIS & Payroll",
        description: "Ruang kerja administrasi.",
        icon: "people" as const,
      };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
        <UiIcon name={heading.icon} size={22} />
      </span>
      <div className="min-w-0">
        <h1 className="!text-lg font-bold !tracking-tight sm:!text-xl">{heading.title}</h1>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">
          {pathname === "/dashboard"
            ? `Selamat datang, ${userName}. Berikut kondisi tim Anda hari ini.`
            : heading.description}
        </p>
      </div>
    </div>
  );
}
