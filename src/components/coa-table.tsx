"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { coaRoot, normalBalanceLabel, type CoaAccount } from "@/lib/coa";
import { accountKinds } from "@/lib/general-journal";
import { FormDialog } from "@/components/form-dialog";
import { FinancialAccountForm } from "@/components/journal-forms";
import { setFinancialAccountStatus } from "@/app/journal-actions";
import { notifySuccess } from "@/components/notification-toasts";
import "./coa-table.css";
export function CoaTable({ accounts }: { accounts: CoaAccount[] }) {
  const [kind, setKind] = useState(""),
    [q, setQ] = useState(""),
    [open, setOpen] = useState<Set<string>>(new Set()),
    [error, setError] = useState("");
  const filtered = accounts.filter(
    (a) =>
      (!kind || a.kind === kind) &&
      (!q ||
        [a.code, a.name, a.subGroup, a.groupName]
          .join(" ")
          .toLocaleLowerCase("id-ID")
          .includes(q.toLocaleLowerCase("id-ID"))),
  );
  const grouped = new Map<string, { name: string; accounts: CoaAccount[] }>();
  for (const a of filtered) {
    const root = coaRoot(a);
    if (!grouped.has(root.code)) grouped.set(root.code, { name: root.name, accounts: [] });
    grouped.get(root.code)!.accounts.push(a);
  }
  const toggle = (key: string) =>
    setOpen((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const normal = (rows: CoaAccount[]) =>
    normalBalanceLabel(
      new Set(rows.map((a) => a.normalBalance)).size > 1
        ? "BOTH"
        : rows[0]?.normalBalance || "DEBIT",
    );
  return (
    <section className="panel coa-panel">
      <div className="coa-head">
        <div>
          <h2>Chart of Accounts (COA)</h2>
          <p>Pengaturan daftar akun standar untuk pembukuan · {accounts.length} akun</p>
        </div>
        <FormDialog title="Akun Baru" trigger="+ Akun Baru">
          <FinancialAccountForm />
        </FormDialog>
      </div>
      <div className="coa-filters">
        <div className="coa-chips" role="group" aria-label="Filter kelompok akun">
          {[
            ["", "Semua"],
            ["ASET", "Harta (Asset)"],
            ["KEWAJIBAN", "Kewajiban (Liability)"],
            ["MODAL", "Modal (Equity)"],
            ["PENDAPATAN", "Pendapatan (Revenue)"],
            ["HPP", "HPP (COGS)"],
            ["BEBAN", "Beban (Expense)"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={kind === value}
              className={kind === value ? "selected" : ""}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          aria-label="Cari kode atau nama akun"
          placeholder="Cari kode atau nama akun…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="coa-table">
          <thead>
            <tr>
              {["KODE", "NAMA AKUN", "GRUP", "SALDO NORMAL", "TIPE", "STATUS", "AKSI"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...grouped]
              .sort(([a], [b]) => a.localeCompare(b))
              .flatMap(([code, group]) => {
                const subs = [...new Set(group.accounts.map((a) => a.subGroup || "Lainnya"))],
                  expanded = !!q || !!kind || open.has(code);
                const root = (
                  <tr key={code} className="coa-root">
                    <td>
                      <code>{code}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="coa-expand"
                        onClick={() => toggle(code)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Tutup" : "Buka"} ${group.name}`}
                      >
                        <span aria-hidden="true">{expanded ? "⌄" : "›"}</span>
                        <strong>{group.name}</strong>
                        <small>{subs.length} sub</small>
                      </button>
                    </td>
                    <td>
                      <span className="coa-badge" data-kind={coaRoot(group.accounts[0]).kind}>
                        {accountKinds[coaRoot(group.accounts[0]).kind as keyof typeof accountKinds]}
                      </span>
                    </td>
                    <td className="coa-normal">{normal(group.accounts)}</td>
                    <td>
                      <span className="coa-type">GRUP</span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-500">
                        {group.accounts.filter((a) => a.active).length}/{group.accounts.length}{" "}
                        aktif
                      </span>
                    </td>
                    <td>—</td>
                  </tr>
                );
                if (!expanded) return [root];
                return [
                  root,
                  ...subs.flatMap((sub) => {
                    const rows = group.accounts.filter((a) => (a.subGroup || "Lainnya") === sub),
                      key = code + ":" + sub,
                      shown = !!q || !!kind || open.has(key);
                    return [
                      <tr key={key} className="coa-sub">
                        <td />
                        <td colSpan={6}>
                          <button
                            type="button"
                            aria-expanded={shown}
                            aria-label={`${shown ? "Tutup" : "Buka"} subkelompok ${sub}`}
                            className="coa-expand"
                            onClick={() => toggle(key)}
                          >
                            <span aria-hidden="true">{shown ? "⌄" : "›"}</span>
                            <strong>{sub}</strong>
                            <small>{rows.length} akun</small>
                          </button>
                        </td>
                      </tr>,
                      ...(shown
                        ? rows
                            .sort((a, b) =>
                              a.code.localeCompare(b.code, "id-ID", { numeric: true }),
                            )
                            .map((a) => (
                              <tr key={a.id}>
                                <td>
                                  <code>{a.code}</code>
                                </td>
                                <td className="coa-account-name">
                                  <span title={a.notes}>{a.name}</span>
                                  {a.sourceStatus === "OPSIONAL" && <small>Opsional</small>}
                                </td>
                                <td>
                                  <span className="coa-badge" data-kind={a.kind}>
                                    {accountKinds[a.kind as keyof typeof accountKinds]}
                                  </span>
                                </td>
                                <td className="coa-normal" data-side={a.normalBalance}>
                                  {normalBalanceLabel(a.normalBalance)}
                                </td>
                                <td>
                                  <span className="coa-type">
                                    {a.sourceType === "SYSTEM" ? "SISTEM" : "CUSTOM"}
                                  </span>
                                </td>
                                <td>
                                  <StatusToggle account={a} onError={setError} />
                                </td>
                                <td>
                                  <FormDialog title="Edit Akun" trigger="Edit">
                                    <FinancialAccountForm record={a} />
                                  </FormDialog>
                                </td>
                              </tr>
                            ))
                        : []),
                    ];
                  }),
                ];
              })}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="!p-12 text-center text-slate-500">
                  Tidak ada akun yang sesuai filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function StatusToggle({ account, onError }: { account: CoaAccount; onError: (s: string) => void }) {
  const [pending, start] = useTransition(),
    router = useRouter();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={account.active}
      aria-label={`Status akun ${account.code} ${account.name}`}
      title={account.active ? "Aktif" : "Nonaktif"}
      disabled={pending}
      className="coa-switch"
      onClick={() =>
        start(async () => {
          onError("");
          const form = new FormData();
          form.set("id", account.id);
          form.set("version", account.version);
          form.set("active", String(!account.active));
          const result = await setFinancialAccountStatus({}, form);
          if (result.error) onError(result.error);
          else {
            notifySuccess(result.success || "Status akun diperbarui.");
            router.refresh();
          }
        })
      }
    >
      <span />
    </button>
  );
}
