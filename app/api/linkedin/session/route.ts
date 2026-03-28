import { NextResponse } from "next/server";
import { appendDebugLog } from "@/lib/debug-log";
import { beginLinkedInConnection, disconnectLinkedInAccount, refreshLinkedInConnection } from "@/lib/pipelines/linkedin-auth";
import { getSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const snapshot = getSnapshot();
  appendDebugLog("linkedin-debug.log", "linkedin.session_route_post_started", {
    profilePresent: Boolean(snapshot.profile)
  });

  const body = (await request.json().catch(() => ({}))) as { action?: "begin" | "status" };

  appendDebugLog("linkedin-debug.log", "linkedin.session_route_post_body", {
    action: body.action ?? "begin"
  });

  const session = body.action === "status" ? await refreshLinkedInConnection() : await beginLinkedInConnection();
  return NextResponse.json(session);
}

export async function DELETE() {
  appendDebugLog("linkedin-debug.log", "linkedin.session_route_delete");
  disconnectLinkedInAccount();
  return NextResponse.json({ ok: true });
}
