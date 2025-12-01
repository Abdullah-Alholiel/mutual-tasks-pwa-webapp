# Mutual Tasks PWA

A progressive web app that helps two or more friends keep each other accountable by co-owning tasks, logging completions, and celebrating streaks. The UI is powered by mock data that mirrors the future database so you can keep building the product experience today while the remote backend is still in progress.

## Why this repo exists
- Keep design, product copy, and implementation details in one source of truth.
- Give newcomers (even if they have not coded for a while) a clear map of what lives where.
- Prepare the front-end for an eventual hosted PostgreSQL (or compatible) database without blocking feature work right now.

## Feature highlights
- **Shared projects** – create public or private projects with color tags, expected task counts, and participant chips.
- **Two-sided tasks** – every task tracks creator, assignee, due dates, and individual completion states.
- **Full status flow** – `draft → initiated → scheduled → in_progress → completed` with optional exits to `cancelled` or `expired`, so people can renegotiate times without losing context.
- **Completion streaks & difficulty** – difficulty ratings are stored per user per task to fuel score and streak math. 
// TO DO: score should not be affected by difficulty ratings since the task has been completed regardless of how hard it is, for now score should be basic, finished tasks against total number of tasks completed in a project.
- **Notifications inbox** – mock notifications mirror the messaging you will eventually push via email or in-app to keep everyone engaged.
- **PWA-ready shell** – offline manifest, icons, and a service worker are already configured via `vite-plugin-pwa`.

## Tech stack in plain English
| Tool | Why we use it |
| --- | --- |
| Vite + React 18 | Fast dev server, modern JSX, TypeScript-first. |
| shadcn/ui + Tailwind CSS | Pre-built accessible components with utility-first styling. |
| React Hook Form + Zod | Typesafe forms and validation for project/task flows. |
| React Query | Handles asynchronous data (currently mock data, later real API). |
| Vite PWA plugin | Generates the manifest, service worker, and offline assets. |
| ESLint + TypeScript | Prevents bugs by enforcing consistent patterns. |

## Repository layout
```
mutual-tasks-pwa-webapp/
├── public/                  # Static assets copied as-is into the build
├── src/
│   ├── main.tsx             # App bootstrap (React + router + providers)
│   ├── App.tsx              # Route map and app-wide providers
│   ├── pages/               # Top-level screens (Today dashboard, Projects, etc.)
│   ├── components/
│   │   ├── layout/          # Shell (navigation, responsive chrome)
│   │   ├── tasks/, projects/, profile/, notifications/ etc.
│   │   └── ui/              # shadcn primitives (button, dialog, calendar…)
│   ├── hooks/               # Reusable hooks (mobile detection, toasts)
│   ├── lib/
│   │   ├── mockData.ts      # Single source of truth for fake DB records
│   │   ├── utils.ts, notificationService.ts, emailTemplates.ts
│   └── types/               # Database-aligned TypeScript interfaces
├── EMAIL_INTEGRATION.md     # Notes on hooking email + notifications
├── DATABASE_FOUNDATION.md   # Entity relationship + migration plan
├── package.json             # Scripts and dependency list
└── dist/                    # Auto-generated production build output
```

> Tip: if you want to peek at realistic sample data, `src/lib/mockData.ts` mirrors the schema declared in `src/types/index.ts`. Swap those mocks out with API calls once the remote database goes live.

## Data & state model
- UI components consume `User`, `Project`, `Task`, `CompletionLog`, and `Notification` interfaces defined in `src/types/index.ts`.
- React Query is configured, even though the current data source is synchronous mock data. When the backend is ready, you only need to replace the functions inside `src/lib` with API calls and keep the rest of the app untouched.
- Statuses now include `scheduled`/`in_progress` plus dedicated task time proposals so people can renegotiate deadlines. The helper `mapTaskStatusForUI` converts database statuses to the simplified UI badges.

## Getting started (even if you have not coded recently)
1. **Install Node.js 20+** – the easiest path is [nvm](https://github.com/nvm-sh/nvm). Run `nvm install 20 && nvm use 20`.
2. **Clone the repo** (or download the ZIP if you prefer)  
   ```sh
   git clone <YOUR_GIT_URL>
   cd mutual-tasks-pwa-webapp
   ```
3. **Install dependencies**  
   ```sh
   npm install
   ```
4. **Start a dev server**  
   ```sh
   npm run dev
   ```  
   Vite will print a local URL (usually http://localhost:5173). Open it in your browser; changes save automatically.
5. **Edit content** – all UI copy and flows live in `src/pages` and `src/components`. Tailwind classes describe styling inline so you can tweak spacing/typography without hunting for CSS files.

### Common npm scripts
| Command | What it does |
| --- | --- |
| `npm run dev` | Launches the Vite dev server with fast refresh. |
| `npm run build` | Creates an optimized production bundle in `dist/`. |
| `npm run build:dev` | Same as build but keeps development mode flags (useful for debugging). |
| `npm run preview` | Serves the `dist/` build locally to sanity-check before deploying. |
| `npm run lint` | Runs ESLint across the project; fix warnings before committing if possible. |

## Deploying / publishing
- Running `npm run build` generates everything you need inside `dist/` (HTML, JS, CSS, manifest, icons).
- You can host `dist/` on any static host (Netlify, Vercel, S3) or publish directly through [Lovable](https://lovable.dev/projects/75b243ea-f4b3-452e-aef7-aa76548011ff) via Share → Publish.
- Because this is a PWA, ensure your host serves HTTPS so install prompts work on mobile.

## Working toward the remote database
While we wait for the hosted database:
- Keep schema changes synchronized between `src/types/index.ts`, `src/lib/mockData.ts`, and `DATABASE_FOUNDATION.md`.
- Use `DATABASE_FOUNDATION.md` as the contract for whoever builds the backend (tables, enums, indexes, API checklist).
- When the API is ready, replace the helper functions in `src/lib/mockData.ts` with `fetch`/React Query hooks and remove the mock arrays.
- Notifications already include fields like `emailSent` so the same objects can be persisted and used for transactional email later.

### Database automation
- Ensure `.env` (or `.env.local`) exposes the Supabase project URL, **service role key**, and the **database connection string**. Minimal setup:
  ```
  SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...
  SUPABASE_DB_URL=postgresql://postgres:<db-password>@<db-host>:5432/postgres
  ```
  You can copy the connection string from Supabase → Database → Connection string → psql.
- Run `npm run db:migrate` to create/update enums, tables, and indexes that mirror the TypeScript types in `src/types/index.ts`.
- Use `npm run db:migrate` any time the schema changes—statements are idempotent so you can re-run safely.

## Troubleshooting quick answers
- **Blank screen?** Make sure you are running Node 20+ and no other process is using port 5173.
- **Styling looks off?** Run `npm install` again to ensure Tailwind and shadcn component dependencies are installed.
- **Icons or manifest missing?** Check `vite.config.ts` for the PWA plugin configuration—the assets in `public/` feed the build.

## Further reading
- `DATABASE_FOUNDATION.md` – full ER diagram, status flow, and backend checklist.
- `EMAIL_INTEGRATION.md` – how notification templates map to future email providers.
- `src/components/layout/AppLayout.tsx` – best place to start if you want to restyle the shell or navigation.

Have fun experimenting! The current setup lets you iterate quickly on user experience today and wire it up to the remote database the moment it is ready.
