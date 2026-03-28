import { NextResponse } from "next/server";
import { discoverAndQueueJobs } from "@/lib/pipelines/job-discovery";
import { getSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const snapshot = getSnapshot();

  if (!snapshot.profile || !snapshot.preferences) {
    return NextResponse.json(
      { error: "Set up the profile and job preferences before running discovery." },
      { status: 400 }
    );
  }

  const result = await discoverAndQueueJobs(snapshot.profile, snapshot.preferences);
  return NextResponse.json(result);
}
