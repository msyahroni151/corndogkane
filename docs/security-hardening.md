# Pengamanan aplikasi — 5 November 2026

Dokumen ini menjelaskan pengamanan aplikasi dan prosedur operasinya. Status deployment diverifikasi melalui Render. Tidak ada jaminan bahwa suatu aplikasi bebas dari semua serangan.

## Perubahan

- Next.js dan eslint-config-next diperbarui ke 16.4.5; React dan React DOM ke 19.3.1. Patch dependency turunan dibatasi lewat pnpm-workspace.yaml: UUID 11.1.1 untuk ExcelJS, MySQL2 3.23.1, fast-uri 3.1.9, deepmerge-ts 8.0.0 untuk konfigurasi Prisma, dan minimatch 11.0.1 untuk parser TypeScript ESLint. Kompatibilitas Prisma CLI, build, lint, dan ekspor/impor XLSX diuji.
- Optimasi gambar dinonaktifkan; komponen Image tetap dipakai untuk ukuran/layout. Endpoint /_next/image ditutup. Gambar aplikasi tetap tersedia langsung.
- CSP memakai nonce acak per request dan strict-dynamic. HTML dirender dinamis supaya nonce tidak dipakai ulang dari cache. Script inline tanpa nonce ditolak. Kompilasi WebAssembly diizinkan khusus lewat wasm-unsafe-eval untuk library pengenalan wajah; evaluasi JavaScript bebas tetap ditolak. Style inline masih diizinkan karena chart, peta, dan posisi komponen memerlukannya; sumber gambar HTTPS diizinkan untuk logo struk dan tile peta.
- Header nosniff, DENY framing, Referrer-Policy, pembatasan fitur browser, dan Cross-Origin-Resource-Policy diterapkan. Kamera dan geolokasi origin aplikasi tetap diizinkan. HSTS diaktifkan hanya pada lingkungan Render. HTML/API diberi private/no-store melalui proxy.
- Session tetap memakai token acak 256 bit; hanya SHA-256 token disimpan. Cookie HttpOnly dan SameSite=Lax tetap dipertahankan. Pada Render, flag lokal tidak dapat menonaktifkan Secure cookie. Akun, role, karyawan, dan masa berlaku session diperiksa di server pada setiap request.
- Batas login persisten: 10 percobaan per email per 15 menit dan 60 per bucket jaringan per 15 menit, memakai transaksi dan advisory lock. Login berhasil menghapus counter akun, bukan counter jaringan. Bucket Render berasal dari alamat proxy terdekat di X-Forwarded-For yang tervalidasi; prefix kiriman client tidak dipakai. Di lokal/tanpa proxy tepercaya, dipakai bucket bersama. Validasi header dari proxy perlu dikonfirmasi saat penerapan online; penambahan proxy baru memerlukan peninjauan konfigurasi ini.
- Password baru/reset minimal 12 karakter dengan huruf, angka, dan simbol. Login tidak menerapkan kebijakan baru pada password yang sudah ada. Password Owner tidak diganti, sesuai keputusan pengguna. Hash PBKDF2-SHA256 600.000 iterasi dan salt acak tetap dipakai.
- Hanya akun dengan systemKey role OWNER yang dapat mengelola akun/role Owner. Nama tampilan role tidak dipakai sebagai bukti identitas Owner. Pengelola role biasa tidak boleh memberi atau mengubah akses melebihi akses sendiri; pembatasan ini diterapkan di server walaupun form dimanipulasi. HR biasa tidak boleh menonaktifkan karyawan yang memiliki akun Owner. Perlindungan minimal satu Owner aktif tetap ada.
- Foto wajah/gerobak dibaca dengan pembatasan karyawan pada query database. Pengguna biasa hanya dapat membaca foto sendiri; reviewer memakai izin khusus. Pengguna tanpa izin ditolak sebelum blob foto dibaca. Response foto bersifat private/no-store.
- API JSON penting membaca stream dengan batas byte, menghentikan request terlalu besar, memeriksa tipe konten, dan memvalidasi origin untuk penulisan. Pesan internal database pada API kamera dan catatan jadwal tidak dikirim ke browser.
- Tabel tambahan security_events mencatat login berhasil/gagal, throttle, logout, perubahan role/akun/password dan perubahan akses yang ditolak. Audit tidak menyimpan password, hash password, token session, body form, email yang dicoba, atau foto. Hash jaringan tetap diperlakukan sebagai data terbatas. Owner melihat 50 aktivitas terbaru melalui menu Role; tidak ada endpoint log publik.

