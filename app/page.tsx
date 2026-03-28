import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hero-grid">
      <section className="hero-card">
        <p className="eyebrow">Agentic Job Application Pipeline</p>
        <h1>FormPilot turns job hunting into a supervised automation system.</h1>
        <p className="hero-copy">
          Collect a structured candidate profile, discover LinkedIn roles, run them through a scraping queue,
          autofill applications with OpenAI reasoning plus TinyFish browser automation, and require human
          approval before the final submit step.
        </p>
        <div className="hero-actions">
          <Link className="button-primary" href="/dashboard">
            Open Dashboard
          </Link>
          <Link className="button-secondary" href="/profile">
            Set Up Profile
          </Link>
        </div>
      </section>

      <section className="hero-panel">
        <div className="stack-card">
          <span>Queues</span>
          <strong>Job Scraping Queue</strong>
          <p>Normalizes discovery results into structured jobs using TinyFish.</p>
        </div>
        <div className="stack-card">
          <span>Reasoning</span>
          <strong>Application Queue</strong>
          <p>Classifies fields, drafts answers, fills the form, and pauses for approval.</p>
        </div>
        <div className="stack-card">
          <span>Oversight</span>
          <strong>Human Approval</strong>
          <p>The final confirmation screen remains under user control before submission.</p>
        </div>
      </section>
    </main>
  );
}
