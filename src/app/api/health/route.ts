import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    release: process.env.NEXT_PUBLIC_APP_RELEASE || "local",
    application: "Corndog Kane HRIS & Payroll",
    integrations: { googleSheets: "not_connected" },
  });
}
