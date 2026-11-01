import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "UP",
      service: "shopi-frontend",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
