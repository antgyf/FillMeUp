import { extractJobFromListing } from "@/lib/services/tinyfish-service";
import { appendActivity, getJobById, updateJob } from "@/lib/store";

export async function processJobScraping(jobId: string) {
  const job = getJobById(jobId);

  if (!job) {
    throw new Error("Queued job not found.");
  }

  updateJob(jobId, (current) => ({
    ...current,
    status: "scraping",
    updatedAt: new Date().toISOString()
  }));

  appendActivity("scraping", `TinyFish started extracting the listing for ${job.title} at ${job.company}.`);

  const extraction = await extractJobFromListing(job);

  updateJob(jobId, (current) => ({
    ...current,
    title: extraction.result.title,
    company: extraction.result.company,
    location: extraction.result.location,
    employmentType: extraction.result.employmentType,
    jobDescription: extraction.result.jobDescription,
    applicationUrl: extraction.result.applicationUrl,
    keyRequirements: extraction.result.keyRequirements,
    status: "application_queued",
    tinyFishRunId: extraction.runId,
    updatedAt: new Date().toISOString()
  }));

  appendActivity("scraping", `TinyFish normalized ${job.title} and pushed it into the application queue.`);
  const { enqueueApplicationQueue } = await import("@/lib/queue-manager");
  enqueueApplicationQueue(jobId, `${job.title} @ ${job.company}`);
}
