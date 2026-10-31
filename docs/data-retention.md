# Data yang dipertahankan

Katalog Produk di Penjualan & Kasir > Setting Menu adalah master tetap. Nama, harga, dan pengaturan 28 produk yang disetujui disimpan di `integrations/catalog/fixed-products-v1.json` dan dipasang melalui migrasi `20261030220000_restore_fixed_sales_products`.

Saat membersihkan data demo atau data operasional, pertahankan akun owner, hak akses, dan baris `inventory_items` dengan `kind = PRODUCT`. Jangan mengosongkan seluruh tabel `inventory_items` tanpa memisahkan katalog Produk terlebih dahulu.

Sub Produk (`kind = SUB`), bahan gudang, stok, resep, dan transaksi tidak dipulihkan bersama katalog Produk. Migrasi katalog berjalan satu kali sehingga deploy berikutnya tidak mengembalikan transaksi lama atau menimpa perubahan harga yang dibuat setelah migrasi.

## Data uji coba aktif

Seluruh data lokal dan online, termasuk data dummy, harus dipertahankan. Jangan menjalankan reset, truncate, pengosongan, atau seed yang menimpa data yang sudah ada. Migrasi berikutnya harus menambah struktur secara aman; uji tindakan hapus dan mutasi stok di database sementara. Buat backup sebelum migrasi dan bandingkan baris lama sesudahnya.
