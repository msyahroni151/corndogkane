"use client";
import { useEffect, useState, type ReactNode } from "react";
import { APP_TIME_ZONE } from "@/lib/local-date";
export function AttendanceDateGate({
  date,
  today,
  children,
}: {
  date: string;
  today: string;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState(today);
  useEffect(() => {
    const update = () =>
      setCurrent(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: APP_TIME_ZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      );
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);
  return date > current ? <span className="text-xs text-slate-400">Belum waktunya</span> : children;
}
