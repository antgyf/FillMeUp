import { NextResponse } from "next/server";
import { submitApprovedApplication } from "@/lib/pipelines/application-submission";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  {
    params
  }: {
    params: { applicationId: string };
  }
) {
  const body = (await request.json()) as {
    edits?: Array<{
      fieldId: string;
      answer: string;
    }>;
  };

  const application = await submitApprovedApplication(params.applicationId, body.edits ?? []);

  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json(application);
}
