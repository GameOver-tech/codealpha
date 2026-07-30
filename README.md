# HireLens AI

AI-powered talent evaluation platform. Candidates submit interview recordings, and the system transcribes, analyzes, and generates scored evaluation reports using multiple AI providers.

## Tech Stack

- **Frontend:** React (Vite), Tailwind CSS v4, React Router, Recharts
- **Backend:** Python, FastAPI
- **Database & Auth:** Supabase (Postgres, Auth, Storage)
- **AI Providers:** Deepgram (STT), Groq (transcript refinement), OpenRouter + Gemini (evaluation cross-check)

## Project Structure

```
Hirelens-AI/
├── frontend/          # React SPA
│   ├── src/
│   │   ├── components/   # Shared UI atoms, layouts
│   │   ├── pages/        # 9 screens matching mockup
│   │   ├── contexts/     # AuthContext
│   │   ├── hooks/        # useInterviewStatus
│   │   ├── lib/          # supabase client, api wrapper
│   │   └── types/        # TypeScript types
│   ├── .env.local.example
│   └── .env.local        # (create from example)
│
├── backend/           # FastAPI server
│   ├── app/
│   │   ├── routers/      # auth, jobs, interviews, admin
│   │   ├── services/     # AI providers, supabase, processor
│   │   ├── middleware/   # JWT verification + role checks
│   │   ├── models/       # Pydantic schemas
│   │   └── db/migrations/  # SQL migration files
│   ├── seed_admin.py     # Creates admin account
│   ├── .env.example
│   └── .env              # (create from example)
│
└── README.md
```

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.12+
- ffmpeg (for video-to-audio conversion)
- A Supabase project

### 1. Clone and Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
pip install -r requirements.txt
```

### 2. Environment Variables

**Backend** — copy `.env.example` to `.env` and fill in your keys:

```bash
cd backend
cp .env.example .env
```

Required variables:
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (for admin operations) |
| `DEEPGRAM_API_KEY` | Deepgram API key |
| `GROQ_API_KEY` | Groq API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `GEMINI_API_KEY` | Google Gemini API key |

**Frontend** — copy `.env.local.example` to `.env.local`:

```bash
cd frontend
cp .env.local.example .env.local
```

Required variables:
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_API_BASE` | Backend URL (default: `http://localhost:8000/api/v1`) |

### 3. Supabase Project Setup

#### Run Database Migrations

1. Go to your Supabase Dashboard → **SQL Editor**
2. Open `backend/app/db/migrations/000_run_all.sql`
3. Copy the contents and paste into a new query
4. Click **Run**

This creates all tables (profiles, candidates, jobs, interviews, transcripts, evaluations), enables Row Level Security, seeds sample jobs, and creates the storage bucket.

#### Enable Google OAuth

1. **Google Cloud Console:**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a project or select existing
   - Go to **APIs & Services** → **Credentials**
   - Create an **OAuth 2.0 Client ID** (Web application)
   - Add authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Note the Client ID and Client Secret

2. **Supabase Dashboard:**
   - Go to **Authentication** → **Providers**
   - Click **Google**
   - Toggle **Enabled**
   - Paste the Client ID and Client Secret from Google Cloud Console
   - Save

3. **Supabase Auth Settings:**
   - Go to **Authentication** → **Settings**
   - Set **Site URL** to `http://localhost:5173` (for local dev)
   - Add `http://localhost:5173/**` to **Redirect URLs**

### 4. Seed Admin User

```bash
cd backend
python seed_admin.py
```

This creates the admin account:
- **Email:** `admin@gmail.com`
- **Password:** `12345678`

### 5. Start the Application

**Backend** (terminal 1):
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Frontend** (terminal 2):
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Auth Flow

### Admin (Recruiter)
1. Navigate to `/admin/login`
2. Enter `admin@gmail.com` / `12345678`
3. Lands on admin dashboard with candidate list

### Candidate
1. Click "Start Interview" on landing page
2. Select a job → redirected to Google sign-in
3. Sign in with Google (first time auto-creates profile)
4. Upload interview recording
5. Processing page shows real-time progress
6. Confirmation screen after completion

### Security (Two-Layer Enforcement)
- **Frontend:** Protected routes redirect unauthenticated users to Google sign-in
- **Backend:** Every upload/interview endpoint verifies the Supabase JWT and checks `role = 'candidate'` before processing

## Processing Pipeline

```
Upload → [stored in Supabase Storage]
  → Transcribing: video→audio (ffmpeg) → Deepgram STT
  → Analyzing: Groq refines transcript → OpenRouter + Gemini parallel evaluation
  → Completed: reconciled evaluation saved to database
```

OpenRouter and Gemini outputs are reconciled:
- Scores are averaged (warn if >15 point gap)
- Recommendation: use if both agree, else "Need Further Review"
- Strengths/weaknesses/evidence are merged and deduplicated

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/session` | JWT | Validate token, return role |
| POST | `/api/v1/auth/admin-login` | None | Email/password login |
| GET | `/api/v1/jobs` | None | List active jobs |
| GET | `/api/v1/jobs/{id}` | None | Single job detail |
| POST | `/api/v1/interviews/upload` | Candidate | Upload file, start processing |
| GET | `/api/v1/interviews/{id}/status` | Candidate | Poll processing status |
| GET | `/api/v1/admin/candidates` | Admin | List candidates (searchable) |
| GET | `/api/v1/admin/candidates/{id}` | Admin | Full candidate report |
| GET | `/api/v1/admin/jobs` | Admin | List jobs for filter |

## Screens

1. **Landing** — Hero, preview score card, "How it Works" steps
2. **Google Gate** — Sign-in with Google prompt (for unauthenticated users)
3. **Interview Intro** — Job details, expectations, "Begin Interview"
4. **Upload/Record** — File upload with drag-drop, recording placeholder
5. **Processing** — Live progress tracking, checklist animation
6. **Confirmation** — Success state after submission
7. **Admin Login** — Split layout, email/password form
8. **Candidate Table** — Searchable, filterable, paginated table
9. **Candidate Report** — Score ring, radar chart, transcript, evidence
