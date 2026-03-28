import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ActivityEvent,
  ApplicationRecord,
  FormPilotState,
  JobPreferences,
  JobRecord,
  QueueRecord,
  UserProfile
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "formpilot-db.json");

function createDefaultState(): FormPilotState {
  return {
    profile: null,
    preferences: null,
    jobs: [],
    applications: [],
    queue: {
      jobScraping: [],
      application: []
    },
    activity: []
  };
}

function ensureDbFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(createDefaultState(), null, 2), "utf8");
  }
}

function readState() {
  ensureDbFile();
  return JSON.parse(fs.readFileSync(dbFile, "utf8")) as FormPilotState;
}

function writeState(nextState: FormPilotState) {
  ensureDbFile();
  fs.writeFileSync(dbFile, JSON.stringify(nextState, null, 2), "utf8");
}

function createActivity(stage: ActivityEvent["stage"], message: string): ActivityEvent {
  return {
    id: crypto.randomUUID(),
    stage,
    message,
    createdAt: new Date().toISOString()
  };
}

export function getSnapshot() {
  return readState();
}

export function upsertProfile(
  partial?: Omit<UserProfile, "id" | "createdAt" | "updatedAt"> &
    Partial<Pick<UserProfile, "id" | "createdAt" | "updatedAt">>
) {
  const state = readState();

  if (!partial) {
    return state.profile;
  }

  const now = new Date().toISOString();
  const nextProfile: UserProfile = {
    id: state.profile?.id ?? crypto.randomUUID(),
    createdAt: state.profile?.createdAt ?? now,
    updatedAt: now,
    ...partial
  };

  state.profile = nextProfile;
  state.activity.push(createActivity("profile", "Candidate profile saved and structured resume context updated."));
  writeState(state);
  return nextProfile;
}

export function upsertPreferences(partial: Omit<JobPreferences, "updatedAt">) {
  const state = readState();
  const preferences: JobPreferences = {
    ...partial,
    updatedAt: new Date().toISOString()
  };

  state.preferences = preferences;
  state.activity.push(createActivity("discovery", "Job preferences updated for the discovery pipeline."));
  writeState(state);
  return preferences;
}

export function insertJobs(jobs: JobRecord[]) {
  const state = readState();

  for (const job of jobs) {
    const existingIndex = state.jobs.findIndex((item) => item.listingUrl === job.listingUrl);

    if (existingIndex >= 0) {
      state.jobs[existingIndex] = job;
    } else {
      state.jobs.push(job);
    }
  }

  writeState(state);
  return jobs;
}

export function getJobById(jobId: string) {
  return readState().jobs.find((job) => job.id === jobId) ?? null;
}

export function updateJob(jobId: string, updater: (job: JobRecord) => JobRecord) {
  const state = readState();
  const index = state.jobs.findIndex((job) => job.id === jobId);

  if (index < 0) {
    return null;
  }

  state.jobs[index] = updater(state.jobs[index]);
  writeState(state);
  return state.jobs[index];
}

export function insertApplication(application: ApplicationRecord) {
  const state = readState();
  const existingIndex = state.applications.findIndex((item) => item.id === application.id);

  if (existingIndex >= 0) {
    state.applications[existingIndex] = application;
  } else {
    state.applications.push(application);
  }

  writeState(state);
  return application;
}

export function getApplicationById(applicationId: string) {
  return readState().applications.find((application) => application.id === applicationId) ?? null;
}

export function getApplicationByJobId(jobId: string) {
  return readState().applications.find((application) => application.jobId === jobId) ?? null;
}

export function updateApplication(applicationId: string, updater: (application: ApplicationRecord) => ApplicationRecord) {
  const state = readState();
  const index = state.applications.findIndex((application) => application.id === applicationId);

  if (index < 0) {
    return null;
  }

  state.applications[index] = updater(state.applications[index]);
  writeState(state);
  return state.applications[index];
}

export function updateApplicationAnswers(
  applicationId: string,
  edits: Array<{
    fieldId: string;
    answer: string;
  }>
) {
  return updateApplication(applicationId, (application) => ({
    ...application,
    fields: application.fields.map((field) => {
      const edit = edits.find((item) => item.fieldId === field.fieldId);
      return edit
        ? {
            ...field,
            answer: edit.answer,
            source: "user_edited",
            reasoning: `${field.reasoning} Edited by user during review.`
          }
        : field;
    }),
    updatedAt: new Date().toISOString()
  }));
}

export function createQueueRecord(queueName: QueueRecord["queueName"], entityId: string, entityLabel: string) {
  const state = readState();
  const queueRecord: QueueRecord = {
    id: crypto.randomUUID(),
    queueName,
    entityId,
    entityLabel,
    status: "queued",
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (queueName === "job-scraping") {
    state.queue.jobScraping.push(queueRecord);
  } else {
    state.queue.application.push(queueRecord);
  }

  writeState(state);
  return queueRecord;
}

export function getQueuedRecord(queueName: QueueRecord["queueName"]) {
  const queue = queueName === "job-scraping" ? readState().queue.jobScraping : readState().queue.application;
  return queue.find((job) => job.status === "queued") ?? null;
}

export function updateQueueRecord(queueName: QueueRecord["queueName"], queueRecordId: string, updater: (record: QueueRecord) => QueueRecord) {
  const state = readState();
  const collection = queueName === "job-scraping" ? state.queue.jobScraping : state.queue.application;
  const index = collection.findIndex((record) => record.id === queueRecordId);

  if (index < 0) {
    return null;
  }

  collection[index] = updater(collection[index]);
  writeState(state);
  return collection[index];
}

export function appendActivity(stage: ActivityEvent["stage"], message: string) {
  const state = readState();
  state.activity.push(createActivity(stage, message));
  state.activity = state.activity.slice(-50);
  writeState(state);
}
