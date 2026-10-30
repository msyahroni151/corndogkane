# Control Stok Outlet

Menu: Inventory & Pembelian > Control Stok. Semua perubahan ini lokal; belum dipush atau dideploy.

## Penggunaan

1. Catat stok awal / hitung fisik untuk barang yang ada di setiap outlet. Isi 0 hanya jika barang benar-benar kosong. Catat sebelum kiriman pertama diterima.
2. Catat permintaan barang beserta nama pemohon / crew. Layar menampilkan stok outlet dan gudang saat ini untuk dibandingkan dengan jumlah permintaan.
3. Gudang memeriksa permintaan lalu klik Kirim Barang. Seluruh barang dalam permintaan dikirim sekaligus dengan FIFO. Jika satu barang kurang, seluruh pengiriman ditolak tanpa mengubah stok. Permintaan yang belum dikirim dapat dibatalkan dan dibuat ulang.
4. Konfirmasi Terima di Outlet hanya setelah semua barang benar-benar diterima. Stok outlet bertambah satu kali. Barang yang dikirim tetapi belum diterima ditampilkan terpisah sebagai Dalam Pengiriman.
5. Catat pemakaian penjualan dan susut outlet. Saat ini pencatatan manual karena POS serta resep produk jual belum dihubungkan. Referensi/catatan wajib diisi; hindari mencatat penjualan yang sama dua kali.
6. Cocokkan stok tercatat dengan hitung fisik setelah penjualan. Selisih disimpan sebagai riwayat koreksi dan tersedia untuk evaluasi permintaan berikutnya.

Stok tercatat = stok awal + penerimaan - pemakaian - susut + koreksi fisik.

## Batas informasi

- Ini stok berdasarkan transaksi yang dicatat, bukan pembacaan stok fisik secara otomatis. Waktu pemeriksaan fisik ditampilkan secara terpisah.
- Tidak ada stok outlet yang dibuat dari stok gudang lama. Outlet/barang tanpa stok awal ditampilkan sebagai belum dicatat, bukan nol.
- Nilai rupiah stok awal positif yang belum diketahui tetap kosong. Nilai tidak diambil dari harga jual dan tidak diasumsikan nol.
- Pengiriman memindahkan nilai perolehan dari batch gudang ke barang dalam perjalanan, lalu ke stok outlet setelah diterima. Mutasi tidak membuat pendapatan atau jurnal keuangan otomatis.
- Belum ada pengurangan otomatis dari penjualan POS. Integrasi mendatang harus memakai resep produk, identitas transaksi unik dan layanan mutasi yang sama agar tidak ganda. Jangan mengurangi bahan dari rekap omzet tanpa resep.
- Permintaan dan mutasi saat ini dicatat oleh pengguna gudang/admin yang memiliki izin Control Stok. Nama pemohon dicatat terpisah dari akun pencatat. Form permintaan langsung di Portal Karyawan/POS belum ditambahkan.
- Akses lama Stok & Inventori mewarisi izin Control Stok, kecuali owner secara eksplisit menonaktifkannya pada Role.

## Integritas

Migrasi 20261025100000_outlet_stock_control hanya menambah empat tabel. Database lokal dicadangkan sebelum migrasi. Setiap mutasi menyimpan pelaku, waktu server, nilai sebelum/sesudah dan referensi permintaan. Transaksi memakai penguncian yang sama dengan inventori gudang, versi stok, kunci idempotensi, serta batas stok nonnegatif di database. Satuan tidak dapat diubah setelah digunakan dalam stok/permintaan outlet.

Verifikasi transaksi: verification/check-outlet-stock-service.ts, dijalankan pada database sementara yang dihapus sesudah pengujian.
