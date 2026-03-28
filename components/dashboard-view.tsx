"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { useSystemSnapshot } from "@/lib/use-system-snapshot";

export function DashboardView() {
  const { snapshot, loading, refresh } = useSystemSnapshot();
  const [discovering, setDiscovering] = useState(false);
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

  const firstReview = snapshot.applications.find((application) => application.status === "awaiting_approval");

  return (
    <main className="page-grid">
      <section>
        <div className="page-heading">
          <p className="eyebrow">Mission Control</p>
          <h2>Run the full agent loop with visible queues and explicit approval.</h2>
          <p className="subheading">
            FillMeUp keeps the heavy lifting autonomous, but the final submit action stays human-approved.
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
          <p className="eyebrow">Agent Loop</p>
          <h2>Observe, reason, act, pause, submit.</h2>
          <p>
            The discovery pipeline feeds the job scraping queue. Structured jobs feed the application queue. TinyFish
            brings each form to its confirmation screen, OpenAI drafts answers, and FormPilot waits for approval before
            the last click.
          </p>
          <div className="inline-actions">
            <button className="button-primary" disabled={discovering} onClick={triggerDiscovery} type="button">
              {discovering ? "Running Discovery..." : "Discover LinkedIn Jobs"}
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
