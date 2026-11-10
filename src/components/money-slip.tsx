import Image from "next/image";
import Link from "next/link";
import { MoneySlipPrint } from "@/components/money-slip-print";
import { APP_TIME_ZONE } from "@/lib/local-date";
import { rupiah } from "@/lib/money";
import "./money-slip.css";

export const slipDate = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

export type SlipRow = [label: string, value: string, tone?: "paid" | "highlight" | "pending"];

function SlipDetails({ rows }: { rows: SlipRow[] }) {
  return (
    <dl className="money-slip-details">
      {rows.map(([label, value, tone]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={tone ? `money-slip-${tone}` : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MoneySlip({
  title,
  date,
  backHref,
  backLabel,
  identity,
  amountLabel,
  amount,
  notesLabel,
  notes,
  summary,
  preparedBy,
  receivedBy,
}: {
  title: string;
  date: string;
  backHref: string;
  backLabel: string;
  identity: SlipRow[];
  amountLabel: string;
  amount: number;
  notesLabel: string;
  notes: string;
  summary: SlipRow[];
  preparedBy: string;
  receivedBy: string;
}) {
  return (
    <main className="money-slip">
      <div className="money-slip-toolbar">
        <Link href={backHref} className="button-secondary">
          {backLabel}
        </Link>
        <MoneySlipPrint />
      </div>
      <article className="money-slip-paper">
        <header className="money-slip-header">
          <Image src="/corndog-kane-logo.png" alt="Corndog Kane" width={68} height={68} unoptimized />
          <div>
            <p>CORNDOG KANE</p>
            <h1>{title}</h1>
          </div>
        </header>
        <p className="money-slip-date">{date}</p>
        <SlipDetails rows={identity} />
        <div className="money-slip-amount">
          <span>{amountLabel}</span>
          <strong>{rupiah(amount)}</strong>
        </div>
        <section className="money-slip-notes">
          <h2>{notesLabel}</h2>
          <p>{notes || "—"}</p>
        </section>
        <SlipDetails rows={summary} />
        <footer className="money-slip-signatures">
          <div>
            <p>Dibuat oleh</p>
            <strong>{preparedBy}</strong>
          </div>
          <div>
            <p>Diterima oleh</p>
            <strong>{receivedBy}</strong>
          </div>
        </footer>
      </article>
    </main>
  );
}
