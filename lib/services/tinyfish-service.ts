import crypto from "node:crypto";
import { mockLinkedInCatalog } from "@/lib/discovery-catalog";
import { appendDebugLog } from "@/lib/debug-log";
import type { ApplicationField, JobRecord, ReviewSummary } from "@/lib/types";
import type { JobPreferences, LinkedInSession, UserProfile } from "@/lib/types";

const baseUrl = "https://agent.tinyfish.ai/v1";

type TinyFishRunResult<T> = {
  runId: string;
  result: T;
};

type TinyFishAsyncRunResult = {
  runId: string;
  interactiveUrl?: string;
};

function sanitizePayloadForLogs(payload: Record<string, unknown>) {
  const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

  if (typeof clone.goal === "string") {
    clone.goal = clone.goal
      .replace(/username '.*?'/gi, "username '[REDACTED]'")
      .replace(/password '.*?'/gi, "password '[REDACTED]'");
  }

  return clone;
}

function useMockMode() {
  return !process.env.TINYFISH_API_KEY || process.env.TINYFISH_MODE === "mock";
}

function requireLiveTinyFish(action: string) {
  if (useMockMode()) {
    appendDebugLog("tinyfish-debug.log", "tinyfish.live_required_failed", {
      action,
      reason: "missing_api_key_or_mock_mode"
    });
    throw new Error(`TinyFish is not configured for ${action}. Add TINYFISH_API_KEY in .env.local and restart the app.`);
  }
}

async function runTinyFish<T>(path: string, payload: Record<string, unknown>, fallback: T): Promise<TinyFishRunResult<T>> {
  if (useMockMode()) {
    appendDebugLog("tinyfish-debug.log", "tinyfish.mock_fallback", {
      path,
      payload: sanitizePayloadForLogs(payload)
    });
    return { runId: `mock-${crypto.randomUUID()}`, result: fallback };
  }

  appendDebugLog("tinyfish-debug.log", "tinyfish.request_started", {
    path,
    payload: sanitizePayloadForLogs(payload)
  });

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TINYFISH_API_KEY ?? ""
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    appendDebugLog("tinyfish-debug.log", "tinyfish.request_failed", {
      path,
      status: response.status
    });
    throw new Error(`TinyFish request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    run_id?: string;
    result?: T;
  };

  const runId = data.run_id ?? `unknown-${crypto.randomUUID()}`;
  appendDebugLog("tinyfish-debug.log", "tinyfish.request_completed", {
    path,
    runId,
    resultPreview: data.result ?? fallback
  });
  return { runId, result: data.result ?? fallback };
}

async function runTinyFishAsync(path: string, payload: Record<string, unknown>): Promise<TinyFishAsyncRunResult> {
  requireLiveTinyFish("interactive TinyFish login");

  appendDebugLog("tinyfish-debug.log", "tinyfish.async_request_started", {
    path,
    payload: sanitizePayloadForLogs(payload)
  });

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TINYFISH_API_KEY ?? ""
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    appendDebugLog("tinyfish-debug.log", "tinyfish.async_request_failed", {
      path,
      status: response.status
    });
    throw new Error(`TinyFish async request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    run_id?: string;
    session_url?: string;
    live_url?: string;
    browser_url?: string;
    result?: {
      session_url?: string;
      live_url?: string;
      browser_url?: string;
    };
  };

  const runId = data.run_id;
  if (!runId) {
    throw new Error("TinyFish did not return a run_id for the LinkedIn login flow.");
  }

  const interactiveUrl =
    data.session_url ??
    data.live_url ??
    data.browser_url ??
    data.result?.session_url ??
    data.result?.live_url ??
    data.result?.browser_url;

  appendDebugLog("tinyfish-debug.log", "tinyfish.async_request_completed", {
    path,
    runId,
    interactiveUrl: interactiveUrl ?? null
  });

  return { runId, interactiveUrl };
}

export async function getTinyFishRun(runId: string) {
  requireLiveTinyFish("TinyFish run polling");

  appendDebugLog("tinyfish-debug.log", "tinyfish.get_run_started", { runId });

  const response = await fetch(`${baseUrl}/runs/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TINYFISH_API_KEY ?? ""
    },
    body: JSON.stringify({ run_ids: [runId] })
  });

  if (!response.ok) {
    appendDebugLog("tinyfish-debug.log", "tinyfish.get_run_failed", {
      runId,
      status: response.status
    });
    throw new Error(`TinyFish run polling failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    data?: Array<{
      run_id?: string;
      status?: string;
      result?: Record<string, unknown>;
      error?: { message?: string } | string | null;
      live_url?: string;
      session_url?: string;
      browser_url?: string;
    }>;
  };

  const run = data.data?.[0];
  appendDebugLog("tinyfish-debug.log", "tinyfish.get_run_completed", {
    runId,
    status: run?.status ?? null,
    result: run?.result ?? null
  });

  return {
    runId,
    status: run?.status ?? "UNKNOWN",
    result: run?.result ?? {},
    error: typeof run?.error === "string" ? run.error : run?.error?.message ?? null,
    interactiveUrl: run?.session_url ?? run?.live_url ?? run?.browser_url ?? null
  };
}

