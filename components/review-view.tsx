"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import type { ApplicationRecord } from "@/lib/types";

export function ReviewView({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadApplication();
  }, [applicationId]);

  const reviewReady = useMemo(() => application?.status === "awaiting_approval", [application]);

  async function loadApplication() {
    setLoading(true);

    try {
      const response = await fetch(`/api/applications/${applicationId}`);
      const payload = (await response.json()) as ApplicationRecord | { error?: string };

      if (!response.ok || "error" in payload) {
        throw new Error("Could not load application.");
      }

      setApplication(payload as ApplicationRecord);
    } catch (unknownError) {
      setStatus(unknownError instanceof Error ? unknownError.message : "Could not load application.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!application) {
      return;
    }

    setStatus(null);

    const response = await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: application.fields.map((field) => ({
          fieldId: field.fieldId,
          answer: field.answer
        }))
      })
    });

    if (!response.ok) {
      setStatus("Could not save edits.");
      return;
    }

    setStatus("Edits saved.");
  }

  async function approveApplication() {
    if (!application) {
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/applications/${application.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edits: application.fields.map((field) => ({
            fieldId: field.fieldId,
            answer: field.answer
          }))
        })
      });

      const payload = (await response.json()) as ApplicationRecord | { error?: string };

      if (!response.ok || "error" in payload) {
        throw new Error("Could not submit approved application.");
      }

      setApplication(payload as ApplicationRecord);
      setStatus("Application approved and submitted.");
    } catch (unknownError) {
      setStatus(unknownError instanceof Error ? unknownError.message : "Could not submit approved application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="panel">
        <p>Loading application review...</p>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="panel">
        <p className="error-text">{status ?? "Application not found."}</p>
      </main>
    );
  }

  return (
    <main className="review-grid">
      <section className="review-card">
        <div className="page-heading">
          <p className="eyebrow">Step 5</p>
          <h2>
            {application.jobTitle} at {application.company}
          </h2>
          <p className="subheading">
            Review every generated field before the final submission action. The agent has already filled the form and
            paused at the confirmation step.
          </p>
        </div>

        <div className="inline-actions">
          <StatusPill label={application.status.replaceAll("_", " ")} tone={application.status === "submitted" ? "success" : "warning"} />
          {application.tinyFishRuns.fill ? <span className="chip">TinyFish fill run: {application.tinyFishRuns.fill}</span> : null}
          {application.tinyFishRuns.submit ? <span className="chip">Submit run: {application.tinyFishRuns.submit}</span> : null}
        </div>

        <div className="field-grid" style={{ marginTop: 22 }}>
          {application.fields.map((field, index) => (
            <div className="field" key={field.fieldId}>
              <label htmlFor={field.fieldId}>
                {index + 1}. {field.label}
              </label>
              <textarea
                id={field.fieldId}
                onChange={(event) =>
                  setApplication((current) =>
                    current
                      ? {
                          ...current,
                          fields: current.fields.map((item) =>
                            item.fieldId === field.fieldId
                              ? {
                                  ...item,
                                  answer: event.target.value,
                                  source: "user_edited"
                                }
                              : item
                          )
                        }
                      : current
                  )
                }
                value={field.answer}
              />
              <div className="chip-row">
                <span className="chip">Type: {field.fieldType}</span>
                <span className="chip">Intent: {field.classification}</span>
                <span className="chip">Source: {field.source}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button className="button-secondary" onClick={saveDraft} type="button">
            Save Edits
          </button>
          <button className="button-primary" disabled={!reviewReady || submitting} onClick={approveApplication} type="button">
            {submitting ? "Submitting..." : "Approve and Submit"}
          </button>
        </div>
        {status ? <p className={status.includes("submitted") || status.includes("saved") ? "success-text" : "error-text"}>{status}</p> : null}
      </section>

      <aside className="panel-stack">
        <section className="activity-card">
          <p className="eyebrow">Confirmation Snapshot</p>
          <strong>{application.reviewSummary.confirmationTitle}</strong>
          <div className="summary-list" style={{ marginTop: 16 }}>
            {application.reviewSummary.previewLines.map((line) => (
              <div className="summary-item" key={line}>
                <p>{line}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="queue-card">
          <p className="eyebrow">Trace</p>
          <strong>Automation context</strong>
          <div className="summary-list" style={{ marginTop: 16 }}>
            <div className="summary-item">
              <span className="chip">Application URL</span>
              <p className="mono">{application.applicationUrl}</p>
            </div>
            <div className="summary-item">
              <span className="chip">Approval gate</span>
              <p>{application.reviewSummary.finalActionLabel}</p>
            </div>
            <div className="summary-item">
              <span className="chip">Job description snippet</span>
              <p>{application.jobDescription.slice(0, 220)}...</p>
            </div>
          </div>
        </section>
      </aside>
    </main>
  );
}
