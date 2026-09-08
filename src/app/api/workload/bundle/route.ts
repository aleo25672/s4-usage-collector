import { NextResponse } from "next/server";
import { getSapProvider, queryFromSearchParams } from "@/lib/sap";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = queryFromSearchParams(searchParams);
    const data = await getSapProvider().getBundle(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
