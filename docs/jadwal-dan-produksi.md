# Revisi Jadwal dan Produksi

- Operasional Outlet memakai jabatan Crew Outlet, Crew Backup, dan SPV (nilai tersimpan AREA SUPERVISOR).
- Status Kerja berada di baris periode. Tanggal libur dan standby dipilih per tanggal; tanggal lain tetap mengikuti jam Master Outlet. Jadwal lama tidak ditulis ulang.
- Share Jadwal menyimpan catatan per area dan periode. Filter satu area menyesuaikan lebar header dan tabel. PNG/PDF dapat diunduh atau dibagikan melalui menu berbagi perangkat; fallback WhatsApp mengunduh file untuk dilampirkan.
- Rencana Produksi mencatat tanggal, barang hasil, target, catatan, dan status. Rencana tidak memesan atau memotong stok. Catat Hasil menghubungkan produksi aktual ke rencana dan menyelesaikannya dalam transaksi yang sama.
- Pemakaian Bahan menampilkan pengurangan batch yang sudah tercatat dalam transaksi produksi, sehingga tidak memotong stok untuk kedua kali.
- Delete Area hanya berhasil untuk area tanpa relasi. Area yang masih dipakai tetap dipertahankan.

Data lokal dan online, termasuk seluruh data dummy uji coba, harus dipertahankan. Pengujian mutasi memakai database sementara terpisah. Backup dan sidik jari baris lama disimpan privat di luar paket deploy.
