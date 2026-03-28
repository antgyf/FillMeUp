import { NextResponse } from "next/server";
import { ensureQueuesStarted } from "@/lib/queue-manager";
import { getSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureQueuesStarted();
  return NextResponse.json(getSnapshot());
}
