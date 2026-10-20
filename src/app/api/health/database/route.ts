import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  await connection();
  // Pemeriksaan lokal; tidak membuka data HRIS atau kredensial kepada browser.
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  try {
    await getPrisma().$queryRaw`SELECT 1 AS connected`;
    return NextResponse.json(
      { status: "ok", database: "connected", provider: "postgresql" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
