import { getTinyFishRun, startLinkedInLogin } from "@/lib/services/tinyfish-service";
import { appendDebugLog } from "@/lib/debug-log";
import { appendActivity, clearLinkedInSession, getSnapshot, upsertLinkedInSession } from "@/lib/store";

export async function beginLinkedInConnection() {
  const snapshot = getSnapshot();
  const now = new Date().toISOString();
  appendDebugLog("linkedin-debug.log", "linkedin.begin_connection_requested", {
    profilePresent: Boolean(snapshot.profile),
    existingSessionStatus: snapshot.linkedinSession?.status ?? null
  });
  upsertLinkedInSession({
    status: "connecting",
    sessionOwner: snapshot.profile?.fullName ?? "Pending LinkedIn session",
    jobsUrl: "https://www.linkedin.com/jobs/",
    connectedAt: now,
    updatedAt: now
  });
  appendActivity("discovery", "TinyFish started a LinkedIn login run in its controlled browser session.");

  try {
    const loginRun = await startLinkedInLogin(snapshot.profile ?? undefined);
    const session = upsertLinkedInSession({
      status: "connecting",
      sessionOwner: snapshot.profile?.fullName ?? "Pending LinkedIn session",
      jobsUrl: "https://www.linkedin.com/jobs/",
      connectedAt: now,
      updatedAt: now,
      tinyFishRunId: loginRun.runId,
      tinyFishRunStatus: "PENDING",
      loginUrl: loginRun.interactiveUrl
    });

    appendDebugLog("linkedin-debug.log", "linkedin.begin_connection_completed", {
      status: session.status,
      sessionOwner: session.sessionOwner,
      jobsUrl: session.jobsUrl,
      tinyFishRunId: session.tinyFishRunId,
      loginUrl: session.loginUrl ?? null
    });
    appendActivity(
      "discovery",
      loginRun.interactiveUrl
        ? "TinyFish prepared an interactive LinkedIn login session for the user."
        : "TinyFish started a LinkedIn login run, but no interactive login URL was returned."
    );
    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn authentication failed.";
    appendDebugLog("linkedin-debug.log", "linkedin.connection_failed", {
      message,
      priorStatus: "connecting"
    });
    upsertLinkedInSession({
      status: "expired",
      sessionOwner: snapshot.profile?.fullName ?? "LinkedIn session failed",
      jobsUrl: "https://www.linkedin.com/jobs/",
      connectedAt: now,
      updatedAt: new Date().toISOString(),
      lastError: message
    });
    appendActivity("discovery", `LinkedIn authentication failed: ${message}`);
    throw error;
  }
}

export async function refreshLinkedInConnection() {
  const snapshot = getSnapshot();
  const currentSession = snapshot.linkedinSession;

  if (!currentSession?.tinyFishRunId) {
    return currentSession;
  }

  appendDebugLog("linkedin-debug.log", "linkedin.refresh_connection_requested", {
    tinyFishRunId: currentSession.tinyFishRunId,
    priorStatus: currentSession.status,
    runStatus: currentSession.tinyFishRunStatus ?? null
  });

  const run = await getTinyFishRun(currentSession.tinyFishRunId);
  const now = new Date().toISOString();

  if (run.status === "COMPLETED") {
    const result = run.result as {
      sessionOwner?: string;
      jobsUrl?: string;
    };

    const session = upsertLinkedInSession({
      ...currentSession,
      status: "connected",
      sessionOwner: result.sessionOwner ?? currentSession.sessionOwner ?? "LinkedIn member",
      jobsUrl: result.jobsUrl ?? currentSession.jobsUrl ?? "https://www.linkedin.com/jobs/collections/recommended/",
      connectedAt: currentSession.connectedAt,
      updatedAt: now,
      tinyFishRunId: currentSession.tinyFishRunId,
      tinyFishRunStatus: run.status,
      loginUrl: run.interactiveUrl ?? currentSession.loginUrl
    });

    appendDebugLog("linkedin-debug.log", "linkedin.refresh_connection_completed", {
      status: session.status,
      tinyFishRunStatus: session.tinyFishRunStatus,
      loginUrl: session.loginUrl ?? null
    });
    return session;
  }

  if (run.status === "FAILED" || run.status === "CANCELLED") {
    const session = upsertLinkedInSession({
      ...currentSession,
      status: "expired",
      updatedAt: now,
      tinyFishRunStatus: run.status,
      lastError: run.error ?? "TinyFish LinkedIn login failed.",
      loginUrl: run.interactiveUrl ?? currentSession.loginUrl
    });
    appendDebugLog("linkedin-debug.log", "linkedin.refresh_connection_failed", {
      status: session.status,
      tinyFishRunStatus: session.tinyFishRunStatus,
      lastError: session.lastError ?? null
    });
    return session;
  }

  const session = upsertLinkedInSession({
    ...currentSession,
    status: "connecting",
    updatedAt: now,
    tinyFishRunStatus: run.status,
    loginUrl: run.interactiveUrl ?? currentSession.loginUrl
  });
  appendDebugLog("linkedin-debug.log", "linkedin.refresh_connection_pending", {
    status: session.status,
    tinyFishRunStatus: session.tinyFishRunStatus,
    loginUrl: session.loginUrl ?? null
  });
  return session;
}

export function disconnectLinkedInAccount() {
  appendDebugLog("linkedin-debug.log", "linkedin.disconnect_requested");
  clearLinkedInSession();
  appendActivity("discovery", "LinkedIn session cleared. The next discovery run will require a fresh login.");
}
