"use client";
import { PinnedTableControls } from "@/components/pinned-table-controls";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  useId,
  type ReactNode,
  type ReactElement,
  type HTMLAttributes,
  type TableHTMLAttributes,
} from "react";

type Element = ReactElement<
  HTMLAttributes<HTMLElement> & {
    children?: ReactNode;
    colSpan?: number;
    "data-sort-value"?: string | number | null;
    "data-sortable"?: boolean;
  }
>;
function elements(children: ReactNode): Element[] {
  return Children.toArray(children).filter(isValidElement) as Element[];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!isValidElement(node)) return "";
  const element = node as Element;
  if (
    element.type === "details" ||
    element.props["aria-hidden"] ||
    element.props.className?.includes("sr-only")
  )
    return "";
  return text(element.props.children);
}
const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
function value(cell: Element | undefined): string | number {
  if (!cell) return "";
  const explicit = cell.props["data-sort-value"];
  if (explicit !== undefined) return explicit ?? "";
  const label = text(cell.props.children).replace(/\s+/g, " ").trim();
  if (!label || label === "—" || label === "-" || label === "Belum diatur") return "";
  const date = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/.exec(label);
  if (date) return Date.UTC(+date[3], +date[2] - 1, +date[1]);
  const time = /^(\d+):(\d{2})(?:\s|$)/.exec(label);
  if (time) return +time[1] * 60 + +time[2] + (label.includes("(+1 hari)") ? 1440 : 0);
  if (/^(?:Rp\s*)?-?\d+(?:\.\d{3})*(?:,\d+)?$/.test(label))
    return Number(label.replace(/Rp|\s|\./g, "").replace(",", "."));
  return label;
}

function isSpanningRow(row: Element): boolean {
  return elements(row.props.children).some((cell) => (cell.props.colSpan || 1) > 1);
}

