# Resep & HPP dan Produksi Gudang

Lokasi menu:
- Penjualan & Kasir > Setting Menu > Resep & HPP.
- Inventory & Pembelian > Produksi Gudang > Catat Produksi / Riwayat Produksi.

Resep tersimpan satu kali dalam inventory_recipes. Edit katalog Produk/Sub Produk tidak lagi mengubah resep. Resep sub produk yang sudah ada tetap dipakai tanpa migrasi atau pengisian ulang.

## Mengisi resep

Tambahkan produk atau sub produk ke katalog terlebih dahulu. Di Resep & HPP, klik Atur Resep pada barang yang bersangkutan. Komposisi disimpan untuk hasil 1 satuan acuan (misalnya 1 pcs adonan repack). Masukkan takaran nyata; sistem tidak mengarang jumlah tepung atau berat Parmifan dari satu sendok teh.

Produk jual dapat memakai bahan baku dan sub produk aktif. Sub produk gudang memakai bahan baku aktif. Satuan resep mengikuti satuan stok agar tidak tertukar antara pcs, gram dan ml. Bahan yang sama hanya boleh dicantumkan sekali; tidak dapat meresepkan barang sebagai bahan dirinya sendiri.

HPP di layar merupakan estimasi biaya bahan/kemasan per satuan, tidak termasuk gaji, listrik, sewa dan biaya operasional lainnya. Margin bahan = harga jual - estimasi HPP bahan. Nilai tidak diambil dari harga jual. Harga berasal dari rata-rata stok bahan gudang, batch gudang terakhir bila stok habis, atau estimasi resep sub produk bila belum pernah diproduksi. Harga yang belum diketahui ditampilkan sebagai belum diketahui, bukan nol. Harga nol dari batch yang memang dicatat nol tetap sah.

## Produksi Gudang

Atur resep sub produk terlebih dahulu, lalu klik + Catat Produksi. Pilih hasil sub produk, jumlah hasil, tanggal dan catatan. Sistem mengalikan takaran per satuan dengan jumlah produksi. Seluruh kebutuhan bahan harus tersedia. Bahan berkurang menurut FIFO dan nilai perolehannya berpindah ke batch hasil produksi. Bila bahan kurang, seluruh transaksi dibatalkan tanpa potongan sebagian.

Riwayat Produksi menampilkan tanggal/petugas, hasil, bahan dipakai, nilai produksi dan catatan; filter periode maksimal satu tahun, menampilkan 500 transaksi terbaru. Riwayat produksi lama tetap tersedia di menu baru.

Susut nyata dicatat melalui Stok & Inventori > Susut. Produksi di sini hanya mengubah stok gudang. Pengiriman ke outlet tetap melalui Control Stok; penerimaan menambah stok outlet. Produksi barang yang langsung dibuat saat penjualan nantinya memakai resep produk jual di POS. Integrasi otomatis POS belum diaktifkan.

## Hak akses dan integritas

Izin Produksi Gudang terpisah dari Setting Menu. Hak lama yang dapat membuka Setting Menu mewarisi akses produksi, kecuali dinonaktifkan secara eksplisit oleh owner. Role produksi saja tidak dapat mengubah resep.

Perubahan resep memakai pemeriksaan versi dan penguncian transaksi yang sama dengan inventori. Form produksi lama ditolak jika resep berubah. Satuan barang yang sudah digunakan dalam resep tidak dapat diubah tanpa menata ulang resep. Penyimpanan ulang produksi memakai kunci idempotensi yang sudah ada.

Pemeriksaan:
- verification/check-recipe-cost.ts: perhitungan biaya dan data yang belum lengkap.
- verification/verify-recipe-production-ui.cjs: resep sub produk/produk jual, versi, metadata tidak menghapus resep, FIFO produksi, riwayat, batas stok, izin dan mobile pada database sementara yang dihapus sesudah uji.


## Pemisahan stok gudang dan outlet

Inventory menyimpan tiga jenis stok fisik: RAW (Bahan Mentah), SUB (Bahan Setengah Jadi) dan FINISHED (Bahan Jadi). PRODUCT tetap merupakan menu jual, tidak otomatis dijadikan barang gudang. Data lama tidak dikonversi atau diberi stok baru.

Buat barang fisik melalui Stok & Inventori > + Tambah Barang Gudang. Filter jenis tersedia di Stok & Batch. Resep setengah jadi memakai bahan mentah; resep bahan jadi dapat memakai bahan mentah dan setengah jadi. Resep menu jual dapat menunjuk bahan mentah, setengah jadi maupun bahan jadi yang dikonsumsi di outlet. Jika menu memakai barang jadi, isi resep barang jadi tersebut (misalnya 1 pcs), jangan sekaligus mencantumkan kembali seluruh bahan pembuatnya karena akan menyebabkan pemakaian ganda.

Produksi Gudang mengurangi batch bahan di Inventory dan menambah batch hasil di Inventory. Permintaan ke gudang belum mengubah stok. Saat dikirim, barang keluar dari gudang dan berada dalam perjalanan; setelah diterima, stok outlet bertambah. Pemakaian penjualan dan susut outlet hanya mengurangi OutletStock serta mencatat OutletStockEvent, tanpa mengurangi InventoryBatch gudang lagi.

Pemakaian outlet masih dicatat manual melalui Control Stok. POS saat ini masih berupa pratinjau. Tidak ada potongan stok otomatis dari omzet atau rekap lama. Integrasi POS nanti harus membuat pengurangan bahan sesuai resep di outlet terkait secara atomik dan idempotent.


Stok lama yang masih melekat pada menu jual tetap ditampilkan pada bagian Stok lama masih terkait menu jual dan termasuk total nilai gudang. Tombol Pisahkan sebagai Bahan Jadi membuka konfirmasi. Hanya setelah pengguna menyimpan konfirmasi, sistem membuat barang fisik FINISHED terpisah, mempertahankan ID/jumlah/nilai batch, memperbarui hubungan penerimaan, dan menyimpan catatan pemisahan. Menu jual, harga jual, serta resepnya dipertahankan. Tidak ada pemisahan data asli yang dijalankan otomatis selama pengembangan.

Migrasi 20261026110000_finished_warehouse_stock hanya memperluas check constraint jenis barang agar menerima FINISHED; tidak mengubah jenis atau jumlah stok lama. Database lokal dicadangkan sebelum migrasi.
