import type { OutletRecapRow } from "@/lib/outlet-recap";
import { operationalCash } from "@/lib/outlet-operations";
export type RecapOutlet = { id: string; name: string; areaId: string; areaName: string };
export function summarizeRecap(rows: OutletRecapRow[], outlets: RecapOutlet[]) {
  const all = new Map(outlets.map((o) => [o.id, { id: o.id, name: o.name }]));
  for (const row of rows) all.set(row.outletId, { id: row.outletId, name: row.outletName });
  return [...all.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
    .map((outlet) => {
      const entries = rows.filter((row) => row.outletId === outlet.id);
      const sum = (key: "totalGross" | "qris" | "expenseAmount" | "cashReceived" | "bonusAmount") =>
        entries.reduce((n, r) => n + (r[key] ?? 0), 0);
      const cash = entries.reduce((n, r) => n + operationalCash(r), 0);
      const realKnown = entries.length > 0 && entries.every((r) => r.cashReceived != null);
      return {
        ...outlet,
        known: entries.length > 0,
        gross: sum("totalGross"),
        expense: sum("expenseAmount"),
        qris: sum("qris"),
        online: entries.reduce((n, r) => n + r.gofood + r.grabfood + r.shopeefood, 0),
        cash,
        bonus:
          entries.length && entries.every((r) => r.bonusAmount != null) ? sum("bonusAmount") : null,
        real: realKnown ? sum("cashReceived") : null,
        difference: realKnown ? sum("cashReceived") - cash : null,
        crew: [...new Set(entries.map((r) => r.crewCode || r.crewName))].join(", "),
        training: [...new Set(entries.map((r) => r.trainingCrewName).filter(Boolean))].join(", "),
      };
    });
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
const money = (n: number | null) =>
  n == null ? "—" : (n < 0 ? "- Rp " : "Rp ") + Math.abs(n).toLocaleString("id-ID");
export function outletRecapSvg(
  rows: OutletRecapRow[],
  outlets: RecapOutlet[],
  start: string,
  end: string,
  scope: string,
) {
  const data = summarizeRecap(rows, outlets);
  const widths = [42, 170, 132, 123, 132, 132, 132, 132, 132, 132, 155, 145];
  const W = widths.reduce((a, b) => a + b, 0) + 32;
  const parts: string[] = [];
  const lines = (value: string, width: number) => {
    const max = Math.max(8, Math.floor((width - 14) / 7));
    const result: string[] = [];
    let line = "";
    for (const word of value.split(/\s+/)) {
      if (line && line.length + word.length + 1 > max) {
        result.push(line);
        line = "";
      }
      for (let p = 0; p < word.length; p += max) {
        const chunk = word.slice(p, p + max);
        if (p) {
          result.push(line);
          line = "";
        }
        line += (line ? " " : "") + chunk;
      }
    }
    if (line) result.push(line);
    return result.length ? result : ["—"];
  };
  function cell(
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fill = "#fff",
    bold = false,
    align = "left",
    color = "#111",
  ) {
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#333" stroke-width="0.7"/>`,
    );
    const wrapped = lines(text, w);
    wrapped.forEach((line, i) =>
      parts.push(
        `<text x="${align === "right" ? x + w - 7 : align === "middle" ? x + w / 2 : x + 7}" y="${y + (h - wrapped.length * 17) / 2 + 13 + i * 17}" font-size="13" font-weight="${bold ? 700 : 400}" text-anchor="${align === "right" ? "end" : align === "middle" ? "middle" : "start"}" fill="${color}">${esc(line)}</text>`,
      ),
    );
  }
  const date = (d: string) =>
    new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(d + "T00:00:00Z"));
  cell(
    start === end ? date(start) : `${date(start)} – ${date(end)}`,
    16,
    16,
    W - 32,
    38,
    "#fff",
    true,
    "middle",
  );
  cell(`REKAP PENJUALAN OUTLET · ${scope}`, 16, 54, W - 32, 28, "#eaf0eb", true, "middle");
  let x = 16;
  const heads = [
    "NO",
    "CABANG",
    "OMZET",
    "BONUS",
    "PENGELUARAN",
    "ONLINE FOOD",
    "QRIS",
    "CASH",
    "REAL",
    "SELISIH",
    "NAMA",
    "TRAINING",
  ];
  heads.forEach((t, i) => {
    cell(t, x, 82, widths[i], 30, i >= 10 ? "#a9d37b" : "#fff", true, "middle");
    x += widths[i];
  });
  let y = 112;
  for (const [idx, r] of data.entries()) {
    const values = [
      String(idx + 1),
      r.name,
      money(r.known ? r.gross : null),
      money(r.bonus),
      money(r.known ? r.expense : null),
      money(r.known ? r.online : null),
      money(r.known ? r.qris : null),
      money(r.known ? r.cash : null),
      money(r.real),
      money(r.difference),
      r.crew,
      r.training,
    ];
    const h = Math.max(30, ...values.map((v, i) => lines(v, widths[i]).length * 17 + 12));
    x = 16;
    values.forEach((v, i) => {
      const fill =
        i >= 10
          ? "#e3efd5"
          : i === 9 && r.difference != null && r.difference !== 0
            ? "#fff2a8"
            : i === 4 && r.known
              ? r.expense
                ? "#f2d2ca"
                : "#c6e3d0"
              : i === 2 && r.known
                ? "#d5e9dc"
                : "#fff";
      cell(
        v,
        x,
        y,
        widths[i],
        h,
        fill,
        i >= 10,
        i === 0 ? "middle" : i >= 2 && i <= 9 ? "right" : "left",
        i === 9 && r.difference != null && r.difference < 0 ? "#a12626" : "#111",
      );
      x += widths[i];
    });
    y += h;
  }
  const known = data.filter((r) => r.known);
  const sum = (key: "gross" | "expense" | "online" | "qris" | "cash") =>
    known.reduce((n, r) => n + r[key], 0);
  const full = (key: "bonus" | "real" | "difference") =>
    known.length && known.every((r) => r[key] != null)
      ? known.reduce((n, r) => n + (r[key] ?? 0), 0)
      : null;
  const totals = [
    "",
    "TOTAL",
    money(known.length ? sum("gross") : null),
    money(full("bonus")),
    money(known.length ? sum("expense") : null),
    money(known.length ? sum("online") : null),
    money(known.length ? sum("qris") : null),
    money(known.length ? sum("cash") : null),
    money(full("real")),
    money(full("difference")),
    "",
    "",
  ];
  x = 16;
  totals.forEach((v, i) => {
    cell(v, x, y, widths[i], 34, "#eef4ec", true, i >= 2 && i <= 9 ? "right" : "left");
    x += widths[i];
  });
  y += 34;
  for (const note of [
    "Sumber: rekap operasional tersimpan. Rentang tanggal dijumlahkan per cabang; bonus dihitung per hari.",
    "CASH = omzet − QRIS − online food − pengeluaran. SELISIH = REAL − CASH. REAL kosong: setoran belum dicatat.",
    "—: belum ada data. Total REAL/SELISIH ditampilkan setelah semua setoran pada rekap terisi.",
  ]) {
    parts.push(`<text x="16" y="${y + 23}" font-size="12" fill="#526057">${esc(note)}</text>`);
    y += 24;
  }
  y += 16;
  return {
    width: W,
    height: y,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" role="img"><title>Rekap Penjualan Outlet</title><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif">${parts.join("")}</g></svg>`,
  };
}
