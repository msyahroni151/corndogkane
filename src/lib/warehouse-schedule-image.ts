import { timeLabel } from "@/lib/schedules";
export type WarehouseScheduleData = {
  from: string;
  to: string;
  employees: { id: string; name: string }[];
  rows: {
    employeeId: string;
    date: string;
    status: string;
    shift: string | null;
    startMinutes: number | null;
    endMinutes: number | null;
  }[];
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
function nameLines(name: string) {
  return name.match(/.{1,16}/gu) || ["—"];
}
export function warehouseScheduleSvg(data: WarehouseScheduleData) {
  const dates: string[] = [];
  for (
    let d = new Date(data.from + "T00:00:00Z");
    d <= new Date(data.to + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  )
    dates.push(d.toISOString().slice(0, 10));
  const employees = data.employees,
    margin = 12,
    dateWidth = 156,
    dayWidth = 100,
    crewWidth = 160;
  const width = Math.max(600, margin * 2 + dateWidth + dayWidth + crewWidth * employees.length),
    gridWidth = width - margin * 2,
    cellWidth = employees.length
      ? (gridWidth - dateWidth - dayWidth) / employees.length
      : crewWidth;
  const parts: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#bdcbbf" stroke-width="1"/>`,
    );
  const label = (
    lines: string[],
    x: number,
    y: number,
    w: number,
    h: number,
    bold = false,
    color = "#183c35",
    size = 13,
  ) => {
    const lineHeight = size + 3,
      top = y + (h - lines.length * lineHeight) / 2 + size;
    parts.push(
      `<text font-family="Arial, sans-serif" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${color}" text-anchor="middle">${lines.map((s, i) => `<tspan x="${x + w / 2}" y="${top + i * lineHeight}">${escape(s)}</tspan>`).join("")}</text>`,
    );
  };
  rect(margin, 12, gridWidth, 64, "#426554");
  label(
    ["JADWAL BULANAN - CREW GUDANG", `PERIODE ${longDate(data.from)} – ${longDate(data.to)}`],
    margin,
    12,
    gridWidth,
    64,
    true,
    "#ffffff",
    15,
  );
  const q = gridWidth / 4;
  for (const [i, text] of [
    "Tanggal awal",
    longDate(data.from),
    "Tanggal akhir",
    longDate(data.to),
  ].entries()) {
    rect(margin + i * q, 76, q, 28, i % 2 ? "#fff2ce" : "#ffffff");
    label([text], margin + i * q, 76, q, 28, false, "#183c35", 12);
  }
  let y = 120;
  const headerHeight = Math.max(34, ...employees.map((e) => nameLines(e.name).length * 16 + 12));
  rect(margin, y, dateWidth, headerHeight, "#e1edda");
  label(["Tanggal"], margin, y, dateWidth, headerHeight, true);
  rect(margin + dateWidth, y, dayWidth, headerHeight, "#e1edda");
  label(["Hari"], margin + dateWidth, y, dayWidth, headerHeight, true);
  for (const [i, e] of employees.entries()) {
    const x = margin + dateWidth + dayWidth + i * cellWidth;
    rect(x, y, cellWidth, headerHeight, "#e1edda");
    label(nameLines(e.name), x, y, cellWidth, headerHeight, true);
  }
  y += headerHeight;
  const indexed = new Map(data.rows.map((r) => [r.employeeId + ":" + r.date, r]));
  for (const date of dates) {
    rect(margin, y, dateWidth, 42, "#ffffff");
    label([longDate(date)], margin, y, dateWidth, 42, false, "#183c35", 12);
    rect(margin + dateWidth, y, dayWidth, 42, "#ffffff");
    label(
      [
        new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(
          new Date(date + "T00:00:00Z"),
        ),
      ],
      margin + dateWidth,
      y,
      dayWidth,
      42,
      false,
      "#183c35",
      12,
    );
    for (const [i, e] of employees.entries()) {
      const row = indexed.get(e.id + ":" + date),
        x = margin + dateWidth + dayWidth + i * cellWidth;
      const fill = !row
        ? "#ffffff"
        : row.status === "LIBUR"
          ? "#f8dddd"
          : row.status !== "KERJA"
            ? "#f2f2ed"
            : row.shift === "FULL"
              ? "#ffe3b9"
              : row.shift === "S2"
                ? "#dce8fb"
                : "#dceedd";
      const lines = !row
        ? ["—"]
        : row.status !== "KERJA"
          ? [row.status]
          : [
              row.shift === "FULL" ? "[S1-S2]" : row.shift ? `[${row.shift}]` : "KERJA",
              row.startMinutes === null || row.endMinutes === null
                ? "Jam belum diatur"
                : `${timeLabel(row.startMinutes)}–${timeLabel(row.endMinutes)}`,
            ];
      rect(x, y, cellWidth, 42, fill);
      label(lines, x, y, cellWidth, 42, false, row?.status === "LIBUR" ? "#ac2424" : "#183c35", 12);
    }
    y += 42;
  }
  for (const [status, title] of [
    ["KERJA", "TOTAL KERJA"],
    ["LIBUR", "TOTAL LIBUR"],
  ]) {
    rect(margin, y, dateWidth + dayWidth, 30, "#e1edda");
    label([title], margin, y, dateWidth + dayWidth, 30, true);
    for (const [i, e] of employees.entries()) {
      const x = margin + dateWidth + dayWidth + i * cellWidth,
        count = data.rows.filter(
          (r) =>
            r.employeeId === e.id &&
            r.date >= data.from &&
            r.date <= data.to &&
            r.status === status,
        ).length;
      rect(x, y, cellWidth, 30, "#e1edda");
      label([String(count)], x, y, cellWidth, 30, true);
    }
    y += 30;
  }
  label(
    ["Jam WIB · — belum dijadwalkan · Full shift dihitung 1 hari kerja"],
    margin,
    y,
    gridWidth,
    30,
    false,
    "#657b6f",
    11,
  );
  y += 36;
  return {
    width,
    height: y,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}" role="img"><title>Jadwal crew gudang ${escape(longDate(data.from))} – ${escape(longDate(data.to))}</title><rect width="100%" height="100%" fill="#ffffff"/>${parts.join("")}</svg>`,
  };
}
