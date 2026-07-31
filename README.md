# HireLens AI — Backend

AI-powered talent evaluation platform backend. Analyzes interview recordings (audio/video) and generates detailed candidate evaluation reports.

**Tech stack:** FastAPI + Supabase (Auth/DB/Storage) + OpenAI Whisper API + Claude API (Anthropic)

---

## Prerequisites

- Python 3.11+
- A [Supabase](https://supabase.com) project (free tier works)
- OpenAI API key (for Whisper transcription)
- Anthropic API key (for Claude evaluation)
- `pip` (Python package manager)

---

## Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) and create a new project.

2. Once created, go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

3. Go to **Project Settings → API** → scroll to **JWT Settings** and copy:
   - **JWT Secret** → `SUPABASE_JWT_SECRET`

4. Create a storage bucket:
   - Go to **Storage** → **New Bucket**
   - Name: `interview-recordings`
   - Type: **Private**

---

## Running the SQL Schema

1. Go to **SQL Editor** in your Supabase dashboard.
2. Open `supabase/schema.sql` from this repo.
3. Paste the entire contents and click **Run**.
4. Verify all 6 tables (`profiles`, `jobs`, `candidates`, `interviews`, `transcripts`, `evaluations`) appear under **Table Editor**.

---

## Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Required variables:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (admin access, never expose to frontend) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase project settings |

Optional/with defaults:

| Variable | Default | Description |
|---|---|---|
| `STORAGE_BUCKET` | `interview-recordings` | Supabase Storage bucket name |
| `WHISPER_API_KEY` | (empty) | OpenAI API key for Whisper |
| `CLAUDE_API_KEY` | (empty) | Anthropic API key for Claude |
| `USE_MOCK_AI` | `false` | Set to `true` to skip real APIs |
| `SCORE_THRESHOLD_RECOMMENDED` | `75` | Score ≥ this → "Recommended" |
| `SCORE_THRESHOLD_NEEDS_REVIEW` | `50` | Score ≥ this → "Needs Further Review" |

**Mock mode:** If `USE_MOCK_AI=true` or either `WHISPER_API_KEY`/`CLAUDE_API_KEY` is missing, the services return realistic hardcoded responses — perfect for demos.

---

## Seed the Admin Account

Run the seed script once to create the admin user:

```bash
cd backend
pip install -r requirements.txt
python ../seed_admin.py
```

This creates:
- A user in `auth.users` with email `admin@gmail.com` / password `12345678`
- A row in `profiles` with `role = 'admin'`

The script is **idempotent** — run it multiple times safely.

---

## Running the Server

```bash
cd backend
uvicorn app.main:app --reload
```

The API is now available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

---

## API Endpoints

### 1. Health Check

```bash
curl http://localhost:8000/api/health
```

Response: `{"status": "ok", "service": "HireLens AI Backend"}`

---

### 2. List Active Jobs (Public)

```bash
curl http://localhost:8000/api/jobs
```

---

### 3. Create Job (Admin Only)

```bash
curl -X POST http://localhost:8000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{"title": "Senior Python Developer", "description": "Build backend services using Python and FastAPI..."}'
```

---

### 4. Upload Interview Recording (Candidate Only)

```bash
curl -X POST http://localhost:8000/api/interviews/upload \
  -H "Authorization: Bearer <CANDIDATE_JWT>" \
  -F "file=@/path/to/interview.mp4" \
  -F "job_id=<JOB_UUID>"
```

Returns: `{"interview_id": "...", "status": "uploaded"}`

Supported file types: `mp3`, `wav`, `mp4`, `webm`, `m4a`. Max size: 200MB.

---

### 5. Process Interview (Candidate Only — must own the interview)

```bash
curl -X POST http://localhost:8000/api/interviews/<INTERVIEW_ID>/process \
  -H "Authorization: Bearer <CANDIDATE_JWT>"
```

Returns immediately with 202 Accepted. The transcription + evaluation pipeline runs in the background.
Poll the GET endpoint to check completion status.

---

### 6. Get Interview Details

**Candidate** (own interviews only):
```bash
curl http://localhost:8000/api/interviews/<INTERVIEW_ID> \
  -H "Authorization: Bearer <CANDIDATE_JWT>"
```

**Admin** (any interview):
```bash
curl http://localhost:8000/api/interviews/<INTERVIEW_ID> \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

---

### 7. List All Candidates (Admin Only)

```bash
curl http://localhost:8000/api/admin/candidates \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Returns a summary list with latest interview status and evaluation scores.

---

### 8. Get Candidate Detail (Admin Only)

```bash
curl http://localhost:8000/api/admin/candidates/<CANDIDATE_ID> \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Returns full detail: job info, transcript, full evaluation breakdown, and a signed recording URL (expires in 1 hour).

---

## Testing with JWTs

Since Supabase handles auth, you need real JWTs for protected endpoints.

### Getting a Candidate JWT

Use Supabase's `signInWithOAuth` in your frontend (Google sign-in), or for testing you can use the Supabase `anon` key via the REST API:

```bash
# Sign in with email/password (if candidate is pre-created)
curl -X POST https://<your-project>.supabase.co/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -d '{"email": "candidate@example.com", "password": "candidate-password"}'
```

The response includes an `access_token` — use that as the Bearer token.

### Getting an Admin JWT

```bash
curl -X POST https://<your-project>.supabase.co/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -d '{"email": "admin@gmail.com", "password": "12345678"}'
```

Use the `access_token` from the response.

---

## Testing with Mock Mode

Set `USE_MOCK_AI=true` in `.env` — no API keys needed:

1. Start the server
2. Upload a dummy audio/video file (any supported format)
3. Hit the process endpoint
4. Poll `GET /api/interviews/<ID>` — after a few seconds, status will be `completed` with the mock evaluation

The mock responses include a realistic interview transcript and a full evaluation with scores, strengths, weaknesses, and summary.

---

## Project Structure

```
backend/
  app/
    main.py                  # FastAPI app entry point
    core/
      config.py              # Settings from .env
      supabase_client.py     # Supabase clients (anon + service_role)
      security.py            # JWT verification
    dependencies/
      auth.py                # get_current_user(), require_role()
    routers/
      health.py              # GET /api/health
      jobs.py                # GET/POST /api/jobs
      interviews.py          # POST upload/process, GET interview
      admin.py               # GET admin/candidates, admin/candidates/{id}
    services/
      transcription_service.py   # Whisper API + mock
      evaluation_service.py      # Claude API + mock
      storage_service.py         # Supabase Storage ops
    models/
      schemas.py             # Pydantic request/response models
  requirements.txt
  seed_admin.py              # Idempotent admin seed script
supabase/
  schema.sql                 # Full DDL + RLS policies
.env.example                 # Environment variable template
README.md
```

---

## Error Response Format

All errors follow the same shape:

```json
{
  "detail": "Human-readable error message"
}
```

HTTP status codes used:
- `401` — No token or invalid/expired token
- `403` — Wrong role (candidate accessing admin endpoint, etc.)
- `404` — Resource not found
- `422` — Validation error (bad file type, missing fields)
- `500` — Internal server error
