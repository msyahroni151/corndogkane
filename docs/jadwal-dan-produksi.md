# Revisi Jadwal dan Produksi

- Operasional Outlet memakai jabatan Crew Outlet, Crew Backup, dan SPV (nilai tersimpan AREA SUPERVISOR).
- Crew reguler memakai baris periode (maksimal 31 hari per periode); crew backup/SPV memakai baris tanggal. Status Kerja, Standby, dan Openingan tersedia untuk crew outlet. Tanggal libur khusus tetap bisa dipilih; jadwal lama tidak ditulis ulang.
- Standby tidak wajib memilih outlet, tanpa jam kerja, dan dibayar Rp50.000 per hari untuk crew reguler maupun backup. Jika jadi masuk, Edit jadwal hari itu menjadi Kerja lalu pilih outlet yang dijaga. Payroll memakai tarif outlet berdasarkan absensi, tanpa uang standby pada hari yang sama. Openingan mengikuti jam, absensi, dan tarif outlet seperti Kerja.
- Hapus di kolom Aksi meminta konfirmasi, hanya menghapus satu jadwal harian, dan mempertahankan penempatan. Jadwal yang sudah memiliki absensi, bukti absensi portal, transaksi penjualan, atau payroll dibayar dilindungi. Perubahan bersamaan dideteksi melalui versi jadwal.
- Share Jadwal menyimpan catatan per area dan periode. Filter satu area menyesuaikan lebar header dan tabel. PNG/PDF dapat diunduh atau dibagikan melalui menu berbagi perangkat; fallback WhatsApp mengunduh file untuk dilampirkan.
- Rencana Produksi mencatat tanggal, barang hasil, target, catatan, dan status. Rencana tidak memesan atau memotong stok. Catat Hasil menghubungkan produksi aktual ke rencana dan menyelesaikannya dalam transaksi yang sama.
- Pemakaian Bahan menampilkan pengurangan batch yang sudah tercatat dalam transaksi produksi, sehingga tidak memotong stok untuk kedua kali.
- Delete Area hanya berhasil untuk area tanpa relasi. Area yang masih dipakai tetap dipertahankan.

Data lokal dan online, termasuk seluruh data dummy uji coba, harus dipertahankan. Pengujian mutasi memakai database sementara terpisah. Backup dan sidik jari baris lama disimpan privat di luar paket deploy.
