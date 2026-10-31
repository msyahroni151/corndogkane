# Demo online Corndog Kane

Target: Render Free (website Next.js) + Supabase Free (PostgreSQL), region Singapore. Website lokal dan data asli tetap terpisah.

## Isi demo

- Akun Owner Demo; autentikasi dan izin tetap berjalan seperti aplikasi asli.
- Katalog 28 Produk penjualan tetap tersedia sesuai master yang disetujui. Sub Produk dan data operasional (karyawan, outlet, transaksi, stok, aset) dimulai kosong. Bootstrap tidak mengisi data operasional contoh.
- Master COA mengikuti struktur aplikasi. Laba dan neraca tetap ditandai belum lengkap jika sumbernya belum terhubung.
- Label MODE DEMO pada halaman masuk dan halaman aplikasi; robots/noindex untuk halaman administrasi.
- Tidak mengimpor biodata karyawan, nomor rekening, transaksi, sesi, atau password dari database asli.

## Yang perlu dihubungkan

Akun GitHub (repository privat untuk source), Supabase, dan Render. Pilih paket Free secara eksplisit. Jangan membuat resource berbayar untuk demo ini.

1. Buat project Supabase baru khusus demo. Simpan project reference-nya.
2. Dari Connect, salin koneksi **Session pooler**, port **5432**. Gunakan username `postgres.PROJECT_REF`, database `postgres`, dan parameter `sslmode=require`. Password yang memiliki karakter khusus perlu di-URL-encode. Jangan memakai transaction pooler port 6543 karena migrasi dan aplikasi memakai advisory locks.
3. Jalankan `pnpm demo:package`. Upload source dari folder hasil paket ke repository GitHub privat. Paket secara sengaja mengecualikan `.env.local`, file verifikasi, database lokal, dan berkas impor karyawan.
4. Buat Render Blueprint dari repository tersebut dengan `render.yaml`. Paket website harus `free`, region `singapore`.
5. Masukkan `HRIS_DEMO_PROJECT_REF` dan `DATABASE_URL` project demo. Jangan menyalin URL database asli.
6. Password demo dibuat acak oleh Render melalui `DEMO_ADMIN_PASSWORD`. Email masuk: `owner@demo.corndogkane.test`. Password hanya disimpan di environment Render; lihat di dashboard Render saat hendak masuk. Nilai tersebut digunakan sekali saat akun pertama dibuat, bukan untuk mereset password setiap restart.
7. Render membangun aplikasi, lalu `scripts/start-demo.cjs` memverifikasi target, menjalankan migrasi, menyiapkan akun owner satu kali, dan menjalankan Next.js pada port hosting.
8. Setelah URL `.onrender.com` tersedia, uji login, jadwal, monitoring outlet, laporan per outlet, dan unduhan Excel/PDF melalui HP.

## Perilaku data dan restart

Target harus project Supabase yang disebut secara eksplisit. Database yang berisi data tanpa penanda demo ditolak sebelum migrasi. Proses tidak menjalankan reset, truncate, atau impor database asli.

Data isian bisnis tidak dibuat otomatis saat boot; perubahan yang diinput melalui aplikasi dipertahankan. Struktur tabel aplikasi memakai Row Level Security, tanpa kebijakan akses publik, dan izin tabel untuk role API `anon` / `authenticated` dicabut. Website mengakses PostgreSQL melalui proses server dan login aplikasinya sendiri. Koneksi database tidak dikirim ke browser.

Saat aplikasi sudah digunakan sehari-hari nanti, buat lingkungan produksi terpisah dan jalankan penyiapan produksi, bukan bootstrap demo ini.

## Batas layanan gratis

Render Free dapat tidur setelah 15 menit tidak ada traffic; akses berikutnya dapat memerlukan sekitar satu menit untuk bangun. Supabase Free dapat dijeda karena aktivitas rendah. Paket gratis ini disiapkan untuk presentasi/pengujian, bukan transaksi outlet harian. Ketentuan, kuota, dan ketersediaan paket mengikuti penyedia.

Sumber:

- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/pricing

## Status penerbitan

File konfigurasi bukan bukti bahwa website sudah online. Penerbitan baru selesai setelah resource cloud dibuat, akun hosting terhubung, dan URL demo berhasil diuji. Jangan mengunggah data lokal sebagai pengganti data contoh.

## Koneksi server demo

Server demo dapat memakai role PostgreSQL khusus `corndog_demo_app`, dengan akses hanya untuk membuat dan mengelola tabel aplikasi pada database demo. Untuk Session pooler, username-nya `corndog_demo_app.PROJECT_REF`. Password role disimpan dalam environment hosting dan tidak masuk repository.

Gunakan `sslmode=verify-full` dan `NODE_EXTRA_CA_CERTS=integrations/supabase/prod-ca-2021.crt`. Berkas tersebut adalah sertifikat CA publik Supabase, bukan private key. Sumber sertifikat: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. Sidik jari SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

Jika layanan dibuat langsung melalui Dashboard/CLI, konfigurasi aktif berada pada layanan tersebut; `render.yaml` adalah template untuk instalasi baru dan tidak otomatis mengelola layanan yang sudah ada.

## Koneksi saat pergantian versi

Pool aplikasi dibatasi 10 koneksi per proses. Role server `corndog_demo_app` memakai batas 24 koneksi agar instance lama dan baru dapat berjalan bersamaan saat deploy, dengan kapasitas database saat ini 60. Pengaturan ini tidak mengubah hak akses tabel atau data aplikasi. Jangan menambahkan cache autentikasi lintas request; izin tetap diperiksa pada setiap request.
