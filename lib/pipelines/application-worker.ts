import crypto from "node:crypto";
import { buildFieldAnswers } from "@/lib/services/openai-service";
import { extractApplicationFields, fillApplicationUntilReview } from "@/lib/services/tinyfish-service";
import { appendActivity, getApplicationByJobId, getJobById, getSnapshot, insertApplication, updateJob } from "@/lib/store";
import type { ApplicationField, ApplicationRecord } from "@/lib/types";

export async function processApplication(jobId: string) {
  const snapshot = getSnapshot();
  const profile = snapshot.profile;
  const job = getJobById(jobId);

  if (!profile) {
    throw new Error("Candidate profile is required before application processing.");
  }

  if (!job) {
    throw new Error("Job not found for application processing.");
  }

  const existingApplication = getApplicationByJobId(jobId);
  const applicationId = existingApplication?.id ?? crypto.randomUUID();
  let applicationRecord: ApplicationRecord = existingApplication ?? {
    id: applicationId,
    jobId,
    jobTitle: job.title,
    company: job.company,
    applicationUrl: job.applicationUrl,
    jobDescription: job.jobDescription,
    status: "queued",
    fields: [],
    reviewSummary: {
      confirmationTitle: "Awaiting review snapshot",
      previewLines: [],
      finalActionLabel: "Review before submit"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tinyFishRuns: {}
  };

  try {
    applicationRecord = insertApplication({
      ...applicationRecord,
      status: "analyzing",
      lastError: undefined,
      updatedAt: new Date().toISOString()
    });

    appendActivity("application", `Application agent started reasoning over ${job.title} at ${job.company}.`);

    const extraction = await extractApplicationFields(job);
    const rawFields = extraction.result.fields as ApplicationField[];
    const answers = await buildFieldAnswers({
      profile,
      job,
      fields: rawFields.map((field) => ({
        fieldId: field.fieldId,
        label: field.label,
        fieldType: field.fieldType,
        placeholder: field.placeholder,
        options: field.options,
        required: field.required,
        step: field.step
      }))
    });

    const resolvedFields = rawFields.map<ApplicationField>((field) => {
      const answer = answers.find((item) => item.fieldId === field.fieldId);
      return {
        ...field,
        classification: answer?.classification ?? field.classification,
        answer: answer?.answer ?? field.answer,
        source: answer?.source ?? field.source,
        reasoning: answer?.reasoning ?? field.reasoning
      };
    });

    applicationRecord = insertApplication({
      ...applicationRecord,
      fields: resolvedFields,
      status: "filling",
      lastError: undefined,
      updatedAt: new Date().toISOString(),
      tinyFishRuns: {
        ...applicationRecord.tinyFishRuns,
        extract: extraction.runId
      }
    });

    const fillRun = await fillApplicationUntilReview(job, resolvedFields, profile.fullName);

    applicationRecord = insertApplication({
      ...applicationRecord,
      fields: resolvedFields,
      status: "awaiting_approval",
      lastError: undefined,
      updatedAt: new Date().toISOString(),
      reviewSummary: fillRun.result,
      tinyFishRuns: {
        ...applicationRecord.tinyFishRuns,
        fill: fillRun.runId
      }
    });

    updateJob(jobId, (current) => ({
      ...current,
      status: "awaiting_approval",
      updatedAt: new Date().toISOString()
    }));

    appendActivity("application", `Application draft prepared for ${job.title}. Waiting for human approval.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown application processing error.";

    insertApplication({
      ...applicationRecord,
      status: "failed",
      lastError: message,
      updatedAt: new Date().toISOString()
    });

    updateJob(jobId, (current) => ({
      ...current,
      status: "failed",
      updatedAt: new Date().toISOString()
    }));

    throw error;
  }
}
