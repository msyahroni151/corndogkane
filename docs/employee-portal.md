# Portal Karyawan (lokal)

Menu berada tepat di atas Role pada sidebar. Enam bagian: Beranda, Gaji Saya, Kasbon Saya, Jadwal Saya, Absensi Saya, Cuti & Izin. POS dikerjakan pada tahap terpisah.

## Akun dan hak akses

Gunakan role baru `Portal Karyawan` pada akun login yang dihubungkan ke data karyawan aktif. Role ini hanya memberikan `portal-karyawan`; server mengikat semua pembacaan dan pengajuan pribadi ke `users.employeeId`, bukan ID dari browser. Owner dapat memilih pratinjau karyawan; mode tersebut hanya membaca. Hak `portal-review` mengizinkan pemeriksaan wajah, bukti absensi, dan cuti/izin. Kasbon tetap disetujui melalui kewenangan Kasbon yang sudah ada.

## Integrasi data

Gaji menampilkan maksimal 24 payroll PAID terbaru; draft dan dibatalkan disembunyikan. Sisa kasbon memakai ledger kasbon dan pembayaran APPROVED yang sama dengan payroll. Pengajuan portal menghasilkan LOAN PENDING dengan kunci idempotensi. Permintaan cuti/izin maksimal 31 hari dan tidak boleh bertumpuk dengan permintaan aktif. Permintaan PENDING dapat dibatalkan karyawan. Persetujuan cuti/libur mengubah jadwal menjadi LIBUR; izin/sakit membuat catatan ketidakhadiran. Pembuatan/perubahan jadwal kerja ditolak jika bertabrakan dengan pengajuan yang sudah disetujui. Kuota dan kebijakan cuti berbayar belum ditentukan; tidak ada kuota buatan.

## Absensi kamera

FaceAPI 1.7.15 dan model dimuat dari aset lokal, dengan lisensi MIT disertakan. Wajah harus didaftarkan dengan persetujuan karyawan dan diperiksa admin. Foto dan descriptor disimpan dalam database, bukan direktori publik. Endpoint foto hanya melayani pemilik data atau pemeriksa yang berwenang dan memakai no-store.

Pencocokan satu wajah dilakukan di browser; jarak descriptor diperiksa server (batas awal 0,48). Setelah lolos, antarmuka meminta kamera belakang dan pengguna memotret gerobak/area kerja. Jam berasal dari server saat wajah diverifikasi. Sesi kamera kedaluwarsa setelah 3 menit, maksimal 5 percobaan pencocokan dan 10 sesi per 15 menit. Pengiriman ulang tidak menggandakan bukti. Bukti PENDING wajib diperiksa admin sebelum menjadi Attendance untuk payroll. Pemeriksaan ulang menolak jadwal/absensi yang berubah dan periode payroll yang sudah dibayar. Jadwal lewat tengah malam didukung.

Ini pencocokan wajah dengan pemeriksaan admin; belum mencakup liveness/PAD tersertifikasi. Browser/client bukan sumber pembuktian yang tahan manipulasi. Jangan menghapus tahap persetujuan admin tanpa evaluasi pengamanan tambahan. Kamera depan/belakang, izin HTTPS, ketepatan ambang, kondisi cahaya, dan variasi wajah harus diuji di HP operasional sebelum penggunaan harian.

## Verifikasi

`verification/check-employee-portal-rules.ts` memeriksa descriptor, rentang cuti, waktu WIB, dan shift lewat tengah malam. `verification/verify-employee-portal-ui.cjs` memakai database sementara yang dihapus sesudah pengujian, bukan database operasional. Pengujian mencakup pembatasan data, transaksi pengajuan, persetujuan, foto privat, pemuatan model sebenarnya, penolakan tanpa wajah, dan pencocokan positif. Kamera belakang disimulasikan karena lingkungan pengujian tidak memiliki HP fisik.

Fixture wajah pengujian saja: potret resmi Barack Obama oleh Pete Souza (domain publik), https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg . Fixture tidak menjadi profil karyawan atau data aplikasi operasional.
