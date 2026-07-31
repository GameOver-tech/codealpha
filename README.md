# HireLens AI — Backend

AI-powered talent evaluation platform backend. Analyzes interview recordings
(audio/video) and automatically generates detailed candidate evaluation
reports, scores, hiring recommendations, and professional PDF reports.

**Tech stack:** Python 3.13 · FastAPI · SQLAlchemy 2.0 (async) · Alembic ·
Supabase (Auth/PostgreSQL/Storage) · Deepgram (speech-to-text) · OpenRouter /
Gemini / Groq (LLM evaluation) · ReportLab (PDF) · Redis (optional queue)

---

## Roles

The platform has exactly **two** roles:

| Role | Permissions |
|---|---|
| **Candidate** | Register, login, logout, view/edit profile, upload profile picture, change password, **view only** interview status and generated result (scores, recommendation, summary, strengths/weaknesses, PDF). Candidates can never upload recordings or trigger processing. |
| **Admin** | Everything. Upload interview recordings (MP4, MOV, AVI, MKV, MP3, WAV, M4A, FLAC, AAC), trigger processing, regenerate results from a stored transcript, view all analysis, override the recommendation, delete interviews. |

---

## How the processing pipeline works

Uploading a recording (admin-only) automatically starts the pipeline in the
background. Status flow:

```
Uploaded → Processing → Transcript Ready → AI Evaluation → PDF Generated → Completed
```

1. **Store file** — local disk, optionally synced to Supabase Storage.
2. **Speech-to-text** — Deepgram (`nova-3`, utterances, diarization,
   smart format). Produces a timestamped, speaker-annotated transcript.
3. **Speech analysis** — WPM, pauses, speaking rate, confidence, tone,
   emotion, clarity, fluency, energy (computed from segment timing).
4. **Sentiment analysis** — positive/neutral/negative, emotion, confidence,
   professionalism (lexicon-based, deterministic).
5. **LLM evaluation** — OpenRouter, Gemini, or Groq (configure via
   `LLM_PROVIDER`). Covers 16 evaluation dimensions.
6. **Automated scoring** — 10 dimensions + overall, each 0-100.
7. **Strengths** — 3-5 grounded bullets.
8. **Weaknesses** — 3-5 grounded bullets.
9. **Hiring recommendation** — exactly one of `Recommended`,
   `Not Recommended`, `Need Further Review`.
10. **Professional summary** — executive summary, per-dimension assessments,
    improvement suggestions.
11. **PDF generation** — branded, ATS-readable corporate report with the
    final score table and a color-coded recommendation badge.

The pipeline is **resumable**: if a transcript already exists, re-processing
regenerates the evaluation from the transcript without re-transcribing.

### Background processing

- Default: FastAPI `BackgroundTasks` (in-process, `USE_REDIS_QUEUE=false`).
- Optional: Redis queue + dedicated worker for multi-process deployments.
  Set `USE_REDIS_QUEUE=true` and run the worker service:
  `docker compose --profile queue up worker`.

---

## Prerequisites

