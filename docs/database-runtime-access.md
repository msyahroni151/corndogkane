# Rencana izin database runtime

Target: project Supabase jnmhlnxumftszhgurmgr untuk corndogkane. Role baru bukan pemilik tabel, bukan superuser, tidak memiliki BYPASSRLS/CREATEDB/CREATEROLE, dan tidak dapat membuat objek skema.

Role runtime hanya mendapat izin pada tabel aplikasi yang disebutkan secara eksplisit di [skrip kebijakan](../scripts/database-runtime-policies.sql). Izin tulis ditentukan dari operasi Prisma aplikasi yang sudah ditinjau. Tidak ada grant untuk tabel baru di masa depan atau tabel extension. Audit hanya dapat dibaca dan ditambahkan, tidak diubah atau dihapus. Riwayat migrasi tidak dapat diakses runtime.

Role backup hanya dapat membaca tabel aplikasi dan riwayat migrasi; satu pengecualian adalah menambah/memperbarui status pekerjaan pada security_backup_runs. Tidak dapat mengubah data bisnis. Password role baru dibuat acak terpisah; password Owner dan data bisnis tidak berubah.

| Tabel | Izin runtime |
|---|---|
| access_roles | INSERT, SELECT, UPDATE |
| areas | DELETE, INSERT, SELECT, UPDATE |
| asset_events | INSERT, SELECT |
| attendance | INSERT, SELECT, UPDATE |
| employees | INSERT, SELECT, UPDATE |
| financial_accounts | INSERT, SELECT, UPDATE |
| fixed_assets | INSERT, SELECT, UPDATE |
| goods_receipt_lines | SELECT, UPDATE |
| goods_receipts | INSERT, SELECT |
| inventory_batches | INSERT, SELECT, UPDATE |
| inventory_items | DELETE, INSERT, SELECT, UPDATE |
| inventory_movements | INSERT, SELECT |
| inventory_operations | INSERT, SELECT |
| inventory_recipes | DELETE, INSERT, SELECT |
| journal_transactions | INSERT, SELECT |
| login_throttles | DELETE, INSERT, SELECT, UPDATE |
| mfa_challenges | DELETE, INSERT, SELECT, UPDATE |
| mfa_credentials | INSERT, SELECT, UPDATE |
| money_entries | INSERT, SELECT, UPDATE |
| operational_expenses | INSERT, SELECT, UPDATE |
| outlet_daily_statuses | INSERT, SELECT, UPDATE |
| outlet_operations | INSERT, SELECT, UPDATE |
| outlet_stock_events | INSERT, SELECT |
| outlet_stock_order_lines | SELECT, UPDATE |
| outlet_stock_orders | INSERT, SELECT, UPDATE |
| outlet_stocks | INSERT, SELECT, UPDATE |
| outlets | INSERT, SELECT, UPDATE |
| partners | INSERT, SELECT, UPDATE |
| payrolls | INSERT, SELECT, UPDATE |
| placements | INSERT, SELECT |
| portal_captures | INSERT, SELECT, UPDATE |
| portal_challenges | DELETE, INSERT, SELECT, UPDATE |
| portal_faces | INSERT, SELECT, UPDATE |
| portal_leaves | INSERT, SELECT, UPDATE |
| production_plans | INSERT, SELECT, UPDATE |
| production_remainders | INSERT, SELECT |
| receipt_templates | INSERT, SELECT, UPDATE |
| sale_lines | INSERT, SELECT |
| sale_transactions | INSERT, SELECT, UPDATE |
| sales_decisions | INSERT, SELECT |
| schedule_area_notes | INSERT, SELECT, UPDATE |
| schedules | DELETE, INSERT, SELECT, UPDATE |
| security_alerts | INSERT, SELECT, UPDATE |
| security_backup_runs | SELECT |
| security_events | INSERT, SELECT |
| security_settings | INSERT, SELECT, UPDATE |
| sequence_counters | INSERT, SELECT, UPDATE |
| sessions | DELETE, INSERT, SELECT |
| settlement_deductions | INSERT, SELECT |
| settlement_reviews | INSERT, SELECT |
| stock_return_actions | INSERT, SELECT |
| stock_return_lines | INSERT, SELECT, UPDATE |
| stock_return_receipt_lines | INSERT, SELECT |
| stock_returns | INSERT, SELECT, UPDATE |
| users | INSERT, SELECT, UPDATE |

## Penyiapan kredensial tanpa mencetak verifier

Akun migrasi corndog_demo_app memerlukan keanggotaan sementara untuk SET ROLE ke corndog_runtime dan corndog_backup. INHERIT dinonaktifkan dan arah keanggotaan tidak dibalik: runtime tidak menjadi anggota role pemilik tabel. Tujuannya hanya memasang password baru langsung ke PostgreSQL tanpa menampilkan password atau verifier pada output alat. Setelah koneksi baru diverifikasi, kedua keanggotaan sementara dicabut. [Skrip penyiapan tanpa secret](../scripts/database-runtime-role-bootstrap.sql).