## Database dan preservasi

Backup lokal dan online dibuat dan daftar isinya diverifikasi sebelum migrasi lokal. Migrasi 20261105111739_security_events hanya menambah tabel, indeks, foreign key, dan pembatasan akses; tidak mereset atau mengisi ulang tabel bisnis. RLS diaktifkan, izin PUBLIC/anon/authenticated dicabut pada tabel baru. Pada tahap lanjutan, migrasi online ditambahkan tanpa reset atau seed; salinan sebelum perubahan tetap dipertahankan.

Pemeriksaan online sebelum perubahan: semua 50 tabel public memiliki RLS, tidak ada grant tabel untuk anon/authenticated, dan tidak ada fungsi SECURITY DEFINER yang bisa dijalankan PUBLIC. Role aplikasi bukan superuser dan tidak memiliki BYPASSRLS/CREATEDB/CREATEROLE. Role tersebut masih pemilik tabel; pemisahan role migrasi dan role runtime dengan izin DML terbatas dapat menjadi tahap lanjutan. Tidak membuka policy browser untuk menghilangkan peringatan informasional RLS tanpa policy: akses database memang lewat server Prisma.

## Verifikasi

- Validasi Prisma, migrasi tambahan lokal, TypeScript, ESLint pada file perubahan, dan build produksi.
- Audit dependency produksi dan keseluruhan dependency: tidak ada advisory yang dikenal pada snapshot audit setelah patch. Hasil ini bukan bukti bahwa semua celah telah hilang.
- Pengujian otomatis menggunakan database PostgreSQL sementara dengan prefix corndog_security_qa_, lalu database tersebut dihapus. Tidak memakai data bisnis utama untuk percobaan serangan.
- Uji password lama dan kebijakan password baru; batas login paralel dan jaringan; pemalsuan prefix XFF; byte limit/cancel stream/MIME/origin; CSP nonce dan injeksi HTML; penutupan optimizer; API anonim; login Owner tanpa employee; form role yang dipalsukan; privasi foto; session kedaluwarsa/akun-role nonaktif; audit tanpa secret; XLSX round trip.
- Pengujian kamera mencakup pembatasan akses, validasi request, pemuatan model lokal, dan pemindaian frame kamera sintetis di bawah CSP. Pengujian ini bukan sertifikasi liveness atau ketahanan face recognition terhadap spoofing. Verifikasi perangkat fisik tetap diperlukan.
- Artefak dan runner pengujian disimpan di verification/ yang dikecualikan dari Git/paket deploy, bersama backup privat.

## Sebelum penerapan online berikutnya

1. Buat backup baru dan pastikan tidak ada perintah reset/reseed. Jalankan migrasi tambahan melalui proses deploy yang ada, kemudian jalankan aplikasi dengan source dan lockfile baru.
2. Pastikan HTTPS, Secure cookie, header CSP/HSTS, cache privat, dan header proxy aktual berfungsi di Render. Uji login, pergantian menu, kamera HP, ekspor, dan logo/peta dari origin yang digunakan.
3. Simpan secret hanya pada environment server, bukan NEXT_PUBLIC_* atau source. File env, backup, database lokal, verification/, dan data impor tetap dikecualikan dari paket source.
4. Pantau login gagal/throttle/perubahan akses. Jangan membagikan akun Owner untuk operasional harian; gunakan akun dengan izin seperlunya.

## Batas yang masih perlu dikelola

Password Owner tetap digunakan atas permintaan pengguna; kebijakan baru tidak otomatis menggantinya. Penguatan MFA, peringatan, retensi peninjauan dan backup dijelaskan di bagian lanjutan. Perlindungan DDoS tingkat jaringan bergantung pada hosting. Penilaian penetrasi independen, passkey, rotasi secret terjadwal, dan kebijakan penghapusan audit/foto tetap memerlukan pengelolaan lanjutan tanpa menghapus data yang masih dibutuhkan.

## Referensi primer

