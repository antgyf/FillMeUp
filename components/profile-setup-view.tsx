"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSystemSnapshot } from "@/lib/use-system-snapshot";

type ResumePayload = {
  fileName: string;
  mimeType: string;
  base64: string;
};

export function ProfileSetupView() {
  const { snapshot, refresh } = useSystemSnapshot();
  const existingProfile = snapshot.profile;
  const [resume, setResume] = useState<ResumePayload | undefined>(existingProfile?.resume);
  const [formState, setFormState] = useState({
    fullName: existingProfile?.fullName ?? "",
    email: existingProfile?.email ?? "",
    phone: existingProfile?.phone ?? "",
    location: existingProfile?.location ?? "",
    linkedinUrl: existingProfile?.linkedinUrl ?? "",
    websiteUrl: existingProfile?.websiteUrl ?? "",
    skills: existingProfile?.skills.join(", ") ?? "",
    notes: existingProfile?.notes ?? ""
  });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existingProfile) {
      return;
    }

    setFormState({
      fullName: existingProfile.fullName,
      email: existingProfile.email,
      phone: existingProfile.phone,
      location: existingProfile.location,
      linkedinUrl: existingProfile.linkedinUrl ?? "",
      websiteUrl: existingProfile.websiteUrl ?? "",
      skills: existingProfile.skills.join(", "),
      notes: existingProfile.notes ?? ""
    });
    setResume(existingProfile.resume);
  }, [existingProfile]);

  const parsedSummary = useMemo(() => existingProfile?.parsedProfile, [existingProfile]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const base64 = await fileToBase64(file);
    setResume({
      fileName: file.name,
      mimeType: file.type,
      base64
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          skills: splitCommaSeparated(formState.skills),
          resume
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not save profile.");
      }

      setStatus("Profile saved and resume parsed.");
      await refresh();
    } catch (unknownError) {
      setStatus(unknownError instanceof Error ? unknownError.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-grid">
      <section className="panel">
        <div className="page-heading">
          <p className="eyebrow">Step 1</p>
          <h2>Candidate profile and resume intake</h2>
          <p className="subheading">
            Upload a PDF, capture core identity details, and let OpenAI convert the resume into structured JSON.
          </p>
        </div>

        <form className="field-grid" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))} value={formState.fullName} />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} value={formState.email} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} value={formState.phone} />
            </div>
            <div className="field">
              <label htmlFor="location">Location</label>
              <input id="location" onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))} value={formState.location} />
            </div>
            <div className="field">
              <label htmlFor="linkedinUrl">LinkedIn URL</label>
              <input id="linkedinUrl" onChange={(event) => setFormState((current) => ({ ...current, linkedinUrl: event.target.value }))} value={formState.linkedinUrl} />
            </div>
            <div className="field">
              <label htmlFor="websiteUrl">Portfolio or website</label>
              <input id="websiteUrl" onChange={(event) => setFormState((current) => ({ ...current, websiteUrl: event.target.value }))} value={formState.websiteUrl} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="skills">Skills</label>
            <input
              id="skills"
              onChange={(event) => setFormState((current) => ({ ...current, skills: event.target.value }))}
              placeholder="TypeScript, Product Analytics, React, SQL"
              value={formState.skills}
            />
            <span className="hint">Comma-separated skills become the structured profile skill list.</span>
          </div>

          <div className="field">
            <label htmlFor="notes">Notes for the agent</label>
            <textarea
              id="notes"
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Add availability, work authorization, or compensation context here."
              value={formState.notes}
            />
          </div>

          <div className="field">
            <label htmlFor="resume">Resume PDF</label>
            <input accept="application/pdf" id="resume" onChange={handleFileChange} type="file" />
            <span className="hint">
              {resume ? `Attached: ${resume.fileName}` : "No resume uploaded yet. PDF upload is used for parsing and file fill steps."}
            </span>
          </div>

          <div className="form-actions">
            <button className="button-primary" disabled={saving} type="submit">
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
          {status ? <p className={status.includes("saved") ? "success-text" : "error-text"}>{status}</p> : null}
        </form>
      </section>

      <aside className="panel-stack">
        <section className="activity-card">
          <p className="eyebrow">Structured Output</p>
          <strong>Parsed profile JSON</strong>
          {parsedSummary ? (
            <div className="summary-list" style={{ marginTop: 16 }}>
              <div className="summary-item">
                <strong>{parsedSummary.headline}</strong>
                <p>{parsedSummary.summary}</p>
              </div>
              <div className="summary-item">
                <span className="chip">Years of experience</span>
                <p>{parsedSummary.yearsExperience}</p>
              </div>
              <div className="summary-item">
                <span className="chip">Top achievements</span>
                <div className="chip-row">
                  {parsedSummary.topAchievements.map((achievement) => (
                    <span className="chip" key={achievement}>
                      {achievement}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="copy-muted">Once saved, the parser output appears here as structured profile context.</p>
          )}
        </section>
      </aside>
    </main>
  );
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file."));
        return;
      }

      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function splitCommaSeparated(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
