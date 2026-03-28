import { submitReviewedApplication } from "@/lib/services/tinyfish-service";
import { appendActivity, getApplicationById, getJobById, updateApplication, updateApplicationAnswers, updateJob } from "@/lib/store";

export async function submitApprovedApplication(
  applicationId: string,
  edits: Array<{
    fieldId: string;
    answer: string;
  }>
) {
  const editedApplication = edits.length > 0 ? updateApplicationAnswers(applicationId, edits) : getApplicationById(applicationId);

  if (!editedApplication) {
    return null;
  }

  const job = getJobById(editedApplication.jobId);

  if (!job) {
    throw new Error("The associated job could not be found.");
  }

  updateApplication(applicationId, (application) => ({
    ...application,
    status: "submitting",
    updatedAt: new Date().toISOString()
  }));

  appendActivity("approval", `User approved ${editedApplication.jobTitle} at ${editedApplication.company} for final submission.`);

  const submission = await submitReviewedApplication(job, editedApplication.fields);
  const submittedApplication = updateApplication(applicationId, (application) => ({
    ...application,
    status: "submitted",
    updatedAt: new Date().toISOString(),
    tinyFishRuns: {
      ...application.tinyFishRuns,
      submit: submission.runId
    }
  }));

  updateJob(job.id, (current) => ({
    ...current,
    status: "submitted",
    updatedAt: new Date().toISOString()
  }));

  appendActivity("submission", `TinyFish executed the final submit action for ${editedApplication.jobTitle}.`);
  return submittedApplication;
}
