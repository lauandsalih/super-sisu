# Aalto Academic Planner

Web app for planning and tracking Aalto studies with course search, course details, degree progress, and profile-based transcript import.

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + Express + TypeScript
- Database/Auth/Storage: Supabase

## Project Structure

- `frontend/` - UI app deployed to Vercel as static build output
- `backend/` - Express API for transcript grade extraction and user-course endpoints

## Features

- Home page with navigation cards
- Course search with filters
- Course detail view with reviews/grades/exam info links
- Academic tracker with progress and GPA visuals
- Profile page with transcript PDF upload and grade extraction

## Local Development

### 1) Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2) Configure environment variables

Create `frontend/.env`:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_KEY=your_supabase_anon_key
# Optional for production-like local testing
VITE_API_BASE_URL=http://localhost:3000
```

Create `backend/.env`:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_or_server_key
KORI_API_KEY=optional_kori_api_key
PORT=3000
```

### 3) Run locally

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Frontend dev server proxies `/api/*` to `http://localhost:3000`.

## Deploy Frontend to Vercel

This repository is configured for root-level Vercel deployment with `vercel.json`.

### Required Vercel env vars

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`
- `VITE_API_BASE_URL` (backend API base URL, no trailing slash)

### Deploy commands

From repo root:

```bash
npm run vercel:build     # local validation build
npm run vercel:preview   # preview deployment
npm run vercel:prod      # production deployment
```

If not linked yet:

```bash
vercel link
```

## Deploy Backend API

Deploy `backend/` to a Node host (Railway/Render/Fly/etc).

- Build: `npm run build`
- Start: `npm start`
- Ensure backend env vars are set (`SUPABASE_URL`, `SUPABASE_KEY`, optional `KORI_API_KEY`)

After backend is live, set `VITE_API_BASE_URL` in Vercel to your backend origin and redeploy frontend.

## API endpoints used by frontend profile

- `POST /api/extract-grades` - parse transcript PDF and upsert user grades
- `GET /api/user-courses/:userId` - fetch user courses via backend

## Notes

- `.vercel` is ignored by git.
- `VITE_*` variables are injected at build time, so any env change requires a new frontend deployment.
