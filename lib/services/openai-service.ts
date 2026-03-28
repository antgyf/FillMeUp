import OpenAI from "openai";
import { getResumeParserLogFile, logResumeParserEvent } from "@/lib/resume-parser-logger";
import type { ApplicationField, JobPreferences, JobRecord, ResumeParseDiagnostics, UserProfile } from "@/lib/types";

const model = process.env.OPENAI_MODEL ?? "gpt-5";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export async function parseResumeToProfile(input: {
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
}) {
  const startedAt = new Date().toISOString();
  const client = getClient();
  const logFile = getResumeParserLogFile();

  logResumeParserEvent("info", "parse-started", {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    model,
    hasResume: Boolean(input.resume),
    resumeFileName: input.resume?.fileName,
    resumeMimeType: input.resume?.mimeType,
    resumeBase64Length: input.resume?.base64.length ?? 0
  });

  if (!client) {
    logResumeParserEvent("warn", "parse-fallback-no-api-key", { model });
    return createMockProfile(input, {
      status: "mock_no_api_key",
      source: "mock",
      model,
      startedAt,
      finishedAt: new Date().toISOString(),
      logFile,
      notes: "OPENAI_API_KEY is missing or unreadable on the server."
    });
  }

  if (!input.resume) {
    logResumeParserEvent("warn", "parse-fallback-no-resume", { model });
    return createMockProfile(input, {
      status: "mock_no_resume",
      source: "mock",
      model,
      startedAt,
      finishedAt: new Date().toISOString(),
      logFile,
      notes: "No resume file was included in the profile payload."
    });
  }

  try {
    const { data: response, request_id: requestId } = await client.responses
      .create({
      model,
      reasoning: { effort: "low" },
      instructions:
        "Convert the candidate resume and notes into a concise JSON object with keys headline, summary, yearsExperience, topAchievements, preferredIndustries. Return JSON only.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                candidate: {
                  fullName: input.fullName,
                  email: input.email,
                  phone: input.phone,
                  location: input.location,
                  linkedinUrl: input.linkedinUrl,
                  websiteUrl: input.websiteUrl,
                  skills: input.skills,
                  notes: input.notes
                }
              })
            },
            {
              type: "input_file",
              filename: input.resume.fileName,
              file_data: toDataUrl(input.resume.mimeType, input.resume.base64)
            }
          ]
        }
      ]
      })
      .withResponse();

    const parsed = safeJsonParse<{
      headline: string;
      summary: string;
      yearsExperience: number;
      topAchievements: string[];
      preferredIndustries: string[];
    }>(response.output_text);

    if (!parsed) {
      logResumeParserEvent("warn", "parse-fallback-invalid-json", {
        model,
        requestId,
        outputPreview: response.output_text.slice(0, 500)
      });
      return createMockProfile(input, {
        status: "mock_invalid_json",
        source: "mock",
        model,
        startedAt,
        finishedAt: new Date().toISOString(),
        logFile,
        requestId: requestId ?? undefined,
        notes: "OpenAI responded, but the parser could not extract valid JSON from the response.",
        error: truncate(response.output_text, 500)
      });
    }

    const diagnostics: ResumeParseDiagnostics = {
      status: "live",
      source: "openai",
      model,
      startedAt,
      finishedAt: new Date().toISOString(),
      logFile,
      requestId: requestId ?? undefined,
      notes: "Resume parsed with a live OpenAI response."
    };

    logResumeParserEvent("info", "parse-succeeded", {
      model,
      requestId,
      headline: parsed.headline,
      yearsExperience: parsed.yearsExperience
    });

    return { ...input, parsedProfile: parsed, parserDiagnostics: diagnostics };
  } catch (error) {
    const serializedError = formatError(error);
    logResumeParserEvent("error", "parse-fallback-api-error", {
      model,
      error: serializedError
    });
    return createMockProfile(input, {
      status: "mock_api_error",
      source: "mock",
      model,
      startedAt,
      finishedAt: new Date().toISOString(),
      logFile,
      error: serializedError,
      notes: "The OpenAI request failed before valid parser output was returned."
    });
  }
}

export async function rankJobsForProfile(profile: UserProfile, preferences: JobPreferences, jobs: JobRecord[]) {
  const client = getClient();

  if (!client) {
    return jobs.map((job) => ({ jobId: job.id, score: heuristicScore(profile, preferences, job) }));
  }

  try {
    const response = await client.responses.create({
      model,
      reasoning: { effort: "low" },
      instructions:
        "Score each job from 0 to 100 for candidate relevance. Return JSON {scores:[{jobId,score}]} only.",
      input: JSON.stringify({ profile, preferences, jobs })
    });

    const parsed = safeJsonParse<{ scores: Array<{ jobId: string; score: number }> }>(response.output_text);
    return parsed?.scores?.length
      ? parsed.scores
      : jobs.map((job) => ({ jobId: job.id, score: heuristicScore(profile, preferences, job) }));
  } catch {
    return jobs.map((job) => ({ jobId: job.id, score: heuristicScore(profile, preferences, job) }));
  }
}