export async function extractJobFromListing(job: JobRecord) {
  appendDebugLog("tinyfish-debug.log", "tinyfish.extract_job_from_listing", {
    jobId: job.id,
    listingUrl: job.listingUrl
  });
  return runTinyFish(
    "/automation/run",
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

export async function startLinkedInLogin(profile?: UserProfile) {
  requireLiveTinyFish("LinkedIn login");
  appendDebugLog("linkedin-debug.log", "linkedin.login_started", {
    profileId: profile?.id,
    profileName: profile?.fullName
  });

  const linkedInEmail = process.env.LINKEDIN_EMAIL;
  const linkedInPassword = process.env.LINKEDIN_PASSWORD;

  if (!linkedInEmail || !linkedInPassword) {
    throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env.local before testing credential-based LinkedIn login.");
  }

  return runTinyFishAsync(
    "/automation/run-async",
    {
      url: "https://www.linkedin.com/login",
      browser_profile: "stealth",
      goal:
        `1. Login with username '${linkedInEmail}' and password '${linkedInPassword}'. 2. Navigate to the LinkedIn Jobs page after login. 3. Return JSON with sessionOwner and jobsUrl.`
    }
  );
}

export async function scrapeLinkedInJobs(session: LinkedInSession, preferences: JobPreferences) {
  const fallbackJobs = buildMockDiscoveryResults(preferences);

  if (session.tinyFishRunId?.startsWith("mock-")) {
    appendDebugLog("linkedin-debug.log", "linkedin.scrape_blocked_mock_session", {
      tinyFishRunId: session.tinyFishRunId
    });
    throw new Error("LinkedIn scraping requires a live TinyFish session. Configure TINYFISH_API_KEY and reconnect LinkedIn.");
  }

  appendDebugLog("linkedin-debug.log", "linkedin.scrape_started", {
    jobsUrl: session.jobsUrl,
    tinyFishRunId: session.tinyFishRunId,
    preferences
  });

  return runTinyFish(
    "/automation/run",
    {
      url: session.jobsUrl,
      linkedInSessionRunId: session.tinyFishRunId,
      goal: `Using the authenticated LinkedIn session, scrape jobs visible to this user that match these preferences ${JSON.stringify(
        preferences
      )}. Return JSON with jobs:[{title,company,location,listingUrl,applicationUrl,employmentType,industries,keywords,jobDescription,keyRequirements}].`
    },
    { jobs: fallbackJobs }
  );
}

export async function extractApplicationFields(job: JobRecord) {
  appendDebugLog("tinyfish-debug.log", "tinyfish.extract_application_fields", {
    jobId: job.id,
    applicationUrl: job.applicationUrl
  });
  return runTinyFish(
    "/automation/run",
    {
      url: job.applicationUrl,
      goal:
        "Inspect this job application and extract the visible fields without submitting. Return JSON with fields[]. Each field should include fieldId, label, fieldType, required, step, placeholder, and options."
    },
    { fields: mockFieldsForJob(job) }
  );
}

export async function fillApplicationUntilReview(job: JobRecord, fields: ApplicationField[], candidateName: string) {
  appendDebugLog("tinyfish-debug.log", "tinyfish.fill_application_until_review", {
    jobId: job.id,
    applicationUrl: job.applicationUrl,
    fieldCount: fields.length,
    candidateName
  });
  return runTinyFish(
    "/automation/run",
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
  appendDebugLog("tinyfish-debug.log", "tinyfish.submit_reviewed_application", {
    jobId: job.id,
    applicationUrl: job.applicationUrl,
    fieldCount: fields.length
  });
  return runTinyFish(
    "/automation/run",
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

function buildMockDiscoveryResults(preferences: JobPreferences) {
  const preferenceTerms = [
    ...preferences.roles,
    ...preferences.industries,
    ...preferences.locations,
    ...preferences.keywords
  ]
    .map((term) => term.toLowerCase())
    .filter(Boolean);

  const ranked = mockLinkedInCatalog
    .map((job) => {
      const haystack = [
        job.title,
        job.company,
        job.location,
        job.jobDescription,
        ...job.keyRequirements,
        ...job.industries,
        ...job.keywords
      ]
        .join(" ")
        .toLowerCase();

      const score = preferenceTerms.filter((term) => haystack.includes(term)).length;
      return { job, score };
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.job);

  return ranked.slice(0, 8);
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
