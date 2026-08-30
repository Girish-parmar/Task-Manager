# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Task Manager is a "Unified Workspace" task allocation and tracking app for internal employees and external contractors. It auto-matches pending tasks to the best-fit worker by skill tags, location, and available capacity; supports chained/branching tasks (completing one unlocks the next); and keeps an immutable, transactionally-consistent audit trail of every allocation and completion.

Stack: **Next.js (App Router) + TypeScript** frontend, **Node/Express + TypeScript** backend, **MySQL via Prisma** database, **Socket.io** for real-time sync. npm workspaces tie `backend/` and `frontend/` together under the root `package.json`.

MySQL (not Postgres) specifically because this app deploys to Hostinger Business shared hosting, whose managed database offering is MySQL/MariaDB only — no managed Postgres option exists on that plan.

## Commands

Run from the repo root unless noted. MySQL/MariaDB must be running locally first (`service mariadb start` — there is no docker-compose setup in this repo).

```bash
npm install                # installs both workspaces
npm run dev                 # runs backend (:4000) and frontend (:3000) concurrently
npm run build                # builds both workspaces
npm run lint                 # lints both workspaces
npm run test                  # runs the backend Jest/Supertest suite

npm run db:migrate            # prisma migrate dev (backend)
npm run db:migrate:ci          # prisma migrate deploy (backend, no prompts)
npm run db:seed                 # seeds workers/tasks, incl. a branch chain (backend)
npm run db:generate              # regenerate Prisma client after schema.prisma changes
```

Backend-only, from `backend/`:

```bash
npm run dev                  # tsx watch src/server.ts
npm run build                 # tsc -p tsconfig.build.json -> dist/
npm test                       # jest --runInBand, all suites
npx jest tests/unit/allocationService.test.ts   # single test file
npx jest -t "breaks ties by smallest slack"       # single test by name
```

Frontend-only, from `frontend/`: standard `next dev` / `next build` / `next lint`.

Environment files: copy `backend/.env.example` -> `backend/.env` (and `.env.test` pointing at a separate `task_manager_test` database — tests truncate all tables before each suite run) and `frontend/.env.example` -> `frontend/.env.local`.

## Architecture

### Backend (`backend/src/`)

Layering: `routes/` -> `controllers/` -> `services/` (business logic) -> Prisma (`config/prismaClient.ts`). All `/api/*` routes except `/api/auth/signup|login` require the `authenticate` middleware (`middlewares/auth.ts`), which reads a JWT from an **httpOnly cookie** (not a bearer header) and attaches `req.user`. `authorize(...roles)` gates role-restricted routes (e.g. worker `PATCH`, the unfiltered audit log).

**Audit trail pattern**: there is no generic `res.json` interceptor. Instead, every state-changing service function that mutates a `Task` performs its DB writes and the corresponding `AuditLog.create` together inside one `prisma.$transaction([...])`, so the audit row and the state change always commit atomically or not at all. `middlewares/auditContext.ts` just attaches a typed `req.audit()` helper for controllers to build the entry payload inline with the business logic that produces it — follow this pattern (transaction, not a post-hoc hook) for any new task-state-changing endpoint. `AuditLog.taskId` is a required FK, so this pattern only covers task-scoped changes; plain worker-profile edits (`workerController.updateWorker`) are intentionally not audited this way — auditing them would need a schema change (nullable `taskId` or a separate log model) and is out of scope for now.

**Auto-allocation engine** (`services/allocationService.ts`, `allocateWorkerForTask`): filters workers by "has every required tag" (an `AND` of per-tag `tags: { some: { tag } } }` relation filters — see the Database section below for why this isn't a single `hasEvery`) + `availableCapacity >= durationDays` + location match (skipped if the task has no location), then tie-breaks by smallest slack (`availableCapacity - durationDays`, best-fit) -> fewest current `ACTIVE` tasks (load balancing) -> worker id (deterministic). No eligible worker throws `NoEligibleWorkerError` (-> HTTP 422) after writing an `AUTO_ALLOCATION_FAILED` audit row, with zero mutation. `services/taskCompletionService.ts` (`completeTaskBranch`) drives the "Smart Node" complete flow: marks the task `COMPLETED`, and if it has a `nextBranchId`, best-effort calls `allocateWorkerForTask` on the next task (leaving it `ACTIVE`/unassigned for manual pickup if no worker qualifies — see `assignWorkerManually` for the manual fallback used by the frontend's "Assign manually" action).

**Errors**: throw one of the typed errors in `errors/AppError.ts` (or `NoEligibleWorkerError`) from services/controllers; `middlewares/errorHandler.ts` maps them to the right HTTP status. Route handlers are wrapped in `asyncHandler` so thrown/rejected errors reach it without manual `try/catch` in every controller.

**Sockets** (`sockets/`): the Socket.io handshake is authenticated with the same JWT cookie (`sockets/index.ts`); `sockets/taskEvents.ts` exposes `emitTaskUpdated`/`emitTaskAssigned`/`emitBranchCompleted`, called by controllers *after* their transaction commits, broadcasting to the `"workspace"` room.

### Database (`backend/prisma/schema.prisma`)

