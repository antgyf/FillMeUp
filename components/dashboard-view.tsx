"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { useSystemSnapshot } from "@/lib/use-system-snapshot";

export function DashboardView() {
  const { snapshot, loading, refresh } = useSystemSnapshot();
  const [discovering, setDiscovering] = useState(false);
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false);
  const [disconnectingLinkedIn, setDisconnectingLinkedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(
    () => ({
      discovered: snapshot.jobs.length,
      readyForReview: snapshot.applications.filter((application) => application.status === "awaiting_approval").length,
      submitted: snapshot.applications.filter((application) => application.status === "submitted").length,
      failed: [...snapshot.queue.jobScraping, ...snapshot.queue.application].filter((job) => job.status === "failed").length
    }),
    [snapshot]
  );

  async function triggerDiscovery() {
    setDiscovering(true);
    setError(null);

    try {
      const response = await fetch("/api/jobs/discover", { method: "POST" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Discovery failed.");
      }

      await refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  }

  async function connectLinkedIn() {
    setConnectingLinkedIn(true);
    setError(null);

    try {
      const response = await fetch("/api/linkedin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "begin" })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "LinkedIn login failed.");
      }
      const session = payload as { loginUrl?: string | null };
      if (session.loginUrl) {
        const loginWindow = window.open(session.loginUrl, "_blank", "noopener,noreferrer");
        if (!loginWindow) {
          throw new Error("TinyFish provided a login URL, but the browser blocked it. Allow popups and try again.");
        }
      } else {
        throw new Error("TinyFish started the login run but did not return an interactive login URL.");
      }
      await refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "LinkedIn login failed.");
    } finally {
      setConnectingLinkedIn(false);
    }
  }

  useEffect(() => {
    if (snapshot.linkedinSession?.status !== "connecting" || !snapshot.linkedinSession?.tinyFishRunId) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/linkedin/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ action: "status" })
        });
        const payload = (await response.json()) as { lastError?: string };

        if (!response.ok) {
          throw new Error(payload.lastError ?? "Could not refresh LinkedIn login status.");
        }

        await refresh();
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : "Could not refresh LinkedIn login status.");
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [refresh, snapshot.linkedinSession?.status, snapshot.linkedinSession?.tinyFishRunId]);

  async function disconnectLinkedIn() {
    setDisconnectingLinkedIn(true);
    setError(null);

    try {
      const response = await fetch("/api/linkedin/session", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "LinkedIn disconnect failed.");
      }

      await refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "LinkedIn disconnect failed.");
    } finally {
      setDisconnectingLinkedIn(false);
    }
  }

  const firstReview = snapshot.applications.find((application) => application.status === "awaiting_approval");
  const linkedInConnected = snapshot.linkedinSession?.status === "connected";
  const linkedInStatusLabel = linkedInConnected ? "connected" : "not connected";
  const linkedInRunId = snapshot.linkedinSession?.tinyFishRunId ?? null;
  const linkedInRunStatus = snapshot.linkedinSession?.tinyFishRunStatus ?? null;

  return (
    <main className="page-grid">
      <section>
        <div className="page-heading">
          <p className="eyebrow">Mission Control</p>
          <h2>Run the full agent loop with visible queues and explicit approval.</h2>
          <p className="subheading">
            FormPilot keeps the heavy lifting autonomous, but the final submit action stays human-approved.
          </p>
        </div>

        <div className="metrics-grid">
          <article className="metric-card">
            <p>Discovered jobs</p>
            <div className="metric-value">{metrics.discovered}</div>
            <StatusPill label="LinkedIn intake" tone="warning" />
          </article>
          <article className="metric-card">
            <p>Awaiting approval</p>
            <div className="metric-value">{metrics.readyForReview}</div>
            <StatusPill label="Review required" tone="warning" />
          </article>
          <article className="metric-card">
            <p>Submitted</p>
            <div className="metric-value">{metrics.submitted}</div>
            <StatusPill label="Completed" tone="success" />
          </article>
          <article className="metric-card">
            <p>Failed queue jobs</p>
            <div className="metric-value">{metrics.failed}</div>
            <StatusPill label="Needs retry" tone={metrics.failed > 0 ? "danger" : "success"} />
          </article>
        </div>

        <section className="panel" style={{ marginTop: 18 }}>
          <p className="eyebrow">LinkedIn Session</p>
          <h2>Authenticate the user's account before discovery.</h2>
          <p>
            TinyFish owns the LinkedIn browser session here. The status only changes when TinyFish actually returns a
            verified authenticated session that can later be reused for scraping.
          </p>
          <div className="inline-actions">
            <button
              className="button-primary"
              disabled={connectingLinkedIn || disconnectingLinkedIn}
              onClick={connectLinkedIn}
              type="button"
            >
              {connectingLinkedIn ? "Waiting For TinyFish Login..." : linkedInConnected ? "Reconnect LinkedIn" : "Log In To LinkedIn"}
            </button>
            {snapshot.linkedinSession ? (
              <button
                className="button-secondary"
                disabled={disconnectingLinkedIn || connectingLinkedIn}
                onClick={disconnectLinkedIn}
                type="button"
              >
                {disconnectingLinkedIn ? "Clearing Session..." : "Disconnect LinkedIn"}
              </button>
            ) : null}
          </div>
          <div className="chip-row" style={{ marginTop: 14 }}>
            <StatusPill
              label={linkedInStatusLabel}
              tone={linkedInConnected ? "success" : "warning"}
            />
            {snapshot.linkedinSession?.sessionOwner ? <span className="hint">Session owner: {snapshot.linkedinSession.sessionOwner}</span> : null}
            {snapshot.linkedinSession?.tinyFishRunStatus ? (
              <span className="hint">TinyFish run: {snapshot.linkedinSession.tinyFishRunStatus.toLowerCase()}</span>
            ) : null}
            {snapshot.linkedinSession?.lastSyncedAt ? (
              <span className="hint">Last scrape: {new Date(snapshot.linkedinSession.lastSyncedAt).toLocaleString()}</span>
            ) : null}
          </div>
          {linkedInRunId ? (
            <div className="summary-list" style={{ marginTop: 16 }}>
              <div className="summary-item">
                <strong>Current TinyFish Login Run</strong>
                <p className="copy-muted mono" style={{ marginTop: 6 }}>{linkedInRunId}</p>
                <p className="copy-muted" style={{ marginTop: 6 }}>
                  {linkedInRunStatus
                    ? `FormPilot is waiting on this one TinyFish run. Current status: ${linkedInRunStatus.toLowerCase()}.`
                    : "FormPilot is waiting on this one TinyFish run to report back."}
                </p>
              </div>
            </div>
          ) : null}
          {snapshot.linkedinSession?.lastError ? <p className="error-text">{snapshot.linkedinSession.lastError}</p> : null}
          <p className="hint">
            If TinyFish returns an interactive login URL, FormPilot will open it for the user and poll the TinyFish run.
            The badge only switches to <span className="mono">connected</span> after TinyFish reports the run completed.
          </p>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <p className="eyebrow">Agent Loop</p>
          <h2>Log in, scrape, enrich, apply, pause, submit.</h2>
          <p>
            After LinkedIn authentication, TinyFish scrapes jobs from the user's own account, the enrichment queue
            normalizes each listing, and the application queue brings every form to its confirmation screen before the
            last click.
          </p>
          <div className="inline-actions">
            <button
              className="button-primary"
              disabled={discovering || !linkedInConnected}
              onClick={triggerDiscovery}
              type="button"
            >
              {discovering ? "Scraping Jobs..." : "Scrape My LinkedIn Jobs"}
            </button>
            <Link className="button-secondary" href="/preferences">
              Update Preferences
            </Link>
            {firstReview ? (
              <Link className="button-secondary" href={`/review/${firstReview.id}`}>
                Review Next Application
              </Link>
            ) : null}
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          {!linkedInConnected ? <p className="hint">Log in to LinkedIn first to enable discovery.</p> : null}
          {loading ? <p className="hint">Refreshing dashboard state...</p> : null}
        </section>

        <section className="table-card" style={{ marginTop: 18 }}>
          <div className="page-heading">
            <h2>Applications in Flight</h2>
            <p className="table-caption">Latest application drafts and queue outcomes.</p>
          </div>
          {snapshot.applications.length === 0 ? (
            <div className="empty-card">
              <p className="copy-muted">
                Start by saving a profile and preferences, then run discovery to populate the queues.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Fields</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.applications
                  .slice()
                  .reverse()
                  .map((application) => (
                    <tr key={application.id}>
                      <td>
                        <strong>{application.jobTitle}</strong>
                        <p className="copy-muted">{application.company}</p>
                      </td>
                      <td>
                        <StatusPill label={application.status.replaceAll("_", " ")} tone={toneForStatus(application.status)} />
                      </td>
                      <td>{application.fields.length}</td>
                      <td>
                        <Link className="button-ghost" href={`/review/${application.id}`}>
                          Open Review
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </section>

      <aside className="panel-stack">
        <section className="activity-card">
          <p className="eyebrow">Activity Feed</p>
          <strong>Recent pipeline events</strong>
          <div className="activity-list" style={{ marginTop: 16 }}>
            {snapshot.activity.length === 0 ? (
              <p className="copy-muted">Pipeline activity appears here once the agent starts working jobs.</p>
            ) : (
              snapshot.activity
                .slice()
                .reverse()
                .slice(0, 8)
                .map((event) => (
                  <div className="activity-item" key={event.id}>
                    <div className="chip-row">
                      <span className="chip">{event.stage}</span>
                      <span className="hint mono">{new Date(event.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p>{event.message}</p>
                  </div>
                ))
            )}
          </div>
        </section>

        <section className="queue-card">
          <p className="eyebrow">Queue Health</p>
          <strong>Worker status snapshot</strong>
          <table style={{ marginTop: 16 }}>
            <tbody>
              <tr>
                <td>Job scraping queue</td>
                <td>{snapshot.queue.jobScraping.filter((job) => job.status === "queued").length} queued</td>
              </tr>
              <tr>
                <td>Application queue</td>
                <td>{snapshot.queue.application.filter((job) => job.status === "queued").length} queued</td>
              </tr>
              <tr>
                <td>Currently running</td>
                <td>{[...snapshot.queue.jobScraping, ...snapshot.queue.application].filter((job) => job.status === "running").length}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </aside>
    </main>
  );
}

function toneForStatus(status: string) {
  if (status === "submitted") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  return "warning";
}
