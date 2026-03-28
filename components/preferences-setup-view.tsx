"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSystemSnapshot } from "@/lib/use-system-snapshot";

export function PreferencesSetupView() {
  const { snapshot, refresh } = useSystemSnapshot();
  const existing = snapshot.preferences;
  const [formState, setFormState] = useState({
    roles: existing?.roles.join(", ") ?? "",
    companies: existing?.companies?.join(", ") ?? "Shopee",
    industries: existing?.industries.join(", ") ?? "",
    locations: existing?.locations.join(", ") ?? "",
    salaryMin: existing?.salaryRange.min.toString() ?? "90000",
    salaryMax: existing?.salaryRange.max.toString() ?? "160000",
    currency: existing?.salaryRange.currency ?? "USD",
    keywords: existing?.keywords.join(", ") ?? ""
  });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) {
      return;
    }

    setFormState({
      roles: existing.roles.join(", "),
      companies: existing.companies?.join(", ") ?? "Shopee",
      industries: existing.industries.join(", "),
      locations: existing.locations.join(", "),
      salaryMin: existing.salaryRange.min.toString(),
      salaryMax: existing.salaryRange.max.toString(),
      currency: existing.salaryRange.currency,
      keywords: existing.keywords.join(", ")
    });
  }, [existing]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: splitCommaSeparated(formState.roles),
          companies: splitCommaSeparated(formState.companies),
          industries: splitCommaSeparated(formState.industries),
          locations: splitCommaSeparated(formState.locations),
          salaryRange: {
            min: Number(formState.salaryMin),
            max: Number(formState.salaryMax),
            currency: formState.currency
          },
          keywords: splitCommaSeparated(formState.keywords)
        })
      });

      if (!response.ok) {
        throw new Error("Could not save preferences.");
      }

      setStatus("Preferences saved.");
      await refresh();
    } catch (unknownError) {
      setStatus(unknownError instanceof Error ? unknownError.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-grid">
      <section className="panel">
        <div className="page-heading">
          <p className="eyebrow">Step 2</p>
          <h2>Targeting rules for job discovery</h2>
          <p className="subheading">
            These preferences drive LinkedIn discovery, relevance ranking, and which roles enter the queues.
          </p>
        </div>

        <form className="field-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="roles">Roles</label>
            <input id="roles" onChange={(event) => setFormState((current) => ({ ...current, roles: event.target.value }))} placeholder="Product Manager, Growth PM, AI Operations Lead" value={formState.roles} />
          </div>
          <div className="field">
            <label htmlFor="companies">Target companies</label>
            <input
              id="companies"
              onChange={(event) => setFormState((current) => ({ ...current, companies: event.target.value }))}
              placeholder="Shopee"
              value={formState.companies}
            />
          </div>
          <div className="field">
            <label htmlFor="industries">Industries</label>
            <input id="industries" onChange={(event) => setFormState((current) => ({ ...current, industries: event.target.value }))} placeholder="SaaS, Fintech, AI Tooling" value={formState.industries} />
          </div>
          <div className="field">
            <label htmlFor="locations">Locations</label>
            <input id="locations" onChange={(event) => setFormState((current) => ({ ...current, locations: event.target.value }))} placeholder="Remote, Singapore, New York" value={formState.locations} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="salaryMin">Salary min</label>
              <input id="salaryMin" onChange={(event) => setFormState((current) => ({ ...current, salaryMin: event.target.value }))} type="number" value={formState.salaryMin} />
            </div>
            <div className="field">
              <label htmlFor="salaryMax">Salary max</label>
              <input id="salaryMax" onChange={(event) => setFormState((current) => ({ ...current, salaryMax: event.target.value }))} type="number" value={formState.salaryMax} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <input id="currency" onChange={(event) => setFormState((current) => ({ ...current, currency: event.target.value }))} value={formState.currency} />
          </div>
          <div className="field">
            <label htmlFor="keywords">Additional keywords</label>
            <textarea id="keywords" onChange={(event) => setFormState((current) => ({ ...current, keywords: event.target.value }))} placeholder="Customer insights, experimentation, platform strategy" value={formState.keywords} />
          </div>

          <div className="form-actions">
            <button className="button-primary" disabled={saving} type="submit">
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
          {status ? <p className={status.includes("saved") ? "success-text" : "error-text"}>{status}</p> : null}
        </form>
      </section>

      <aside className="panel-stack">
        <section className="activity-card">
          <p className="eyebrow">Discovery Notes</p>
          <strong>How these settings are used</strong>
          <div className="summary-list" style={{ marginTop: 16 }}>
            <div className="summary-item">
              <span className="chip">Discovery</span>
              <p>Roles, target companies, locations, and keywords drive live LinkedIn searches when TinyFish is available.</p>
            </div>
            <div className="summary-item">
              <span className="chip">Relevance</span>
              <p>OpenAI scores jobs against the profile, skills, industries, and explicit keywords.</p>
            </div>
            <div className="summary-item">
              <span className="chip">Queueing</span>
              <p>Only jobs above the relevance threshold are pushed into the mandatory scraping queue.</p>
            </div>
          </div>
        </section>
      </aside>
    </main>
  );
}

function splitCommaSeparated(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
