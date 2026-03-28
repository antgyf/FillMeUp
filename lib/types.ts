export type QueueStatus = "queued" | "running" | "completed" | "failed";
export type JobStatus =
  | "discovered"
  | "scraping"
  | "ready"
  | "application_queued"
  | "awaiting_approval"
  | "submitted"
  | "failed";
export type ApplicationStatus =
  | "queued"
  | "analyzing"
  | "filling"
  | "awaiting_approval"
  | "submitting"
  | "submitted"
  | "failed";
export type FieldClassification = "personal_info" | "structured_data" | "open_ended" | "compliance";
export type FieldType = "text" | "textarea" | "select" | "checkbox" | "radio" | "file";
export type AnswerSource = "profile" | "ai_generated" | "user_edited" | "system";

export type ResumeAsset = {
  fileName: string;
  mimeType: string;
  base64: string;
};

export type ParsedProfile = {
  headline: string;
  summary: string;
  yearsExperience: number;
  topAchievements: string[];
  preferredIndustries: string[];
};

export type ResumeParseStatus =
  | "live"
  | "mock_no_api_key"
  | "mock_no_resume"
  | "mock_api_error"
  | "mock_invalid_json";

export type ResumeParseDiagnostics = {
  status: ResumeParseStatus;
  source: "openai" | "mock";
  model: string;
  startedAt: string;
  finishedAt: string;
  logFile: string;
  requestId?: string;
  error?: string;
  notes?: string;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  skills: string[];
  notes?: string;
  resume?: ResumeAsset;
  parsedProfile: ParsedProfile;
  parserDiagnostics?: ResumeParseDiagnostics;
  createdAt: string;
  updatedAt: string;
};

export type JobPreferences = {
  roles: string[];
  industries: string[];
  locations: string[];
  salaryRange: {
    min: number;
    max: number;
    currency: string;
  };
  keywords: string[];
  updatedAt: string;
};

export type JobRecord = {
  id: string;
  source: "linkedin";
  title: string;
  company: string;
  location: string;
  listingUrl: string;
  applicationUrl: string;
  jobDescription: string;
  employmentType: string;
  relevanceScore: number;
  status: JobStatus;
  discoveredAt: string;
  updatedAt: string;
  keyRequirements: string[];
  tinyFishRunId?: string;
};

export type ApplicationField = {
  fieldId: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  step: string;
  classification: FieldClassification;
  placeholder?: string;
  options?: string[];
  answer: string;
  source: AnswerSource;
  reasoning: string;
};

export type ReviewSummary = {
  confirmationTitle: string;
  previewLines: string[];
  finalActionLabel: string;
};

export type ApplicationRecord = {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  applicationUrl: string;
  jobDescription: string;
  status: ApplicationStatus;
  fields: ApplicationField[];
  reviewSummary: ReviewSummary;
  createdAt: string;
  updatedAt: string;
  tinyFishRuns: {
    extract?: string;
    fill?: string;
    submit?: string;
  };
  lastError?: string;
};

export type QueueRecord = {
  id: string;
  queueName: "job-scraping" | "application";
  entityId: string;
  entityLabel: string;
  status: QueueStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type ActivityEvent = {
  id: string;
  stage: "profile" | "discovery" | "scraping" | "application" | "approval" | "submission";
  message: string;
  createdAt: string;
};

export type FormPilotState = {
  profile: UserProfile | null;
  preferences: JobPreferences | null;
  jobs: JobRecord[];
  applications: ApplicationRecord[];
  queue: {
    jobScraping: QueueRecord[];
    application: QueueRecord[];
  };
  activity: ActivityEvent[];
};

export type JobSeed = {
  title: string;
  company: string;
  location: string;
  listingUrl: string;
  applicationUrl: string;
  employmentType: string;
  industries: string[];
  keywords: string[];
  jobDescription: string;
  keyRequirements: string[];
};

export type DiscoveryMode = "live" | "mock";

export type JobDiscoveryResult = {
  jobs: JobSeed[];
  mode: DiscoveryMode;
  queryCount: number;
  notes: string[];
};
