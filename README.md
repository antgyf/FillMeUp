# FormPilot

FormPilot is a full-stack, agentic job application automation system built with Next.js. It collects candidate profile data, simulates LinkedIn discovery, pushes jobs through two mandatory queues, uses TinyFish for browser automation tasks, uses OpenAI for reasoning tasks, and pauses on a human approval screen before the final submit action.

## What it includes

- User dashboard with queue visibility and pipeline analytics
- Profile setup with PDF resume upload and structured profile parsing
- Job preferences page for roles, industries, locations, salary, and keywords
- Job discovery pipeline that feeds a job scraping queue
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

- Next.js route handlers under [`app/api`](/C:/Users/antho/OneDrive/Documents/New%20project/app/api)
- File-backed state store in [`lib/store.ts`](/C:/Users/antho/OneDrive/Documents/New%20project/lib/store.ts)
- Queue orchestration in [`lib/queue-manager.ts`](/C:/Users/antho/OneDrive/Documents/New%20project/lib/queue-manager.ts)

### Agent pipelines

1. Profile intake
   - Save candidate identity, skills, notes, and resume PDF
   - Parse structured profile JSON with OpenAI when `OPENAI_API_KEY` is configured
2. Job discovery
   - Generate a structured LinkedIn-style candidate listing set from preferences
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

## TinyFish integration

TinyFish is wired through [`lib/services/tinyfish-service.ts`](/C:/Users/antho/OneDrive/Documents/New%20project/lib/services/tinyfish-service.ts) and is visible in:

- Job page extraction
- Application field extraction
- Form filling up to the confirmation screen
- Final approved submission

The service is built against TinyFish's documented REST endpoints and authentication header:

- [TinyFish Endpoints](https://docs.tinyfish.ai/key-concepts/endpoints)
- [TinyFish Runs](https://docs.tinyfish.ai/key-concepts/runs)
- [TinyFish Quick Start](https://docs.tinyfish.ai/quick-start)

TinyFish docs indicate REST requests use the `X-API-Key` header, and the platform exposes `/run`, `/run-async`, and `/run-sse` automation endpoints.

## OpenAI integration

OpenAI is wired through [`lib/services/openai-service.ts`](/C:/Users/antho/OneDrive/Documents/New%20project/lib/services/openai-service.ts) for:

- Resume parsing
- Job relevance ranking
- Field understanding
- Contextual answer generation

The service uses the Responses API through the official `openai` JavaScript SDK and falls back to deterministic mock behavior when `OPENAI_API_KEY` is absent.

Relevant docs:

- [Responses API overview](https://platform.openai.com/docs/guides/text?api-mode=responses)
- [Using tools](https://platform.openai.com/docs/guides/tools?api-mode=responses)

## Environment variables

Create a `.env.local` file:

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5
TINYFISH_API_KEY=your_tinyfish_key
# Optional:
TINYFISH_MODE=mock
```

If `OPENAI_API_KEY` or `TINYFISH_API_KEY` is missing, FormPilot still runs in a local demo mode with clear mock fallbacks.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Expected demo flow

1. Go to `/profile` and save a candidate profile with a resume PDF.
2. Go to `/preferences` and save discovery preferences.
3. Go to `/dashboard` and click `Discover LinkedIn Jobs`.
4. Watch the two queues populate in `/queue`.
5. Open an application in `/review/[applicationId]`.
6. Edit answers if needed, then click `Approve and Submit`.

## Notes on production hardening

This MVP keeps the required architecture visible while staying runnable in a blank repo:

- The queues are implemented in-process and can be replaced with BullMQ plus Redis later.
- Discovery currently uses a structured LinkedIn-style catalog instead of live scraping.
- File-backed state is used instead of a database for easy demo setup.
- TinyFish and OpenAI both support mock mode so the full UX remains testable without paid credentials.

## Authors
Anthony Goh
Nicholas Cheok
Wei Yan
