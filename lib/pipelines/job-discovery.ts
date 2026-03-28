import crypto from "node:crypto";
import { enqueueJobScrapingQueue, ensureQueuesStarted } from "@/lib/queue-manager";
import { discoverLinkedInJobs } from "@/lib/services/linkedin-discovery-service";
import { rankJobsForProfile } from "@/lib/services/openai-service";
import { appendActivity, getSnapshot, insertJobs } from "@/lib/store";
import type { JobPreferences, JobRecord, UserProfile } from "@/lib/types";

export async function discoverAndQueueJobs(profile: UserProfile, preferences: JobPreferences) {
  ensureQueuesStarted();

  const discovery = await discoverLinkedInJobs(preferences);

  const seededJobs = discovery.jobs.map<JobRecord>((seed) => ({
    id: crypto.randomUUID(),
    source: "linkedin",
    title: seed.title,
    company: seed.company,
    location: seed.location,
    listingUrl: seed.listingUrl,
    applicationUrl: seed.applicationUrl,
    jobDescription: seed.jobDescription,
    employmentType: seed.employmentType,
    relevanceScore: 0,
    status: "discovered",
    discoveredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    keyRequirements: seed.keyRequirements
  }));

  const rankings = await rankJobsForProfile(profile, preferences, seededJobs);
  const rankedJobs = seededJobs
    .map((job) => ({
      ...job,
      relevanceScore: rankings.find((rankedJob) => rankedJob.jobId === job.id)?.score ?? 0
    }))
    .filter((job) => job.relevanceScore >= 58)
    .sort((left, right) => right.relevanceScore - left.relevanceScore);

  insertJobs(rankedJobs);

  for (const job of rankedJobs) {
    enqueueJobScrapingQueue(job.id, `${job.title} @ ${job.company}`);
  }

  appendActivity(
    "discovery",
    `Discovered ${rankedJobs.length} LinkedIn roles via ${discovery.mode === "live" ? "live TinyFish search" : "fallback seed catalog"} and queued them for scraping.`
  );
  for (const note of discovery.notes) {
    appendActivity("discovery", note);
  }

  return {
    queued: rankedJobs.length,
    mode: discovery.mode,
    notes: discovery.notes,
    topJobs: rankedJobs.slice(0, 5),
    queueSnapshot: getSnapshot().queue
  };
}
