import { NextResponse } from "next/server";
import { getApplicationById, updateApplicationAnswers } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: { applicationId: string };
  }
) {
  const application = getApplicationById(params.applicationId);

  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: { applicationId: string };
  }
) {
  const body = (await request.json()) as {
    fields: Array<{
      fieldId: string;
      answer: string;
    }>;
  };

  const application = updateApplicationAnswers(params.applicationId, body.fields);

  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json(application);
}
