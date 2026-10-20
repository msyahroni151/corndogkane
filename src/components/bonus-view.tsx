"use client";
import { useState, type ReactNode } from "react";
import "./bonus-view.css";
export function BonusView({
  initialView,
  balance,
  history,
}: {
  initialView: "saldo" | "history";
  balance: ReactNode;
  history: ReactNode;
}) {
  const [view, setView] = useState(initialView);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">
          {view === "saldo" ? "Saldo Bonus Karyawan" : "Riwayat Bonus"}
        </h2>
        <button
          type="button"
          className="button-secondary bonus-view-toggle"
          onClick={() => setView(view === "saldo" ? "history" : "saldo")}
        >
          {view === "saldo" ? "Riwayat" : "Saldo Bonus"}
        </button>
      </div>
      {view === "saldo" ? balance : history}
    </div>
  );
}
