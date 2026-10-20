// Keep each job title's color stable across searches, sorting, and pages.
const colors: Record<string, string> = {
  "AREA SUPERVISOR": "border-blue-200 bg-blue-50 text-blue-800",
  "ADMIN OPERASIONAL MALAM": "border-lime-200 bg-lime-50 text-lime-800",
  "CREW OUTLET": "border-emerald-100 bg-emerald-50/60 text-emerald-800",
  "CREW BACKUP": "border-violet-200 bg-violet-50 text-violet-800",
  "LEADER GUDANG": "border-amber-200 bg-amber-50 text-amber-800",
  "CREW GUDANG": "border-orange-200 bg-orange-50 text-orange-800",
  MANAJEMEN: "border-indigo-200 bg-indigo-50 text-indigo-800",
  "OPERASIONAL OUTLET": "border-teal-200 bg-teal-50 text-teal-800",
  "GUDANG & PRODUKSI": "border-yellow-200 bg-yellow-50 text-yellow-800",
  PURCHASING: "border-cyan-200 bg-cyan-50 text-cyan-800",
  "MAINTENANCE & ASSET": "border-stone-200 bg-stone-50 text-stone-800",
  "FINANCE & ACCOUNTING": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "HR & GENERAL AFFAIRS": "border-pink-200 bg-pink-50 text-pink-800",
  MARKETING: "border-rose-200 bg-rose-50 text-rose-800",
  "IT SYSTEM & DATA": "border-sky-200 bg-sky-50 text-sky-800",
  "GENERAL MANAGER": "border-purple-200 bg-purple-50 text-purple-800",
  DIREKTUR: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
};

export function positionBadgeClass(position?: string | null): string {
  const key = position?.trim().replace(/\s+/g, " ").toUpperCase() || "";
  return Object.hasOwn(colors, key) ? colors[key] : "border-slate-200 bg-slate-50 text-slate-700";
}