- Python 3.13+
- A [Supabase](https://supabase.com) project (free tier works)
- Deepgram API key (transcription)
- OpenRouter, Gemini, or Groq API key (evaluation)
- `pip` (Python package manager)

---

## Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory and fill in values:

```bash
cp backend/.env.example backend/.env
```

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (server-side admin access) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase project settings |
| `DATABASE_URL` | Supabase PostgreSQL connection string (`postgresql+asyncpg://…`) |
| `DEEPGRAM_API_KEY` | Deepgram API key for speech-to-text |
| `LLM_PROVIDER` | `openrouter` \| `gemini` \| `groq` |
| `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` | Key for the configured provider |
| `STORAGE_BUCKET` | Supabase Storage bucket (default `interview-recordings`) |
| `USE_MOCK_AI` | `true` to use deterministic mock transcripts/evaluations (no API keys) |
| `USE_REDIS_QUEUE` | `true` to dispatch processing through the Redis worker |
| `SCORE_THRESHOLD_RECOMMENDED` | Score ≥ this → `Recommended` (default 75) |
| `SCORE_THRESHOLD_NEEDS_REVIEW` | Score ≥ this → `Need Further Review` (default 50) |

**Mock mode:** `USE_MOCK_AI=true` (or missing API keys) makes the pipeline
return realistic transcripts and evaluations — perfect for demos and local
testing. No external API is called.

---

## Database migrations

The schema (14 tables) is managed with Alembic. Apply migrations against
your Supabase PostgreSQL:

```bash
cd backend
alembic upgrade head
```

The initial migration creates all tables: `users`, `candidate_profiles`,
`interviews`, `interview_files`, `transcripts`, `speech_analysis`,
`sentiment_analysis`, `technical_evaluation`, `interview_scores`, `strengths`,
`weaknesses`, `recommendations`, `interview_reports`, `generated_pdfs`,
`activity_logs`.

---

## Seed the Admin Account

Run the seed script once to create the admin user:

```bash
cd backend
pip install -r requirements.txt
python ../seed_admin.py
```

This creates a user in `auth.users` with email `admin@gmail.com` /
password `12345678` and a legacy `profiles` row with `role = 'admin'`.
The script is idempotent.

---

## Running the Server

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs` · ReDoc: `http://localhost:8000/redoc`.

### Docker Compose

```bash
cd backend
docker compose up --build            # API + Redis (background-tasks mode)
docker compose --profile queue up    # + Redis queue worker
```

---

## API Endpoints

### Auth (public)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a candidate (first/last name, email, password, phone, gender) |
| POST | `/api/auth/login` | Login, returns bearer token |
| POST | `/api/auth/logout` | Logout (auth) |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/me/password` | Change password |

### Candidate (own data only)

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | View profile |
| PUT | `/api/profile` | Edit profile (experience, skills, education, current company, expected salary) |
| POST | `/api/profile/picture` | Upload profile picture (JPEG/PNG/WebP ≤ 5MB) |
| GET | `/api/interview/status` | Interview status + recommendation |
| GET | `/api/interview/result` | Full generated result (scores, summary, strengths/weaknesses, PDF meta) |
| GET | `/api/interview/result/pdf` | Download the final PDF report |

### Admin (upload/process/view)

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/upload` | Upload recording (video/audio), starts pipeline automatically |
| POST | `/api/admin/process` | Process an uploaded/failed interview |
| GET | `/api/admin/transcript?interview_id=` | Timestamped transcript |
| GET | `/api/admin/analysis?interview_id=` | Full analysis bundle |
| GET | `/api/admin/scores?interview_id=` | 0-100 scores per dimension |
| GET | `/api/admin/recommendation?interview_id=` | Recommendation + candidate message |
| GET | `/api/admin/report?interview_id=` | Full professional report |
| GET | `/api/admin/report/pdf?interview_id=` | Download the PDF |
| GET | `/api/admin/interviews` | List all interviews |
| POST | `/api/admin/regenerate` | Regenerate result from stored transcript |
| POST | `/api/admin/status/recommendation/not-recommendation` | Override recommendation (admin review) |
| DELETE | `/api/admin/interview/{id}` | Delete interview + artifacts |

### Jobs (public list, admin create)

| Method | Path | Description |
|---|---|---|
| GET | `/api/jobs` | List active jobs (public) |
| POST | `/api/jobs` | Create job (admin) |

---

## Security

- **JWT verification** against Supabase Auth (JWKS ES256 for new projects,
  HS256 fallback with `SUPABASE_JWT_SECRET`).
- **Role-based access** — `require_role("admin")` guards all admin endpoints;
  candidates only access their own interviews.
- **Secure uploads** — extension + MIME whitelist, size cap (200MB),
  path-traversal-safe storage.
- **Rate limiting** — sliding window per IP (in-process or Redis-backed).
- **Input validation** — Pydantic v2 schemas on every boundary.
- **No secrets in code** — all config via environment variables.
- **CORS** — configurable allowed origins.
- **SQL injection protection** — SQLAlchemy ORM + parameterized queries only.
- **Logging** — structured console logging; sensitive data is never logged.

---

## Error Response Format

All errors follow the same shape:

```json
{ "detail": "Human-readable error message" }
```

HTTP status codes used: `400` validation/business error · `401` missing/
invalid token · `403` wrong role · `404` not found · `409` conflict ·
`422` malformed input · `429` rate limited · `502` upstream API failure.

---

## Project Structure

```
backend/
  app/
    main.py                  # FastAPI entry point
    worker.py                # Optional Redis queue worker (python -m app.worker)
    core/                    # config, database, security, logging, supabase client
    dependencies/auth.py     # JWT verification + role-based access
    middleware/rate_limit.py # sliding-window rate limiter
    models/                  # SQLAlchemy models (14 tables)
    schemas/                 # Pydantic request/response schemas
    repositories/            # data-access layer (repository pattern)
    services/
      pipeline_service.py    # 11-stage evaluation orchestration
      pdf_service.py         # professional PDF generation
      pdf_download.py        # PDF retrieval for clients
    ai/
      deepgram.py            # speech-to-text
      speech_analysis.py     # prosody metrics
      sentiment_analysis.py  # sentiment classification
      evaluation.py          # LLM evaluation prompt + parsing
      providers.py           # OpenRouter / Gemini / Groq / Mock
    storage/                 # local + Supabase Storage abstraction
    routers/                 # auth, profile, interviews, admin, jobs, health
    utils/                   # exceptions, file validation, parsing, messages
  migrations/                # Alembic migrations
  tests/
  Dockerfile
  docker-compose.yml
  requirements.txt
```
