import crypto from "node:crypto";
import { appendDebugLog } from "@/lib/debug-log";
import { enqueueJobScrapingQueue, ensureQueuesStarted } from "@/lib/queue-manager";
import { rankJobsForProfile } from "@/lib/services/openai-service";
import { scrapeLinkedInJobs } from "@/lib/services/tinyfish-service";
import { appendActivity, getSnapshot, insertJobs, upsertLinkedInSession } from "@/lib/store";
import type { JobPreferences, JobRecord, LinkedInSession, UserProfile } from "@/lib/types";

export async function discoverAndQueueJobs(profile: UserProfile, preferences: JobPreferences, linkedinSession: LinkedInSession | null) {
  ensureQueuesStarted();
  appendDebugLog("linkedin-debug.log", "linkedin.discovery_started", {
    profileId: profile.id,
    linkedinSessionStatus: linkedinSession?.status ?? null,
    tinyFishRunId: linkedinSession?.tinyFishRunId ?? null
  });

  if (!linkedinSession || linkedinSession.status !== "connected") {
    appendDebugLog("linkedin-debug.log", "linkedin.discovery_blocked", {
      reason: "missing_or_unconnected_session"
    });
    throw new Error("Log in to LinkedIn before running discovery.");
  }

  const scraped = await scrapeLinkedInJobs(linkedinSession, preferences);

  const seededJobs = scraped.result.jobs.map<JobRecord>((seed) => ({
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

  upsertLinkedInSession({
    ...linkedinSession,
    lastSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tinyFishRunId: scraped.runId
  });

  appendActivity("discovery", `Scraped ${rankedJobs.length} jobs from the user's LinkedIn session and queued them for enrichment.`);
  appendDebugLog("linkedin-debug.log", "linkedin.discovery_completed", {
    queued: rankedJobs.length,
    topJobTitles: rankedJobs.slice(0, 5).map((job) => job.title)
  });

  return {
    queued: rankedJobs.length,
    topJobs: rankedJobs.slice(0, 5),
    queueSnapshot: getSnapshot().queue
  };
}
