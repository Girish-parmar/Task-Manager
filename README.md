# Task-Manager

A unified workspace for internal employees and external contractors: create tasks, auto-allocate them to the best-fit available worker, chain tasks into branches that unlock as each step completes, and see everything sync live across a Kanban board with a full audit trail.

## Stack

- **Frontend**: Next.js (App Router) + TypeScript, Tailwind CSS, Zustand, Socket.io client
- **Backend**: Node.js + Express + TypeScript, JWT auth, Socket.io
- **Database**: PostgreSQL via Prisma

## Features

- **Auto-allocation engine** — matches pending tasks to workers by required tags, location, and available capacity, with best-fit/load-balancing tie-breaking (with a manual-assign fallback for admins/managers)
- **Branching tasks** — completing a task can automatically unlock and try to allocate the next task in its chain
- **Immutable audit trail** — every allocation, assignment, and completion is recorded transactionally alongside the state change it describes
- **Real-time Kanban board** — drag tasks between Pending / Active / Completed; changes sync live to every connected client via Socket.io
- **Role-based access** — `ADMIN` / `MANAGER` / `MEMBER` worker roles, with `INTERNAL` / `EXTERNAL` worker types

## Getting started

Requires Node 20+ and a local PostgreSQL instance.

```bash
# 1. Start Postgres, then create the databases
createdb task_manager
createdb task_manager_test

# 2. Configure environment
cp backend/.env.example backend/.env        # fill in DATABASE_URL / JWT_SECRET
cp frontend/.env.example frontend/.env.local

# 3. Install, migrate, seed
npm install
npm run db:migrate
npm run db:seed

# 4. Run both apps
npm run dev
```

Frontend: http://localhost:3000 · Backend: http://localhost:4000

Seeded accounts (see `backend/prisma/seed.ts`) all use password `password123`, e.g. `admin@taskmanager.dev` (ADMIN) or `bob@taskmanager.dev` (MEMBER).

## Scripts

See [CLAUDE.md](./CLAUDE.md) for the full command reference and an architecture overview.
