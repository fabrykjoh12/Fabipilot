# Fabipilot

**An AI project cockpit for builders — turn messy ideas into roadmaps, prompt queues, next steps and shipped projects.**

Fabipilot keeps your project context, prompts, repo/live links and daily build tasks in one place, so you stop losing your projects inside chat history. It's a mobile-first, local-first PWA built for people who ship many things with Claude, Codex and other AI tools.

> Fabipilot is a private, single-user product built by one builder, with AI. It's opinionated on purpose: ADHD-friendly, "today"-first, no shame-streaks, dumb-simple over clever.

---

## Who it's for

Indie hackers, students, solo builders and AI-coding users — anyone who has **many projects** and keeps losing track of *what to do next* on each one. If your projects live as scattered browser tabs and half-remembered chat threads, Fabipilot is the cockpit that pulls them back together.

## The core workflow

Fabipilot is built around one default path:

```
Idea  →  Project  →  Roadmap  →  Prompt queue  →  Build task  →  Shipped
```

1. **Capture an idea** in the Idea Bank (or via ⌘K from anywhere).
2. **Promote it to a project** — now it has a home with context, links and a roadmap.
3. **Break it into steps** on a High / Medium / Low board, each step a prompt or a task.
4. **Run the prompt queue** — copy each prompt (with full project context baked in) straight into Claude, one at a time, and paste the result back.
5. **Track health** — every project shows whether it's *Building*, *Stuck*, *Ready to ship* or *Shipped*, plus its next best action.

## Features

### Projects — the core
- **Roadmap board** per project: High / Medium / Low priority columns + a "work in progress" lane.
- **Project context** (stack, conventions), **repo URL** and **live URL** — all injected into prompts automatically.
- **Derived project health**: *Building · Stuck · Ready to ship · Shipped · On ice* — computed from activity and open steps, not just a manual status.
- **Next best action** surfaced on every project.
- **"Ask Claude about the project" recipes** — one-click, context-rich prompts: brutal review, launch checklist, code cleanup, bug hunt, schema review, refactor plan, landing copy, growth ideas.
- **Prompt queue** — work through prompts one at a time: copy / open Claude / mark asked / paste result.
- **Copy all prompts** as a single numbered list, with the project context on top.
- **Share a project** with a collaborator over email (Dexie Cloud realm).

### Supporting modules
These exist to feed the build workflow, not to compete with it:
- **Tasks** — one unified list with focus (max 3), natural-language entry, smart date chips, subtasks, swipe.
- **Idea Bank** — a menu of ideas, not a debt list; promote any idea to a project.
- **Calendar** — month view + day agenda, recurring events, tasks shown on their due date.
- **Habits**, **Money** (budgets, expenses, subscriptions, savings), **Garden** (a calm visual mirror of your week), **Shared / Shopping lists** — tucked into "More".

### Platform
- **Local-first**: everything works offline; data lives in your browser (IndexedDB).
- **Cross-device sync** via Dexie Cloud (passwordless email + one-time code login).
- **Installable PWA** with daily reminders and app-icon badge.
- **JSON export / import** for full backups.

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 19 + Vite |
| Motion / icons / toasts | `motion`, `lucide-react`, `sonner` |
| Charts | `recharts` (lazy-loaded) |
| Local storage | Dexie (IndexedDB) |
| Sync | Dexie Cloud (`dexie-cloud-addon`) |
| PWA | `vite-plugin-pwa` |
| Tests | Vitest (pure-logic unit tests) |
| CI | GitHub Actions (lint + test + build) |
| Deploy | Vercel (auto-deploy from `main`) |
| Fonts | Self-hosted Plus Jakarta Sans (no CDN — works offline) |

## Local-first architecture

- **Data model**: one Dexie (IndexedDB) store per module (`tasks`, `projects`, `projectItems`, `ideas`, `habits`, `events`, `subscriptions`, `expenses`, `budgets`, `incomes`, `goals`, shared lists). IDs are `crypto.randomUUID()`. Current schema version **11**; migrations are versioned and additive — see `src/lib/migrations.js`.
- **Sync**: Dexie Cloud mirrors stores across devices. Shared lists, shared calendar events and shared projects use Dexie Cloud *realms*; everything else is private per user.
- **Offline**: writes go to IndexedDB immediately and sync opportunistically. The app is fully usable with no network.
- **Design system**: all colors/spacing/radius/typography are CSS tokens in `:root` (`src/components/AppShell.css`); components use `var(--…)`, never hardcoded hex.

## Getting started

Requirements: Node 18+ and npm.

```bash
# install dependencies
npm install

# run the dev server (http://localhost:5173)
npm run dev
```

## Build, test, lint

```bash
npm run build     # production build (dist/)
npm run preview   # preview the production build locally
npm run test      # run the Vitest unit suite
npm run lint      # run ESLint
```

Tests focus on the most fragile **pure logic** — date helpers, natural-language parsing, data migrations, prompt building and project health — rather than trivial UI. CI runs lint + test + build on every push and PR.

## Product roadmap

Tracked in [`ROADMAP.md`](./ROADMAP.md) as **Now → Next → Later → Done**. Current direction:

- **Now / Next**: deepen the Projects cockpit — richer project health, launch-readiness, and prompt recipes.
- **Later**: general accessibility & performance polish; possible migration of auth/sync to Supabase (see `SUPABASE-MIGRATION.md`).

See [`PROGRESS.md`](./PROGRESS.md) for the dated change log and [`CLAUDE.md`](./CLAUDE.md) for the living architecture/design reference.

## Project layout

```
src/
  App.jsx                 app shell: navigation, login gate, module routing
  db.js                   Dexie schema + CRUD helpers + export/import
  lib/                    pure logic (dates, parse, prompts, projectHealth, migrations) + tests
  components/             one component (+ CSS) per module
    projects/             the Projects cockpit (list, roadmap board, prompt queue, recipes)
```

---

*Private, single-user product. Not accepting external contributions.*
