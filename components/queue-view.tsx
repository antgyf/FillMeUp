"use client";

import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { useSystemSnapshot } from "@/lib/use-system-snapshot";

export function QueueView() {
  const { snapshot, loading } = useSystemSnapshot();

  return (
    <main>
      <div className="page-heading">
        <p className="eyebrow">Pipelines</p>
        <h2>Job discovery, scraping, processing, and review</h2>
        <p className="subheading">
          Both mandatory queues are visible here so you can see where every job stands in the agent pipeline.
        </p>
      </div>

      <div className="queue-grid">
        <section className="queue-card">
          <p className="eyebrow">Queue 1</p>
          <strong>Job Scraping Queue</strong>
          <p className="table-caption">LinkedIn listing URLs waiting for TinyFish extraction and normalization.</p>
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Status</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.queue.jobScraping.length === 0 ? (
                <tr>
                  <td colSpan={3}>No scraping jobs queued yet.</td>
                </tr>
              ) : (
                snapshot.queue.jobScraping
                  .slice()
                  .reverse()
                  .map((job) => (
                    <tr key={job.id}>
                      <td>{job.entityLabel}</td>
                      <td>
                        <StatusPill label={job.status} tone={toneForQueue(job.status)} />
                      </td>
                      <td>{job.attempts}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </section>

        <section className="queue-card">
          <p className="eyebrow">Queue 2</p>
          <strong>Application Queue</strong>
          <p className="table-caption">
            Processed jobs waiting for field understanding, answer generation, and TinyFish form filling.
          </p>
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Status</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.queue.application.length === 0 ? (
                <tr>
                  <td colSpan={3}>No application jobs queued yet.</td>
                </tr>
              ) : (
                snapshot.queue.application
                  .slice()
                  .reverse()
                  .map((job) => (
                    <tr key={job.id}>
                      <td>{job.entityLabel}</td>
                      <td>
                        <StatusPill label={job.status} tone={toneForQueue(job.status)} />
                      </td>
                      <td>{job.attempts}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="table-card" style={{ marginTop: 18 }}>
        <div className="page-heading">
          <h2>Normalized jobs</h2>
          <p className="table-caption">Jobs that have made it through discovery and scraping.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Company</th>
              <th>Status</th>
              <th>Application</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.jobs.length === 0 ? (
              <tr>
                <td colSpan={4}>Run discovery to populate jobs.</td>
              </tr>
            ) : (
              snapshot.jobs
                .slice()
                .reverse()
                .map((job) => {
                  const application = snapshot.applications.find((item) => item.jobId === job.id);
                  return (
                    <tr key={job.id}>
                      <td>
                        <strong>{job.title}</strong>
                        <p className="copy-muted">{job.location}</p>
                      </td>
                      <td>{job.company}</td>
                      <td>
                        <StatusPill label={job.status.replaceAll("_", " ")} tone={toneForDomain(job.status)} />
                      </td>
                      <td>
                        {application ? (
                          <Link className="button-ghost" href={`/review/${application.id}`}>
                            Open Review
                          </Link>
                        ) : (
                          "Pending"
                        )}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
        {loading ? <p className="hint">Refreshing queue state...</p> : null}
      </section>
    </main>
  );
}

function toneForQueue(status: string) {
  if (status === "completed") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  return "warning";
}

function toneForDomain(status: string) {
  if (status === "submitted") {
    return "success";
  }

  if (status.includes("failed")) {
    return "danger";
  }

  return "warning";
}
