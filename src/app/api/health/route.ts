import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    application: "Corndog Kane HRIS & Payroll",
    integrations: { googleSheets: "not_connected" },
  });
}
