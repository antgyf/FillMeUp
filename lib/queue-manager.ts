import { processApplication } from "@/lib/pipelines/application-worker";
import { processJobScraping } from "@/lib/pipelines/job-scraping-worker";
import { appendActivity, createQueueRecord, getQueuedRecord, updateQueueRecord } from "@/lib/store";
import type { QueueRecord } from "@/lib/types";

let started = false;
let scrapingActive = false;
let applicationActive = false;

export function ensureQueuesStarted() {
  if (started) {
    return;
  }

  started = true;
  void drainQueue("job-scraping");
  void drainQueue("application");
}

export function enqueueJobScrapingQueue(entityId: string, label: string) {
  createQueueRecord("job-scraping", entityId, label);
  ensureQueuesStarted();
  void drainQueue("job-scraping");
}

export function enqueueApplicationQueue(entityId: string, label: string) {
  createQueueRecord("application", entityId, label);
  ensureQueuesStarted();
  void drainQueue("application");
}

async function drainQueue(queueName: QueueRecord["queueName"]) {
  if (queueName === "job-scraping" && scrapingActive) {
    return;
  }

  if (queueName === "application" && applicationActive) {
    return;
  }

  if (queueName === "job-scraping") {
    scrapingActive = true;
  } else {
    applicationActive = true;
  }

  try {
    while (true) {
      const record = getQueuedRecord(queueName);

      if (!record) {
        return;
      }

      updateQueueRecord(queueName, record.id, (current) => ({
        ...current,
        status: "running",
        attempts: current.attempts + 1,
        updatedAt: new Date().toISOString(),
        error: undefined
      }));

      try {
        if (queueName === "job-scraping") {
          await processJobScraping(record.entityId);
        } else {
          await processApplication(record.entityId);
        }

        updateQueueRecord(queueName, record.id, (current) => ({
          ...current,
          status: "completed",
          updatedAt: new Date().toISOString()
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown queue error.";
        updateQueueRecord(queueName, record.id, (current) => ({
          ...current,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: message
        }));
        appendActivity(queueName === "job-scraping" ? "scraping" : "application", `Queue job failed: ${message}`);
      }
    }
  } finally {
    if (queueName === "job-scraping") {
      scrapingActive = false;
    } else {
      applicationActive = false;
    }
  }
}