Five models: `Worker` (unified internal/external, with `role: ADMIN|MANAGER|MEMBER` for RBAC), `Task` (self-referential `nextBranchId` — a unique FK to another `Task`, forming the branch chain as a singly-linked list), `AuditLog` (FKs to both `Task` and the performing `Worker`), plus two join tables: `WorkerTag` (`@@id([workerId, tag])`) and `TaskRequiredTag` (`@@id([taskId, tag])`). MySQL has no native array/`text[]` type, so `Worker.tags`/`Task.requiredTags` are these join tables rather than scalar array columns, both `onDelete: Cascade` so deleting a worker/task cleans up its tag rows automatically. This means Prisma's `hasEvery`/`hasSome` array operators aren't available — "worker has every required tag" is expressed as an `AND` of per-tag `{ tags: { some: { tag } } }` relation filters (see `allocationService.ts`). Every controller that returns a `Worker` or `Task` to the client must `include` the tag relation and flatten it back to a plain `string[]` before responding (`utils/tags.ts`'s `tagList()`) — the HTTP/socket API contract and the frontend's `Worker.tags`/`Task.requiredTags: string[]` types are unchanged by this; only the DB-layer representation differs. Writing tags is a nested `{ create: tags.map((tag) => ({ tag })) }` on create, or `{ deleteMany: {}, create: [...] }` (full replace) on update. Note `Worker.email`/`passwordHash`/`role` and `Task.location` are additions beyond the original spec, required for auth/RBAC and for the location-matching stage of the allocation algorithm respectively — keep schema and the allocation/RBAC logic in sync if either changes.

### Frontend (`frontend/src/`)

Next.js **App Router**, all interactive pages are Client Components (`"use client"`) — there's no server-side session; the frontend authenticates purely by calling the Express API with `axios` (`lib/api.ts`, `withCredentials: true`) and letting the browser carry the httpOnly cookie. Route groups: `app/(auth)/` (login/signup, redirects to `/tasks` if already authenticated) and `app/(dashboard)/` (auth-gated shell with nav + `<SocketConnector/>`, redirects to `/login` if not authenticated — see `hooks/useCurrentWorker.ts` for the `/auth/me` check both layouts share).

State: **Zustand** (`store/authStore.ts`, `store/taskStore.ts`) — module-level stores, not Context, specifically so `components/SocketConnector.tsx`'s Socket.io event handlers can call `useTaskStore.getState().applyTaskUpdate(...)` directly from outside the render tree. `SocketConnector` connects only once inside the authenticated dashboard layout and disconnects on unmount.

Kanban board (`components/Kanban/`) uses `@dnd-kit`; dragging a card from Pending -> Active triggers `useAllocation().autoAssign`, Active -> Completed triggers `complete` (see `hooks/useAllocation.ts`). The task detail page (`app/(dashboard)/tasks/[taskId]/page.tsx`) is the "Smart Node" view — note `params` is a `Promise` there (Next.js 16 async route params even for Client Component pages; unwrap with React's `use()`), and its audit-trail panel must call `refetchAudit()` after every action or it goes stale (the underlying `GET /audit` list doesn't itself push updates).

Forms use `react-hook-form` + `zodResolver`. Because some schemas use `z.coerce.number()`, `useForm` must be typed with **both** input and output generics (`useForm<FormInput, unknown, FormOutput>` using `z.input<>`/`z.output<>`) — using a single `z.infer<>` type breaks the resolver's type inference; see `signup/page.tsx` or `CreateTaskModal.tsx` for the pattern.

## Conventions / gotchas

- **This repo runs Next.js 16** (React 19.2, Turbopack by default) — this is newer than most training data; when in doubt, check `node_modules/next/dist/docs/` before assuming Next.js 13–15 conventions (e.g. `params`/`searchParams` are Promises everywhere now, `middleware.ts` is deprecated in favor of `proxy.ts`, `next lint` is gone in favor of the ESLint CLI directly).
- **ESLint**: both workspaces use ESLint 9 flat config (`eslint.config.js`/`.mjs`) — kept in sync intentionally, since npm workspace hoisting means a stray legacy `.eslintrc` or mismatched ESLint major version in one workspace breaks resolution for both (this happened once; see git history for `backend/eslint.config.js`). The React Compiler's `react-hooks/set-state-in-effect` rule is intentionally strict about synchronous `setState` in effects; the fetch-on-mount pattern used throughout (`useAudit`, `useTasks`, the task detail page's `loadTask`) needs a targeted `eslint-disable-next-line` — don't restructure those effects to silence it a different way, that's the accepted pattern here.
- **TypeScript project split in `backend/`**: `tsconfig.json` (includes `src` + `tests`, `noEmit`) is what ts-jest/editors use; `tsconfig.build.json` (extends it, `src`-only, sets `outDir`/`rootDir`) is what `npm run build` uses. Don't merge these back into one — `tests/` and `src/` can't share a single `rootDir` when only `src/` should land in `dist/`.
- **Backend auth uses `bcryptjs`**, not `bcrypt` — deliberate, to avoid a native-module build step; same API surface if you ever need to swap it.
- **`assignWorkerManually`** (manual assignment fallback, `POST /api/tasks/:id/assign`, `authorize(ADMIN, MANAGER)`-gated) exists alongside the auto-allocation engine specifically because auto-assign can legitimately find no eligible worker, or a manager wants to override the algorithm's pick — it shares the same capacity-decrement and audit bookkeeping, just skips the matching filter.
- **Concurrency-safe assignment**: both `allocateWorkerForTask` and `assignWorkerManually` re-check their preconditions (task still `PENDING`/unassigned, worker still has enough capacity) as conditional `updateMany` writes *inside* the transaction, not just via the reads earlier in the function — two concurrent requests targeting the same task/worker would otherwise both pass the initial reads and both mutate the row (double-assignment, double capacity decrement). A `count !== 1` from either `updateMany` throws `ConflictError`, rolling back the transaction. Follow this pattern for any new endpoint that conditionally mutates a row read earlier in the same function.
- Per-task audit visibility (`GET /audit?taskId=`) is open to any authenticated worker; the unfiltered org-wide log (no `taskId`) is restricted to `ADMIN`/`MANAGER` in the controller, not the route middleware — see `controllers/auditController.ts`.
