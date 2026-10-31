import SearchForm from "next/form";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { permissionMenus, rolePermissions } from "@/lib/permissions";
import { SortableTable } from "@/components/sortable-table";
import { FormDialog } from "@/components/form-dialog";
import { AccessRoleForm, LoginAccountForm } from "@/components/role-settings-forms";
function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
    >
      {active ? "AKTIF" : "TIDAK AKTIF"}
    </span>
  );
}
export default async function RolePage({
  searchParams,
}: {
  searchParams: Promise<{ roleq?: string; accountq?: string }>;
}) {
  await requireAccess("role");
  const query = await searchParams;
  const roleq = typeof query.roleq === "string" ? query.roleq.trim().slice(0, 100) : "";
  const accountq = typeof query.accountq === "string" ? query.accountq.trim().slice(0, 100) : "";
  const [roles, accounts, employees] = await Promise.all([
    getPrisma().accessRole.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    getPrisma().user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        employeeId: true,
        roleId: true,
        updatedAt: true,
        role: { select: { name: true, active: true } },
        employee: { select: { active: true } },
      },
    }),
    getPrisma().employee.findMany({
      where: { active: true, loginAccount: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);
  const visibleRoles = roles.filter((role) =>
    [role.name, role.description || ""].some((text) =>
      text.toLocaleLowerCase("id-ID").includes(roleq.toLocaleLowerCase("id-ID")),
    ),
  );
  const visibleAccounts = accounts.filter((account) =>
    [account.name, account.email, account.employeeId || "", account.role?.name || ""].some((text) =>
      text.toLocaleLowerCase("id-ID").includes(accountq.toLocaleLowerCase("id-ID")),
    ),
  );
  const choices = employees.map((employee) => ({ id: employee.id, name: employee.fullName }));
  const roleChoices = roles.map((role) => ({ id: role.id, name: role.name, active: role.active }));
  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <h2 className="text-sm font-semibold">Daftar role · {visibleRoles.length}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchForm action="" prefetch={false} scroll={false} className="flex gap-2">
              <input type="hidden" name="accountq" value={accountq} />
              <input
                aria-label="Cari role"
                name="roleq"
                defaultValue={roleq}
                placeholder="Cari role…"
                className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button className="button-secondary">Cari</button>
            </SearchForm>
            <FormDialog title="Tambah role" trigger="+ Tambah role">
              <AccessRoleForm />
            </FormDialog>
          </div>
        </div>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[680px] text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Role", "Hak akses", "Akun", "Status", "Aksi"].map((title) => (
                  <th key={title} className="p-4 font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRoles.map((role) => {
                const permissions = rolePermissions(role);
                return (
                  <tr key={role.id} className="border-t border-slate-100">
                    <td className="p-4 font-semibold">
                      <p>{role.name}</p>
                      {role.description && (
                        <p className="mt-1 max-w-xs font-normal text-slate-500">
                          {role.description}
                        </p>
                      )}
                    </td>
                    <td className="max-w-md p-4" data-sort-value={permissions.length}>
                      {role.systemKey === "OWNER" ? (
                        "Semua menu"
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {permissions.length
                            ? permissions.map((key) => (
                                <span
                                  key={key}
                                  className="rounded-md bg-slate-100 px-2 py-1 text-slate-600"
                                >
                                  {permissionMenus.find((menu) => menu.key === key)?.label}
                                </span>
                              ))
                            : "Belum ada akses"}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{role._count.users}</td>
                    <td className="p-4">
                      <Status active={role.active} />
                    </td>
                    <td className="p-4">
                      <FormDialog title="Edit role" trigger="Edit">
                        <AccessRoleForm
                          values={{
                            id: role.id,
                            name: role.name,
                            description: role.description,
                            active: role.active,
                            systemKey: role.systemKey,
                            permissions,
                            version: role.updatedAt.toISOString(),
                          }}
                        />
                      </FormDialog>
                    </td>
                  </tr>
                );
              })}
              {!visibleRoles.length && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    Tidak ada role ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
      </section>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <h2 className="text-sm font-semibold">Akun login · {visibleAccounts.length}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchForm action="" prefetch={false} scroll={false} className="flex gap-2">
              <input type="hidden" name="roleq" value={roleq} />
              <input
                aria-label="Cari akun login"
                name="accountq"
                defaultValue={accountq}
                placeholder="Cari karyawan, email, role…"
                className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button className="button-secondary">Cari</button>
            </SearchForm>
            <FormDialog title="Tambah akun login" trigger="+ Tambah akun">
              <LoginAccountForm employees={choices} roles={roleChoices} />
            </FormDialog>
          </div>
        </div>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[680px] text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Karyawan", "Email login", "Role", "Status", "Aksi"].map((title) => (
                  <th key={title} className="p-4 font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleAccounts.map((account) => (
                <tr key={account.id} className="border-t border-slate-100">
                  <td className="p-4">
                    <p className="font-semibold">{account.name}</p>
                    <p className="mt-1 text-slate-500">{account.employeeId || "Administrator"}</p>
                  </td>
                  <td className="p-4">{account.email}</td>
                  <td className="p-4">{account.role?.name || "Belum diatur"}</td>
                  <td className="p-4">
                    <Status
                      active={
                        account.active &&
                        !!account.role?.active &&
                        account.employee?.active !== false
                      }
                    />
                  </td>
                  <td className="p-4">
                    <FormDialog title="Edit akun login" trigger="Edit">
                      <LoginAccountForm
                        values={{
                          id: account.id,
                          name: account.name,
                          email: account.email,
                          employeeId: account.employeeId,
                          roleId: account.roleId,
                          active: account.active,
                          version: account.updatedAt.toISOString(),
                        }}
                        employees={choices}
                        roles={roleChoices}
                      />
                    </FormDialog>
                  </td>
                </tr>
              ))}
              {!visibleAccounts.length && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    Tidak ada akun ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
      </section>
      <p className="text-xs leading-5 text-slate-500">
        Hak akses mengikuti role akun login dan terpisah dari jabatan, gaji, serta jadwal karyawan.
        Perubahan password, role, atau status akun mengakhiri sesi login terkait.
      </p>
    </div>
  );
}
