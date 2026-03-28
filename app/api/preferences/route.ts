import { NextResponse } from "next/server";
import { getSnapshot, upsertPreferences } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSnapshot().preferences);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    roles: string[];
    companies?: string[];
    industries: string[];
    locations: string[];
    salaryRange: {
      min: number;
      max: number;
      currency: string;
    };
    keywords: string[];
  };

  const preferences = upsertPreferences({
    ...body,
    companies: body.companies ?? []
  });
  return NextResponse.json(preferences);
}
