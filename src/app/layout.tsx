import { NotificationToasts } from "@/components/notification-toasts";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    process.env.HRIS_DEMO_MODE === "1" ? "DEMO | Corndog Kane" : "Corndog Kane | Back Office",
  description: "Website administrasi SDM, operasional outlet, dan keuangan Corndog Kane.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        {children}
        <NotificationToasts />
      </body>
    </html>
  );
}
