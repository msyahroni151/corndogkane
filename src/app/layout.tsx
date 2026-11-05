import { NotificationToasts } from "@/components/notification-toasts";
import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.HRIS_DEMO_MODE === "1" ? "DEMO | Corndog Kane" : "Corndog Kane | Back Office",
  description: "Website administrasi SDM, operasional outlet, dan keuangan Corndog Kane.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        {children}
        <NotificationToasts />
      </body>
    </html>
  );
}
