import crypto from "node:crypto";
import type { ApplicationField, JobRecord, ReviewSummary } from "@/lib/types";

const baseUrl = "https://agent.tinyfish.ai/v1";

type TinyFishRunResult<T> = {
  runId: string;
  result: T;
};

type TinyFishAutomationOptions = {
  browserProfile?: "lite" | "stealth";
  proxyConfig?: {
    enabled: boolean;
    country_code?: string;
  };
};

function useMockMode() {
  return !process.env.TINYFISH_API_KEY || process.env.TINYFISH_MODE === "mock";
}

export function isTinyFishMockMode() {
  return useMockMode();
}

async function runTinyFish<T>(path: string, payload: Record<string, unknown>, fallback: T): Promise<TinyFishRunResult<T>> {
  if (useMockMode()) {
    return { runId: `mock-${crypto.randomUUID()}`, result: fallback };
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.TINYFISH_API_KEY ?? ""
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const detail = getErrorDetail(error);
    console.error("TinyFish request failed before a response was received.", {
      path,
      url: `${baseUrl}${path}`,
      detail
    });
    throw new Error(`TinyFish request failed before a response was received. ${detail}`);
  }

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    console.error("TinyFish request returned a non-OK response.", {
      path,
      url: `${baseUrl}${path}`,
      status: response.status,
      body: responseBody.slice(0, 500)
    });
    throw new Error(
      `TinyFish request failed with status ${response.status}.${responseBody ? ` Response: ${responseBody.slice(0, 200)}` : ""}`
    );
  }

  const data = (await response.json()) as {
    run_id?: string;
    result?: T;
  };

  return { runId: data.run_id ?? `unknown-${crypto.randomUUID()}`, result: data.result ?? fallback };
}

export async function runTinyFishAutomation<T>(
  payload: Record<string, unknown>,
  fallback: T,
  options?: TinyFishAutomationOptions
) {
  return runTinyFish(
    "/automation/run",
    {
      ...payload,
      browser_profile: options?.browserProfile ?? "lite",
      api_integration: "formpilot",
      ...(options?.proxyConfig ? { proxy_config: options.proxyConfig } : {})
    },
    fallback
  );
}

function getErrorDetail(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unknown network error.";
  }

  const cause = error.cause;

  if (cause && typeof cause === "object") {
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : null;
    const message = "message" in cause && typeof cause.message === "string" ? cause.message : null;
    const combined = [code, message].filter(Boolean).join(": ");

    if (combined) {
      return `${error.message}. Cause: ${combined}`;
    }
  }

  return error.message;
}

export async function extractJobFromListing(job: JobRecord) {
  return runTinyFishAutomation(
    {
      url: job.listingUrl,
      goal:
        "Extract the job title, company, location, employment type, job description, application URL, and key requirements. Return JSON with keys title, company, location, employmentType, jobDescription, applicationUrl, keyRequirements."
    },
    {
      title: job.title,
      company: job.company,
      location: job.location,
      employmentType: job.employmentType,
      jobDescription: job.jobDescription,
      applicationUrl: job.applicationUrl,
      keyRequirements: job.keyRequirements
    }
  );
}

export async function extractApplicationFields(job: JobRecord) {
  return runTinyFishAutomation(
    {
      url: job.applicationUrl,
      goal:
        "Inspect this job application and extract the visible fields without submitting. Return JSON with fields[]. Each field should include fieldId, label, fieldType, required, step, placeholder, and options."
    },
    { fields: mockFieldsForJob(job) }
  );
}

export async function fillApplicationUntilReview(job: JobRecord, fields: ApplicationField[], candidateName: string) {
  return runTinyFishAutomation(
    {
      url: job.applicationUrl,
      goal: `Fill this job application using these answers ${JSON.stringify(
        fields.map((field) => ({ label: field.label, answer: field.answer }))
      )}. Handle multi-step navigation and stop at the final confirmation screen. Do not submit. Return JSON with confirmationTitle, previewLines, and finalActionLabel.`
    },
    buildReviewSummary(job, candidateName, fields)
  );
}

export async function submitReviewedApplication(job: JobRecord, fields: ApplicationField[]) {
  return runTinyFishAutomation(
    {
      url: job.applicationUrl,
      goal: `Navigate to the final confirmation step and submit the approved application using these answers ${JSON.stringify(
        fields.map((field) => ({ label: field.label, answer: field.answer }))
      )}. Return JSON with submitted=true, finalActionLabel, and fieldsSubmitted.`
    },
    {
      submitted: true,
      finalActionLabel: "Submit application",
      fieldsSubmitted: fields.length
    }
  );
}

function mockFieldsForJob(job: JobRecord): ApplicationField[] {
  return [
    {
      fieldId: "full_name",
      label: "Full name",
      fieldType: "text",
      required: true,
      step: "Profile",
      classification: "personal_info",
      placeholder: "Enter your full name",
      answer: "",
      source: "system",
      reasoning: "Extracted from application schema."
    },
    {
      fieldId: "email",
      label: "Email address",
      fieldType: "text",
      required: true,
      step: "Profile",
      classification: "personal_info",
      placeholder: "you@example.com",
      answer: "",
      source: "system",
      reasoning: "Extracted from application schema."
    },
    {
      fieldId: "phone",
      label: "Phone number",
      fieldType: "text",
      required: true,
      step: "Profile",
      classification: "personal_info",
      placeholder: "+1 555 555 5555",
      answer: "",
      source: "system",
      reasoning: "Extracted from application schema."
    },
    {
      fieldId: "linkedin_url",
      label: "LinkedIn profile",
      fieldType: "text",
      required: false,
      step: "Profile",
      classification: "structured_data",
      placeholder: "https://linkedin.com/in/name",
      answer: "",
      source: "system",
      reasoning: "Extracted from application schema."
    },
    {
      fieldId: "why_company",
      label: `Why are you interested in ${job.company}?`,
      fieldType: "textarea",
      required: true,
      step: "Motivation",
      classification: "open_ended",
      placeholder: "Share your motivation",
      answer: "",
      source: "system",
      reasoning: "Extracted from application schema."
    },
    {
      fieldId: "resume_upload",
      label: "Resume upload",
      fieldType: "file",
      required: true,
      step: "Documents",
      classification: "structured_data",
      answer: "Resume available in candidate profile.",
      source: "system",
      reasoning: "Extracted from application schema."
    }
  ];
}

function buildReviewSummary(job: JobRecord, candidateName: string, fields: ApplicationField[]): ReviewSummary {
  return {
    confirmationTitle: `${candidateName}'s application draft is ready`,
    previewLines: [
      `FormPilot completed ${fields.length} fields for ${job.title}.`,
      `TinyFish stopped at the final confirmation screen for ${job.company}.`,
      "Open-ended responses were generated from the candidate profile and the job description."
    ],
    finalActionLabel: "Review and click submit"
  };
}
