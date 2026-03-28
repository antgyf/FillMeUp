# FillMeUp

FormPilot is a full-stack, agentic job application automation system built with Next.js. It collects candidate profile data, authenticates a LinkedIn session for discovery, pushes jobs through two mandatory queues, uses TinyFish for browser automation tasks, uses OpenAI for reasoning tasks, and pauses on a human approval screen before the final submit action.

## What it includes

- User dashboard with queue visibility and pipeline analytics
- Profile setup with PDF resume upload and structured profile parsing
- Job preferences page for roles, industries, locations, salary, and keywords
- LinkedIn login flow that establishes a session for discovery
- Job discovery pipeline that scrapes LinkedIn jobs and feeds a job scraping queue
- Job scraping queue that normalizes listing data and hands off to the application queue
- Application queue that extracts fields, classifies them, generates answers, fills the form, and pauses for approval
- Review screen where every generated answer can be edited before submission
- File-backed local state for a runnable MVP without external databases

## Architecture

### Frontend

- Next.js App Router
- Pages:
  - `/dashboard`
  - `/profile`
  - `/preferences`
  - `/queue`
  - `/review/[applicationId]`

### Backend

- Next.js route handlers under `app/api`
- File-backed state store in `lib/store.ts`
- Queue orchestration in `lib/queue-manager.ts`

### Agent pipelines

1. Profile intake
   - Save candidate identity, skills, notes, and resume PDF
   - Parse structured profile JSON with OpenAI when `OPENAI_API_KEY` is configured
2. Job discovery
   - Authenticate LinkedIn through the TinyFish-owned session flow
   - Scrape LinkedIn jobs using the authenticated session plus saved preferences
   - Rank relevance with OpenAI or a local heuristic fallback
   - Push jobs into the job scraping queue
3. Job scraping queue
   - Use TinyFish to extract job description and application URL
   - Normalize into a structured `JobRecord`
   - Push the job into the application queue
4. Application queue
   - Use TinyFish to inspect the application page and extract the field schema
   - Use OpenAI to classify field intent and generate answers
   - Use TinyFish to fill the form and stop at the confirmation screen
   - Persist a review summary and wait for approval
5. Human approval
   - User edits any answer in the review UI
   - On approval, TinyFish executes the final submit action

## Environment variables

Create a `.env.local` file:

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5
TINYFISH_API_KEY=your_tinyfish_key
LINKEDIN_EMAIL=your_linkedin_email
LINKEDIN_PASSWORD=your_linkedin_password
# Optional:
TINYFISH_MODE=mock
TINYFISH_ASYNC_TIMEOUT_MS=300000
TINYFISH_ASYNC_POLL_INTERVAL_MS=3000
```

If `OPENAI_API_KEY` or `TINYFISH_API_KEY` is missing, FormPilot still runs in a local demo mode with clear mock fallbacks.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes on production hardening

- The queues are implemented in-process and can be replaced with BullMQ plus Redis later.
- File-backed state is used instead of a database for easy demo setup.
- TinyFish and OpenAI both support mock mode so the full UX remains testable without paid credentials.
