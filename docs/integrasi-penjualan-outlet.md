# Penjualan POS dan rekap outlet

## Persiapan

- Isi produk aktif beserta harga jual di Setting Menu.
- Isi Resep & HPP untuk kebutuhan bahan per satu produk. Satuan resep harus sesuai satuan bahan.
- Catat stok bahan pada outlet di Control Stok. Transaksi outlet tidak mengambil stok gudang pusat.
- Hubungkan akun crew dengan karyawan dan jadwal HR. Crew hanya dapat memakai outlet sesuai jadwal kerja hari ini; petugas POS ditentukan otomatis dari jadwal. Pengelola mengisi data manual melalui kartu Monitoring Outlet.

## Tiga sumber input

1. **POS**: simpan transaksi pelanggan, metode pembayaran, dan crew. Transaksi memakai harga master saat disimpan.
2. **Input manual admin**: tersedia melalui kartu outlet di Monitoring Outlet. Halaman POS tidak menyediakan pilihan sumber atau petugas manual.
3. **Rekap total manual** di Monitoring Outlet: angka total harian pembanding, bukan transaksi tambahan. Jika transaksi POS/tambahan juga tersedia, panel pemeriksaan sumber meminta pengelola memilih angka final dan alasan. Laporan tidak menjumlahkan dua total tersebut.

Perubahan setelah konfirmasi membuka pemeriksaan sumber kembali. Angka laporan yang sudah dipakai tetap dipertahankan sampai diperiksa. Setoran atau bonus yang sudah disetujui tetap mengikuti penguncian yang berlaku.

## Stok dan transaksi tertunda

- Resep lengkap: penyimpanan transaksi dan pengurangan bahan outlet berlangsung dalam satu transaksi database. Stok tidak cukup membatalkan penyimpanan seluruh penjualan tersebut.
- Resep belum ada: penjualan tetap tersimpan, tetapi pemakaian bahan diberi tanda belum diterapkan. Biaya tidak diasumsikan nol.
- Tambahan manual tanggal lampau: pemakaian bahan ditandai untuk pemeriksaan; stok hari ini tidak dikurangi secara otomatis.
- Pengisian resep belakangan tidak otomatis mengurangi stok untuk transaksi lama. Periksa hitung fisik dan catatan pemakaian sebelum melakukan koreksi, supaya tidak mengurangi dua kali.
- Memilih sumber rekap manual tidak membalik pemakaian bahan yang telah dicatat transaksi POS. Koreksi stok perlu diperiksa tersendiri.

## Saat koneksi terputus

POS menyimpan kunci percobaan pembayaran di browser sebelum mengirim. Coba ulang pembayaran yang sama atau muat ulang halaman untuk memeriksa hasilnya. Server mengembalikan transaksi yang sudah tersimpan tanpa menambah omzet atau mengurangi stok lagi. Jangan membuat transaksi pengganti sebelum status transaksi pertama diketahui.

Transaksi tetap disimpan meskipun tabel riwayat tidak ditampilkan pada halaman POS. Pencatatan QRIS/transfer/online food merupakan konfirmasi kasir; belum merupakan verifikasi otomatis dari penyedia pembayaran.
