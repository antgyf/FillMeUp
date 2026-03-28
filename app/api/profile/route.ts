import { NextResponse } from "next/server";
import { parseResumeToProfile } from "@/lib/services/openai-service";
import { upsertProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(upsertProfile());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl?: string;
    websiteUrl?: string;
    skills: string[];
    notes?: string;
    resume?: {
      fileName: string;
      mimeType: string;
      base64: string;
    };
  };

  const parsed = await parseResumeToProfile(body);
  const profile = upsertProfile(parsed);
  return NextResponse.json(profile);
}
