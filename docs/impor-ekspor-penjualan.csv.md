# CSV Penjualan Monitoring Outlet

Unduhan CSV memakai titik koma dan petunjuk pemisah Excel agar kolom langsung terpisah ketika dibuka. File koma maupun titik koma tetap dapat diimpor.

Buka MENU UTAMA → Monitoring Outlet. Tombol Ekspor CSV mengikuti periode, area, dan pencarian yang sedang diterapkan. Ekspor memuat rekap harian, bukan daftar struk per transaksi.

Untuk data lama, pilih Impor CSV → Unduh Template CSV. Buka template di Excel, isi data, lalu simpan sebagai CSV UTF-8. Referensi Outlet & Crew menyediakan ID/kode/nama yang terdaftar. Kolom outlet wajib diisi; crew wajib untuk status BUKA dan dikosongkan untuk TUTUP. nama_outlet dan nama_crew hanya keterangan opsional.

Satu baris adalah satu outlet per tanggal. Tanggal menerima YYYY-MM-DD atau DD/MM/YYYY. Jumlah terjual memakai bilangan bulat. Nominal rupiah boleh 2500 atau 2.500, tanpa desimal. harga_nama_produk kosong memakai harga rekap standar yang sudah ada di Monitoring Outlet; isi harga historis untuk menjaga omzet lama. Jumlah produk yang tidak terjual diisi 0. Total penjualan adalah jumlah × harga seluruh kolom produk. total_penjualan boleh kosong atau diisi untuk dicocokkan.

QRIS/GoFood/GrabFood/ShopeeFood adalah nominal pembayaran, bukan jumlah transaksi. Jumlahnya tidak boleh melebihi omzet. setoran_tunai adalah uang yang benar-benar disetor; kosong berarti belum dicatat. pengeluaran dan keterangan_pengeluaran mengikuti isian rekap manual. Kosong dan angka 0 dipertahankan sebagai nilai yang berbeda untuk adonan, pengeluaran, dan setoran.

Pilih file lalu Periksa CSV. Perbaiki seluruh kesalahan sebelum menekan Impor. Batas 100 baris/2 MB per file. Outlet + tanggal yang sudah tercatat dilewati; data lama tidak ditimpa. Pasangan outlet/tanggal yang berulang dalam file dianggap kesalahan. Seluruh baris baru disimpan sekaligus; kegagalan satu baris membatalkan baris baru lainnya. Impor ulang tidak menggandakan rekap atau bonus.

Impor mengikuti perhitungan dan perlindungan bonus pada input rekap manual. Bonus historis yang berbenturan dengan bonus manual atau payroll dibayar akan ditolak sesuai aturan yang sudah ada. Impor rekap tidak mengurangi stok historis. Hanya sumber MANUAL yang dapat diimpor. Baris ekspor bersumber POS/REVIEW berfungsi sebagai laporan; jangan mengubah sumbernya untuk mengimpor ulang transaksi yang sama.

File contoh berisi data ilustrasi, bukan data penjualan usaha. Ganti CONTOH_OUTLET dan CONTOH_CREW dengan referensi terdaftar, serta seluruh angka/tanggal sesuai catatan asli. File kosong hanya berisi judul kolom.

Impor historis menerima karyawan aktif maupun nonaktif yang sudah terdaftar sebagai CREW OUTLET, CREW BACKUP, atau AREA SUPERVISOR dan memiliki kode karyawan. Status karyawan tidak diubah. Referensi Outlet & Crew mencakup keduanya dengan kolom status; pratinjau menandai crew nonaktif. Pencocokan tetap memakai kolom crew (ID, kode, atau nama lengkap yang unik). Karyawan yang belum terdaftar tetap perlu ditambahkan terlebih dahulu. Input penjualan harian tetap membatasi pilihan baru ke crew aktif. Perlindungan data rekap yang sudah ada dan bonus/payroll tetap berlaku.

Template dan ekspor kini memiliki status_operasional (BUKA/TUTUP) dan keterangan_operasional (alasan tutup). Kolom baru ditambahkan di akhir agar urutan lama tetap sama. Jika status kosong/tidak ada, dianggap BUKA; pengecualian file lama dengan crew TUTUP otomatis menjadi TUTUP. Jangan isi nama karyawan untuk baris TUTUP. Semua penjualan, pembayaran, setoran, pengeluaran, pemakaian adonan dan crew training harus kosong/nol pada baris tutup. Harga satuan tidak dihitung sebagai aktivitas.

Status tutup harian disimpan terpisah tanpa karyawan fiktif, transaksi, bonus, ataupun pengurangan stok. Card dan tabel/share rekap menampilkan status dan alasan tutup sesuai tanggal/periode. Pada popup operasional, pilih Status operasional → Tutup; buka kembali lewat pilihan Buka lalu Buka kembali outlet. Outlet yang sudah memiliki rekap/transaksi tidak boleh ditutup dengan menimpa data. Impor melewati tanggal/outlet yang sudah memiliki rekap atau status tutup. Outlet tutup tidak menerima penjualan manual maupun POS sampai dibuka kembali. Status di Master Outlet untuk tutup permanen tidak berubah.