- [Pembaruan keamanan Next.js, 14 Oktober 2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
- [Advisory SVG Image Optimization](https://github.com/vercel/next.js/security/advisories/GHSA-7qx7-33qx-rqx2)
- [Advisory proxy response injection](https://github.com/vercel/next.js/security/advisories/GHSA-pc58-hwjq-p385) — tidak ditemukan route yang mengembalikan response fetch upstream secara utuh; route aplikasi membuat response sendiri.
- [Dokumentasi CSP Next.js](https://nextjs.org/docs/app/guides/content-security-policy)
- [Render: DDoS dan header proxy](https://render.com/articles/how-render-handles-ddos-attacks)
- [Supabase: RLS tanpa policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Advisory UUID](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq), [DeepmergeTS](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx), [MySQL2](https://github.com/sidorares/node-mysql2/security/advisories/GHSA-3f6p-5ww8-9rcr), [minimatch](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).

## Penguatan lanjutan — 5 November 2026

MFA TOTP diwajibkan untuk Owner, pengelola role, payroll, dan akses keuangan; akun lain dapat mengaktifkannya lewat Keamanan. Akun yang belum mendaftar harus memindai QR dan mengonfirmasi kode terlebih dahulu. Password lama tetap dipertahankan; tidak ada faktor MFA produksi yang didaftarkan oleh pengujian otomatis. Tersedia 10 kode pemulihan acak sekali pakai; simpan di luar perangkat authenticator. Kode TOTP yang dipakai ulang ditolak, percobaan dibatasi, dan secret disimpan dengan AES-256-GCM.

Matriks Role kini memisahkan izin Lihat/Tambah/Edit/Hapus/Ekspor/Setujui. Pembatasan berlaku pada action server dan API, termasuk request yang dipalsukan. Hak akses role lama dipertahankan sampai disimpan ulang oleh pengelola; Owner perlu meninjau dan mempersempit role sesuai tugas aktual. Pengelola tidak boleh mendelegasikan aksi yang tidak dimilikinya.

Foto dan descriptor wajah baru dienkripsi terautentikasi, dengan derivasi kunci terpisah dari MFA. Batas peninjauan foto default 180 hari dan dapat diatur Owner. Penghapusan otomatis tidak diaktifkan, sehingga bukti lama tetap disimpan. Tidak ditemukan tabel aplikasi tanpa referensi kode; tidak ada tabel bisnis yang dihapus.

Peringatan aktivitas keamanan muncul pada tombol Keamanan khusus Owner dan dapat ditandai sudah ditinjau. Ini adalah notifikasi di aplikasi; tidak mengirim email atau WhatsApp. Audit tidak dapat diubah/dihapus oleh role runtime.

Role database runtime dan backup memakai allowlist tabel/operasi eksplisit. Runtime tidak memiliki DDL, akses riwayat migrasi, keanggotaan role pemilik, atau hak menghapus audit. Backup tidak dapat mengubah data bisnis; hanya dapat menulis status pekerjaan backup. Keanggotaan SET sementara untuk pemasangan password langsung telah dicabut dan diperiksa. Kredensial migrasi tidak diberikan ke proses website online. Startup produksi scripts/start-secure.cjs memverifikasi pembatasan role dan tidak menjalankan migrasi atau seed. render.yaml diselaraskan dengan layanan corndogkane yang sudah ada; layanan ini dikelola melalui konfigurasi Render langsung, tanpa membuat resource baru.

Backup Windows dijadwalkan pukul 02.15 WIB dan saat login Windows, dengan StartWhenAvailable dan perlindungan agar pekerjaan tidak tumpang tindih. Komputer pengelola perlu aktif dan akun Windows login; bila komputer mati pekerjaan menyusul saat aktif kembali. Salinan lokal/online dienkripsi AES-256-GCM di verification/security-private/backups dan dipulihkan otomatis ke database sementara sebelum dianggap berhasil. Seluruh sidik baris dibandingkan menggunakan snapshot transaksi yang konsisten. Semua backup lama tetap dipertahankan; belum ada penghapusan backup berdasarkan umur. Kunci dan konfigurasi berada di folder privat dengan ACL akun Windows ini dan SYSTEM, dikecualikan dari Git/deploy. Kunci perlu ikut diamankan secara terpisah sebelum penggantian/kehilangan komputer; kehilangan kunci dapat membuat backup terenkripsi tidak dapat dipulihkan.

Akun Owner tetap memakai password yang dipilih pengguna. MFA authenticator menambah perlindungan tetapi tidak membuat akun kebal phishing. Passkey, penilaian penetrasi independen, dan pemantauan eksternal tetap dapat ditambahkan kemudian.