/** Sort the full result before paginating; neither operation changes saved data. */
export function SortableTable({
  children,
  pinnedControls = false,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { pinnedControls?: boolean }) {
  const [sort, setSort] = useState<{ column: number; direction: "asc" | "desc" } | null>(null);
  const sizeId = useId();
  const [pageSize, setPageSize] = useState(5);
  const dataRows = elements(children)
    .filter((section) => section.type === "tbody")
    .flatMap((section) => elements(section.props.children))
    .filter((row) => !isSpanningRow(row));
  const signature = JSON.stringify(dataRows.map((row) => row.key));
  const [pagination, setPagination] = useState({ signature, page: 1 });
  const total = dataRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = pagination.signature === signature ? Math.min(pagination.page, pageCount) : 1;
  const start = (page - 1) * pageSize;
  const goToPage = (next: number) =>
    setPagination({ signature, page: Math.max(1, Math.min(next, pageCount)) });
  const pageNumbers = Array.from(
    new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount)),
  ).sort((a, b) => a - b);
  const sections = elements(children);
  const actionColumns = new Set<number>();
  for (const section of elements(children)) {
    if (section.type !== "thead") continue;
    for (const row of elements(section.props.children)) {
      elements(row.props.children).forEach((cell, index) => {
        if (/^aksi$/i.test(text(cell.props.children).trim())) actionColumns.add(index);
      });
    }
  }
  const table = (
    <table {...props}>
      {sections.map((section, sectionIndex) => {
        if (section.type === "thead")
          return cloneElement(
            section,
            {},
            elements(section.props.children).map((row) =>
              cloneElement(
                row,
                {},
                elements(row.props.children).map((cell, column) => {
                  const label = text(cell.props.children).trim();
                  if (
                    !label ||
                    /^(aksi|tindakan)$/i.test(label) ||
                    cell.props["data-sortable"] === false
                  )
                    return cell;
                  const selected = sort?.column === column;
                  const next = selected && sort.direction === "asc" ? "desc" : "asc";
                  return cloneElement(
                    cell,
                    {
                      scope: "col",
                      "aria-sort": selected
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none",
                    } as HTMLAttributes<HTMLElement>,
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-left font-inherit hover:text-emerald-700 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-emerald-600"
                      aria-label={`Urutkan ${label} ${next === "asc" ? "ascending" : "descending"}`}
                      title={
                        next === "asc"
                          ? "Ascending: A–Z / terkecil–terbesar"
                          : "Descending: Z–A / terbesar–terkecil"
                      }
                      onClick={() => {
                        setSort({ column, direction: next });
                        goToPage(1);
                      }}
                    >
                      {cell.props.children}
                      <span
                        aria-hidden="true"
                        className={selected ? "text-emerald-700" : "text-slate-400"}
                      >
                        {selected ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>,
                  );
                }),
              ),
            ),
          );
        if (section.type !== "tbody") return section;
        const rows = elements(section.props.children).map((row, index) => {
          const cells = elements(row.props.children).map((cell, column) =>
            actionColumns.has(column) && !cell.props.colSpan
              ? cloneElement(cell, { className: `${cell.props.className || ""} table-actions` })
              : cell,
          );
          return { row: cloneElement(row, {}, cells), index, cells };
        });
        const regular = rows.filter((r) => !r.cells.some((c) => (c.props.colSpan || 1) > 1));
        const spanning = rows.filter((r) => r.cells.some((c) => (c.props.colSpan || 1) > 1));
        const sorted = sort
          ? regular
              .map((r) => ({ ...r, value: value(r.cells[sort.column]) }))
              .sort((a, b) => {
                if (a.value === "" || b.value === "")
                  return a.value === b.value ? a.index - b.index : a.value === "" ? 1 : -1;
                const result =
                  typeof a.value === "number" && typeof b.value === "number"
                    ? a.value - b.value
                    : collator.compare(String(a.value), String(b.value));
                return (sort.direction === "asc" ? result : -result) || a.index - b.index;
              })
          : regular;
        const offset = sections
          .slice(0, sectionIndex)
          .reduce(
            (count, previous) =>
              count +
              (previous.type === "tbody"
                ? elements(previous.props.children).filter((row) => !isSpanningRow(row)).length
                : 0),
            0,
          );
        const visible = sorted.filter(
          (_, index) => index + offset >= start && index + offset < start + pageSize,
        );
        return cloneElement(
          section,
          {},
          [...visible, ...spanning].map((r) => r.row),
        );
      })}
    </table>
  );
  const controls = (
    <div className="table-pagination">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label htmlFor={sizeId} className="flex items-center gap-2">
          Baris per halaman
          <select
            id={sizeId}
            aria-label="Baris per halaman"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              goToPage(1);
            }}
          >
            {[5, 10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span role="status" aria-live="polite" aria-atomic="true">
          {total
            ? `${start + 1}–${Math.min(start + pageSize, total)} dari ${total} data`
            : "0 data"}
        </span>
      </div>
      <nav aria-label="Halaman tabel" className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Halaman sebelumnya"
          disabled={page === 1}
          onClick={() => goToPage(page - 1)}
        >
          ‹
        </button>
        {pageNumbers.map((number, index) => (
          <span key={number} className="inline-flex items-center gap-1">
            {index > 0 && number - pageNumbers[index - 1] > 1 && (
              <span className="px-1" aria-hidden="true">
                …
              </span>
            )}
            <button
              type="button"
              aria-label={`Halaman ${number}`}
              aria-current={page === number ? "page" : undefined}
              onClick={() => goToPage(number)}
            >
              {number}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Halaman berikutnya"
          disabled={page === pageCount}
          onClick={() => goToPage(page + 1)}
        >
          ›
        </button>
      </nav>
    </div>
  );
  return pinnedControls ? (
    <PinnedTableControls controls={controls}>{table}</PinnedTableControls>
  ) : (
    <>
      {table}
      {controls}
    </>
  );
}
