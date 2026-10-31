import { dateToDisplay } from "@/lib/local-date";
import {
  shareDayLabel,
  shareWeeks,
  type SharePanel,
  type ShareScheduleData,
} from "@/lib/share-schedule";
const W = 1600,
  M = 16,
  GAP = 16,
  PW = (W - M * 2 - GAP) / 2,
  NO = 28,
  OUTLET = 116,
  FONT = 11,
  LH = 14;
const C = {
  green: "#3b6051",
  pale: "#e5efdd",
  line: "#b8cad7",
  ink: "#17354a",
  backup: "#cbe4d8",
  closed: "#fbe1e1",
};
// Escape every user-supplied label before embedding it in SVG.
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
function wrap(value: string, width: number): string[] {
  const max = Math.max(4, Math.floor((width - 10) / (FONT * 0.53))),
    result: string[] = [];
  for (const block of value.split(/\n/)) {
    let line = "";
    for (const word of block.split(/\s+/).filter(Boolean)) {
      if (line && line.length + word.length + 1 > max) {
        result.push(line);
        line = "";
      }
      let rest = word;
      while (rest.length > max) {
        if (line) {
          result.push(line);
          line = "";
        }
        result.push(rest.slice(0, max));
        rest = rest.slice(max);
      }
      line += (line ? " " : "") + rest;
    }
    if (line) result.push(line);
  }
  return result.length ? result : ["—"];
}
function panelHeight(p: SharePanel, note: string) {
  const dw = (PW - NO - OUTLET) / p.days.length;
  return (
    58 +
    p.outlets.reduce(
      (sum, o) =>
        sum +
        Math.max(
          36,
          wrap(o.name, OUTLET).length * LH + 12,
          ...o.cells.map((cell) =>
            cell.reduce(
              (n, e) =>
                n +
                (wrap(e.name + (e.backup ? " [B]" : " [R]"), dw).length +
                  wrap(e.hours, dw).length) *
                  LH +
                8,
              0,
            ),
          ),
        ),
      0,
    ) +
    (p.outlets.length ? 0 : 32) +
    [p.leave, p.standby].reduce(
      (sum, cells) =>
        sum + Math.max(28, ...cells.map((names) => wrap(names.join("\n"), dw).length * LH + 10)),
      0,
    ) +
    Math.max(28, wrap(note || "—", PW - NO - OUTLET).length * LH + 10) +
    (p.unassigned.some((c) => c.length)
      ? Math.max(32, ...p.unassigned.map((c) => wrap(c.join("\n"), dw).length * LH + 10))
      : 0)
  );
}
export function scheduleSvg(
  data: ShareScheduleData,
  scope: string,
  notes: Record<string, string> | string,
) {
  const noteFor = (panel: SharePanel) =>
    typeof notes === "string" ? notes : notes[panel.id] || "";
  const W = scope ? PW + M * 2 : 1600;
  const weeks = shareWeeks(data, scope);
  let y = 94;
  const parts: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${C.line}" stroke-width="1"/>`,
    );
  const label = (
    lines: string[],
    x: number,
    y: number,
    width: number,
    height: number,
    bold = false,
    size = FONT,
    color = C.ink,
  ) => {
    const top = y + (height - lines.length * LH) / 2 + LH * 0.8;
    parts.push(
      `<text fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="middle">${lines.map((s, i) => `<tspan x="${x + width / 2}" y="${top + i * LH}">${escape(s)}</tspan>`).join("")}</text>`,
    );
  };
  rect(M, 12, W - M * 2, 36, C.green);
  const heading = scope
    ? "JADWAL OPERASIONAL · " + (data.areas.find((a) => a.id === scope)?.name || "AREA TERPILIH")
    : "JADWAL OPERASIONAL · SELURUH AREA";
  label(
    [heading],
    M,
    12,
    W - M * 2,
    36,
    true,
    Math.min(18, (W - M * 2 - 24) / (heading.length * 0.56)),
    "#ffffff",
  );
  rect(M, 48, W - M * 2, 30, C.pale);
  label(
    [
      `Tanggal awal: ${dateToDisplay(data.from)}     |     Tanggal akhir: ${dateToDisplay(data.to)}`,
    ],
    M,
    48,
    W - M * 2,
    30,
    true,
    12,
  );
  function panel(p: SharePanel, x: number, top: number) {
    const note = noteFor(p);
    let py = top;
    const dw = (PW - NO - OUTLET) / p.days.length;
    rect(x, py, PW, 28, C.green);
    label(["AREA: " + p.name], x, py, PW, 28, true, 14, "#ffffff");
    py += 28;
    const widths = [NO, OUTLET, ...p.days.map(() => dw)],
      heads = ["No.", "Outlet", ...p.days.map(shareDayLabel)];
    let cx = x;
    heads.forEach((h, i) => {
      rect(cx, py, widths[i], 30, C.pale);
      label([h], cx, py, widths[i], 30, true, 10.5);
      cx += widths[i];
    });
    py += 30;
    if (!p.outlets.length) {
      rect(x, py, PW, 32, "#ffffff");
      label(["Belum ada outlet pada area ini"], x, py, PW, 32);
      py += 32;
    }
    p.outlets.forEach((outlet, index) => {
      const cells = outlet.cells.map((cell) =>
        cell.map((e) => ({
          backup: e.backup,
          name: wrap(e.name + (e.backup ? " [B]" : " [R]"), dw),
          hours: wrap(e.hours, dw),
        })),
      );
      const h = Math.max(
        36,
        wrap(outlet.name, OUTLET).length * LH + 12,
        ...cells.map((cell) =>
          cell.reduce((n, e) => n + (e.name.length + e.hours.length) * LH + 8, 0),
        ),
      );
      const fill = index % 2 ? "#f4f7f6" : "#ffffff";
      rect(x, py, NO, h, fill);
      label([String(index + 1)], x, py, NO, h);
      rect(x + NO, py, OUTLET, h, fill);
      label(wrap(outlet.name, OUTLET), x + NO, py, OUTLET, h, true);
      cells.forEach((entries, i) => {
        const dx = x + NO + OUTLET + i * dw;
        rect(dx, py, dw, h, entries.length ? fill : C.closed);
        if (!entries.length) label(["TUTUP"], dx, py, dw, h, true, FONT, "#b42318");
        else {
          const total = entries.reduce((n, e) => n + (e.name.length + e.hours.length) * LH + 8, 0);
          let cy = py + (h - total) / 2;
          for (const e of entries) {
            const eh = (e.name.length + e.hours.length) * LH + 8;
            if (e.backup) rect(dx + 1, cy + 1, dw - 2, eh - 2, C.backup);
            label([...e.name, ...e.hours], dx, cy, dw, eh);
            cy += eh;
          }
        }
      });
      py += h;
    });
    function footer(title: string, cells: string[][], fill: string) {
      const h = Math.max(28, ...cells.map((c) => wrap(c.join("\n"), dw).length * LH + 10));
      rect(x, py, NO + OUTLET, h, C.pale);
      label(wrap(title, NO + OUTLET), x, py, NO + OUTLET, h, true, 10.5);
      cells.forEach((names, i) => {
        const dx = x + NO + OUTLET + i * dw;
        rect(dx, py, dw, h, fill);
        label(wrap(names.join("\n"), dw), dx, py, dw, h);
      });
      py += h;
    }
    footer("Nama Crew Libur", p.leave, "#f0f1f0");
    footer("Nama Crew Stanby", p.standby, "#f0f1f0");
    if (p.unassigned.some((c) => c.length)) footer("Belum ada outlet", p.unassigned, "#fff1d6");
    const nh = Math.max(28, wrap(note || "—", PW - NO - OUTLET).length * LH + 10);
    rect(x, py, NO + OUTLET, nh, C.pale);
    label(["Catatan"], x, py, NO + OUTLET, nh, true);
    rect(x + NO + OUTLET, py, PW - NO - OUTLET, nh, "#ffffff");
    label(wrap(note || "—", PW - NO - OUTLET), x + NO + OUTLET, py, PW - NO - OUTLET, nh);
  }
  for (const week of weeks) {
    if (weeks.length > 1) {
      label(
        [`${dateToDisplay(week.from)} – ${dateToDisplay(week.to)}`],
        M,
        y,
        W - M * 2,
        24,
        true,
        13,
      );
      y += 28;
    }
    for (let i = 0; i < week.panels.length; i += 2) {
      panel(week.panels[i], M, y);
      if (week.panels[i + 1]) panel(week.panels[i + 1], M + PW + GAP, y);
      y +=
        Math.max(
          panelHeight(week.panels[i], noteFor(week.panels[i])),
          week.panels[i + 1] ? panelHeight(week.panels[i + 1], noteFor(week.panels[i + 1])) : 0,
        ) + GAP;
    }
  }
  if (!weeks.some((w) => w.panels.length)) {
    rect(M, y, W - M * 2, 60, "#ffffff");
    label(["Belum ada area/outlet untuk ditampilkan."], M, y, W - M * 2, 60);
    y += 76;
  }
  label(
    ["[R] Crew reguler     [B] Crew backup     ·     Jam dalam WIB"],
    M,
    y,
    W - M * 2,
    24,
    false,
    11,
  );
  y += 32;
  return {
    width: W,
    height: y,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" role="img"><title>Jadwal operasional ${escape(dateToDisplay(data.from))} – ${escape(dateToDisplay(data.to))}</title><rect width="100%" height="100%" fill="#ffffff"/>${parts.join("")}</svg>`,
  };
}
export async function schedulePng(image: ReturnType<typeof scheduleSvg>) {
  const scale = Math.min(
    2,
    Math.sqrt(40000000 / (image.width * image.height)),
    16000 / image.height,
    16000 / image.width,
  );
  if (scale < 0.5)
    throw Error("Gambar terlalu panjang. Pilih satu area atau periode lebih pendek.");
  const source = URL.createObjectURL(
    new Blob([image.svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const img = new Image();
    img.src = source;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(image.width * scale);
    canvas.height = Math.ceil(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Browser tidak mendukung ekspor gambar.");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error("Gambar belum dapat dibuat."))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function schedulePdf(image: ReturnType<typeof scheduleSvg>) {
  const png = await schedulePng(image),
    bytes = new Uint8Array(await png.arrayBuffer());
  const { jsPDF } = await import("jspdf");
  const factor = Math.min(1, 14000 / Math.max(image.width, image.height)),
    width = image.width * factor,
    height = image.height * factor;
  const pdf = new jsPDF({
    unit: "pt",
    format: [width, height],
    orientation: width > height ? "landscape" : "portrait",
    compress: true,
  });
  pdf.addImage(bytes, "PNG", 0, 0, width, height, undefined, "FAST");
  return pdf.output("blob");
}
