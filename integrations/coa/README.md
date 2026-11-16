# MASTER_COA import

Source: https://docs.google.com/spreadsheets/d/1oP3wEpsDtUcQeD248Sl_Xv7r9y0IJfZyhFi1XojCADQ/edit#gid=810101

The verified snapshot contains 133 accounts read from MASTER_COA!A3:J300 on 2026-10-19. The source spreadsheet is read-only. This is a one-time import, not a live synchronization.

All ten source columns are preserved. ASET maps to ASET, EKUITAS to MODAL, HPP to HPP, and BEBAN OPERASIONAL to BEBAN. NON-OPERASIONAL accounts 71xx map to PENDAPATAN, 72xx to BEBAN. Debit/Kredit becomes BOTH. The optional 1299 account starts inactive and can be activated explicitly. No reserved liability accounts, opening balances, or historical journals are invented or imported.

`node scripts/import-master-coa.cjs` validates the snapshot without writing. `--apply` imports inside one transaction and requires an active Owner for its audit reference. Existing matching accounts are retained; conflicting codes abort the import instead of overwriting changes. Back up the database before applying changes.

Group and subgroup headers in the COA table are display-only. Journals post only to real active leaf accounts. SYSTEM account codes cannot be changed through the account form. Existing journal account names/codes remain snapshots when an account is renamed or disabled.

`node scripts/import-master-coa.cjs --with-outlet-mapping` validates the 133 master accounts and the 18 supplementary accounts in `outlet-accounts-v1.json`. Adding `--apply` reads the connection from `.env.local` and imports both sets in one transaction into local `corndog_hris` only. The supplementary accounts include inactive reservations for 1210, 2101 and 4103.
