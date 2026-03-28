import { mockLinkedInCatalog } from "@/lib/discovery-catalog";
import { isTinyFishMockMode, runTinyFishAutomation } from "@/lib/services/tinyfish-service";
import type { JobDiscoveryResult, JobPreferences, JobSeed } from "@/lib/types";

const defaultMaxQueries = 6;
const defaultResultsPerQuery = 5;

type SearchQuery = {
  keyword: string;
  location: string;
};

type ExtractedLinkedInJob = Partial<JobSeed>;

export async function discoverLinkedInJobs(preferences: JobPreferences): Promise<JobDiscoveryResult> {
  const queryPlan = buildSearchPlan(preferences).slice(0, getMaxQueries());

  if (process.env.LINKEDIN_DISCOVERY_MODE === "mock" || isTinyFishMockMode()) {
    return buildMockResult(queryPlan.length, "LinkedIn discovery is running in fallback mode because TinyFish live automation is not configured.");
  }

  try {
    const discoveredJobs: JobSeed[] = [];

    for (const query of queryPlan) {
      const result = await runTinyFishAutomation(
        {
          url: buildLinkedInSearchUrl(query),
          goal: [
            "Open this LinkedIn Jobs search results page and inspect the visible job cards.",
            `Return up to ${getResultsPerQuery()} relevant jobs as JSON with a top-level jobs array.`,
            "Each job must include title, company, location, listingUrl, applicationUrl when visible, employmentType when visible, jobDescription, and keyRequirements.",
            "Use only jobs visible on the page. Do not invent fields. Use an empty array when no jobs are available.",
            "Respond in JSON."
          ].join(" ")
        },
        { jobs: [] as ExtractedLinkedInJob[] },
        {
          browserProfile: "stealth"
        }
      );

      const normalizedJobs = normalizeJobs(result.result.jobs ?? [], preferences, query);
      discoveredJobs.push(...normalizedJobs);
    }

    const uniqueJobs = dedupeJobs(discoveredJobs);

    if (uniqueJobs.length === 0) {
      return buildMockResult(
        queryPlan.length,
        "Live LinkedIn discovery ran but returned no visible jobs, so FormPilot fell back to the local seed catalog."
      );
    }

    return {
      jobs: uniqueJobs,
      mode: "live",
      queryCount: queryPlan.length,
      notes: [
        `LinkedIn discovery used ${queryPlan.length} live search quer${queryPlan.length === 1 ? "y" : "ies"} via TinyFish.`
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown discovery error.";
    console.error("LinkedIn discovery failed and is falling back to the local catalog.", {
      message,
      queryPlan
    });
    return buildMockResult(queryPlan.length, `Live LinkedIn discovery failed and FormPilot fell back to the local seed catalog. ${message}`);
  }
}

function buildSearchPlan(preferences: JobPreferences) {
  const roles = preferences.roles.length ? preferences.roles : ["Product Manager"];
  const locations = preferences.locations.length ? preferences.locations : ["Remote"];
  const keywordTail = preferences.keywords.slice(0, 2);
  const queries: SearchQuery[] = [];

  for (const role of roles.slice(0, 3)) {
    for (const location of locations.slice(0, 3)) {
      const keyword = [role, ...keywordTail].join(" ").trim();
      queries.push({ keyword, location });
    }
  }

  return dedupeQueries(queries);
}

function dedupeQueries(queries: SearchQuery[]) {
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = `${query.keyword.toLowerCase()}::${query.location.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildLinkedInSearchUrl(query: SearchQuery) {
  const url = new URL("https://www.linkedin.com/jobs/search/");
  url.searchParams.set("keywords", query.keyword);
  url.searchParams.set("location", query.location);
  return url.toString();
}

function normalizeJobs(jobs: ExtractedLinkedInJob[], preferences: JobPreferences, query: SearchQuery) {
  return jobs
    .map((job) => normalizeJob(job, preferences, query))
    .filter((job): job is JobSeed => Boolean(job));
}

function normalizeJob(job: ExtractedLinkedInJob, preferences: JobPreferences, query: SearchQuery) {
  if (!job.title || !job.company || !job.listingUrl) {
    return null;
  }

  const title = job.title.trim();
  const company = job.company.trim();
  const location = job.location?.trim() || query.location;
  const listingUrl = sanitizeLinkedInUrl(job.listingUrl.trim());
  const applicationUrl = job.applicationUrl?.trim() || listingUrl;
  const employmentType = job.employmentType?.trim() || "Unknown";
  const jobDescription = job.jobDescription?.trim() || `LinkedIn search result for ${title} at ${company}.`;
  const keyRequirements = sanitizeList(job.keyRequirements, preferences.keywords);
  const keywords = sanitizeList(job.keywords, [query.keyword, ...preferences.keywords]);
  const industries = sanitizeList(job.industries, preferences.industries);

  return {
    title,
    company,
    location,
    listingUrl,
    applicationUrl,
    employmentType,
    industries,
    keywords,
    jobDescription,
    keyRequirements
  };
}

function sanitizeLinkedInUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}

function sanitizeList(value: unknown, fallback: string[]) {
  const source = Array.isArray(value) ? value : fallback;
  const cleaned = source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return cleaned.length ? cleaned.slice(0, 8) : fallback.slice(0, 8);
}

function dedupeJobs(jobs: JobSeed[]) {
  const byListingUrl = new Map<string, JobSeed>();

  for (const job of jobs) {
    if (!byListingUrl.has(job.listingUrl)) {
      byListingUrl.set(job.listingUrl, job);
    }
  }

  return Array.from(byListingUrl.values());
}

function buildMockResult(queryCount: number, note: string): JobDiscoveryResult {
  return {
    jobs: mockLinkedInCatalog,
    mode: "mock",
    queryCount,
    notes: [note]
  };
}

function getMaxQueries() {
  return getPositiveInteger(process.env.LINKEDIN_DISCOVERY_MAX_QUERIES, defaultMaxQueries);
}

function getResultsPerQuery() {
  return getPositiveInteger(process.env.LINKEDIN_DISCOVERY_RESULTS_PER_QUERY, defaultResultsPerQuery);
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