export async function buildFieldAnswers(input: {
  profile: UserProfile;
  job: JobRecord;
  fields: Array<Pick<ApplicationField, "fieldId" | "label" | "fieldType" | "placeholder" | "options" | "required" | "step">>;
}) {
  const client = getClient();

  if (!client) {
    return buildMockFieldAnswers(input);
  }

  try {
    const response = await client.responses.create({
      model,
      reasoning: { effort: "medium" },
      instructions:
        "Classify each form field and draft the best application answer. Return JSON {fields:[{fieldId,classification,answer,source,reasoning}]}.",
      input: JSON.stringify(input)
    });

    const parsed = safeJsonParse<{
      fields: Array<{
        fieldId: string;
        classification: ApplicationField["classification"];
        answer: string;
        source: ApplicationField["source"];
        reasoning: string;
      }>;
    }>(response.output_text);

    return parsed?.fields?.length ? parsed.fields : buildMockFieldAnswers(input);
  } catch {
    return buildMockFieldAnswers(input);
  }
}

function createMockProfile(input: {
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
}, parserDiagnostics: ResumeParseDiagnostics) {
  return {
    ...input,
    parsedProfile: {
      headline: `${input.skills[0] ?? "Cross-functional"} operator focused on scalable digital products`,
      summary:
        input.notes ??
        "Demo profile created in mock mode. Add OPENAI_API_KEY for live resume parsing and richer reasoning.",
      yearsExperience: Math.max(3, input.skills.length),
      topAchievements: [
        "Built reusable workflows across product and operations teams",
        "Improved execution speed with automation",
        "Shaped roadmap decisions using structured insights"
      ],
      preferredIndustries: ["SaaS", "AI Tooling", "Fintech"]
    },
    parserDiagnostics
  };
}

function heuristicScore(profile: UserProfile, preferences: JobPreferences, job: JobRecord) {
  const haystack = [job.title, job.company, job.location, job.jobDescription, ...job.keyRequirements]
    .join(" ")
    .toLowerCase();
  const keywords = [...profile.skills, ...preferences.roles, ...preferences.industries, ...preferences.keywords];
  const matches = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
  return Math.min(96, 45 + matches * 8);
}

function buildMockFieldAnswers(input: {
  profile: UserProfile;
  job: JobRecord;
  fields: Array<Pick<ApplicationField, "fieldId" | "label" | "fieldType" | "placeholder" | "options" | "required" | "step">>;
}) {
  return input.fields.map((field) => {
    const label = field.label.toLowerCase();

    if (label.includes("name")) {
      return { fieldId: field.fieldId, classification: "personal_info" as const, answer: input.profile.fullName, source: "profile" as const, reasoning: "Mapped from profile." };
    }

    if (label.includes("email")) {
      return { fieldId: field.fieldId, classification: "personal_info" as const, answer: input.profile.email, source: "profile" as const, reasoning: "Mapped from profile." };
    }

    if (label.includes("phone")) {
      return { fieldId: field.fieldId, classification: "personal_info" as const, answer: input.profile.phone, source: "profile" as const, reasoning: "Mapped from profile." };
    }

    if (label.includes("linkedin")) {
      return { fieldId: field.fieldId, classification: "structured_data" as const, answer: input.profile.linkedinUrl ?? "", source: "profile" as const, reasoning: "Mapped from profile." };
    }

    return {
      fieldId: field.fieldId,
      classification: "open_ended" as const,
      answer: `${input.profile.fullName} is excited about the ${input.job.title} opportunity at ${input.job.company}. Their background in ${input.profile.skills.slice(0, 3).join(", ")} aligns well with the role.`,
      source: "ai_generated" as const,
      reasoning: "Generated from profile skills and job context."
    };
  });
}

function safeJsonParse<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(value.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }

    return null;
  }
}

function toDataUrl(mimeType: string | undefined, base64: string) {
  const normalizedMimeType = mimeType?.trim() || "application/pdf";
  return `data:${normalizedMimeType};base64,${base64.replace(/\s+/g, "")}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return truncate(`${error.name}: ${error.message}`, 500);
  }

  return truncate(String(error), 500);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
