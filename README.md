# Goal Setting & Tracking Portal

Built for AtomQuest Hackathon 1.0 by Atomberg Technologies.

A web-based portal for creating, approving, and tracking employee goals across quarterly cycles. Supports three role-based personas with locked workflows, audit trails, and exportable reports.

## Live Demo

goal-portal.vercel.app

## Demo Credentials

The login page has a built-in persona switcher — click any role to enter that user's journey.

| Role | Name | Capabilities |
|---|---|---|
| Admin / HR | Anita Sharma | Manage cycle windows, view all goal sheets, unlock locked sheets, export CSV, view audit log |
| Manager (L1) | Rohit Verma | Approve or return team goal sheets, quarterly check-ins with comments |
| Employee | Priya Patel | Create goal sheet, submit for approval, quarterly progress updates |

## Features

### Phase 1 — Goal Creation & Approval
- Goal sheet creation with Thrust Area, Title, Description, UoM, Target, Weightage
- Live weightage validator with visual progress bar
- Hard validation: maximum 8 goals, minimum 10% per goal, total weightage must equal 100%
- Manager approval workflow with return-for-rework option
- On approval, sheet status changes to locked — only Admin can unlock

### Phase 2 — Achievement Tracking
- Quarterly tabs for Q1, Q2, Q3, Q4
- Auto-computed progress score per Unit of Measurement type
- Status: Not Started, On Track, Completed
- Manager check-in view with comment box per goal
- Employee sees manager comments inline

### Admin Module
- Cycle management with toggleable windows for each quarter
- Live completion dashboard showing approval rate
- Audit log of all post-lock changes
- CSV export of Planned vs Achievement report
- Goal sheet unlock capability

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js 16 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| CSV export | PapaParse |
| Icons | Lucide React |

## Architecture

Browser (Next.js client) communicates with Next.js server-side functions on Vercel, which talk to Supabase Postgres over its REST API.

Database tables:
- users — role, manager mapping, department
- cycles — yearly cycle with quarterly window toggles
- goal_sheets — one per employee per cycle, tracks status
- goals — individual goals belonging to a sheet
- achievements — quarterly actuals per goal
- goal_audit — change log for post-lock edits

## Cost Optimisation

- Vercel free tier handles hosting and serverless functions, scales to zero when idle
- Supabase free tier covers the database and authentication
- Total hosting cost: zero rupees per month for a working portal
- No always-on backend server to maintain
- Minimal database queries per page load using Postgres joins through Supabase

## Local Setup

git clone https://github.com/adityaamann/goal-portal.git
cd atomberg-goal-portal
npm install

Create a .env.local file with:

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

Run the development server:

npm run dev

## Submission

- Live demo: see URL above
- Repository: this GitHub repo
- Architecture diagram: architecture.png in the repo root
- Login: persona switcher on the homepage, no password needed