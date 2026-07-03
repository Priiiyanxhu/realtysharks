@AGENTS.md

# Realtysharks Claude Project Memory

> Permanent project reference for Claude CLI sessions. Keep this file accurate — update it when architecture, schema, or priorities change. **Note:** `@AGENTS.md` (imported above) warns this is Next.js **16.2.9** with breaking changes from older versions. Read `node_modules/next/dist/docs/` before writing Next.js code.

## 1. Project Summary

Realtysharks is a **mobile-first B2B real estate networking app** for the Indian brokerage market. It lets real estate professionals post property **listings** and buyer/investor **requirements**, discover and match opportunities, network with verified peers, and chat in real time. It leans on AI (Gemini) to auto-write premium listing copy. The goal is a trusted, invite-worthy professional network — not a consumer property portal.

The core problem it solves: brokers currently match inventory to buyer demand over fragmented WhatsApp groups and personal contacts. Realtysharks centralizes listings + requirements + trusted profiles + direct chat into one premium workspace.

## 2. Target Users

- **Real estate brokers** — post listings, find matching requirements, close deals with other brokers.
- **Channel partners** — distribute developer inventory, need reach and matching.
- **Developers** — surface projects to a broker network.
- **Consultants** — advisory, need credible profiles and discovery.
- **Agents** — post/find inventory, network, chat.

Shared needs: fast posting, real matching, trustworthy profiles (RERA/KYC/verification), private chat, mobile-first UX.

## 3. Tech Stack (verified from files)

- **Next.js 16.2.9** (App Router) — `next.config.ts`, `package.json`.
- **React 19.2.4 / React DOM 19.2.4**.
- **TypeScript 5** (`strict: true`, `noEmit`, path alias `@/* -> ./src/*`).
- **Tailwind CSS v4** — CSS-first config via `@theme` in `src/app/globals.css` (no `tailwind.config.*` file). PostCSS via `@tailwindcss/postcss`.
- **Supabase**: `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/auth-helpers-nextjs` — Auth, Postgres, Storage, Realtime.
- **AI**: two Gemini SDKs present — `@google/genai` (used in the live API route) and `@google/generative-ai` (used only in unused `src/lib/gemini.ts`).
- **3D / motion**: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `cobe` (globe), `framer-motion`.
- **Forms/validation**: `react-hook-form`, `@hookform/resolvers`, `zod` v4.
- **Utilities**: `clsx` + `tailwind-merge` (`cn()` in `src/lib/utils.ts`), `date-fns`, `lucide-react` (icons), `qrcode`, `jspdf` + `html2canvas` (PDF export).
- **Mobile**: `@capacitor/core|android|ios` v8 — native wrapper. `android/` and `ios/` folders exist; **no `capacitor.config.*` is committed at root** (likely missing or gitignored — verify before a native build). A `out/` static export dir exists from a prior build, but `next.config.ts` does **not** set `output: 'export'`.

## 4. Project Structure

```
src/
  app/
    layout.tsx              # Root layout: dark theme, Inter font, midnight bg, gold ambient glows, grain overlay
    template.tsx            # Framer Motion page-transition wrapper
    globals.css             # Tailwind v4 @theme tokens + global mobile CSS
    page.tsx                # Public landing
    login/ register/ forgot-password/ update-password/   # Auth pages
    onboarding/             # Post-signup profile setup (own layout)
    (app)/                  # Authenticated app group (uses GlobalLayout + GlobalNotification)
      layout.tsx
      dashboard/  listings/[id]  network/[id]  messages/
      post-listing/  post-requirement/  profile/  upgrade/  testbed/
    api/ai-autowrite/route.ts   # POST -> Gemini (@google/genai, gemini-2.5-flash). Server-only.
  proxy.ts                  # Next 16 middleware-equivalent (see note below) — server-side route protection
  components/
    auth/ProtectedRoute.tsx # Client-side session guard (belt-and-suspenders with proxy.ts)
    chat/                   # ChatArea, ChatHeader, ChatInput, ConversationList, MessageBubble, GlobalNotification
    dashboard/              # AiMatchesGrid, MarketPulse, NetworkFeed, QuickActionsPanel
    layout/GlobalLayout.tsx
    listings/               # FilterBar, RequirementCard
    ui/                     # GlassCard, GlassInput, PremiumButton, PropertyCard, MarketSphere(3D), Skeleton(s), etc.
  hooks/                    # useConversations, useMessages, useDebouncedValue, useDeviceOrientation, useScrollPosition
  lib/                      # supabase.ts (plain client), gemini.ts (UNUSED), schemas.ts (zod), utils.ts (cn)
  utils/
    supabase/client.ts      # createBrowserClient (@supabase/ssr) — the client actually used app-wide
    formatters.ts  pdfGenerator.ts
supabase/migrations/        # 6 SQL migrations (source-controlled). See §10.
android/  ios/              # Capacitor native shells
fix_blue.py  fix_emerald.py # One-off color-replacement scripts (housekeeping, not app code)
```

**Two Supabase browser clients exist** — `src/utils/supabase/client.ts` (createBrowserClient, imported by hooks/components) and `src/lib/supabase.ts` (plain createClient). Prefer `@/utils/supabase/client`. `src/utils/supabase/client.ts` currently logs debug lines on import — clean these up.

**Route protection = `src/proxy.ts`.** In Next.js 16 the former `middleware.ts` convention is the `proxy` file/function. It runs `getSession()` server-side, redirects unauthenticated users off private routes to `/login`, returns 401 for `/api/*`, and bounces logged-in users away from auth pages. `publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password']`. Verify this proxy is actually being picked up by the running build when auditing auth.

## 5. Core Features

**Implemented (frontend + DB wiring):**
- Email/password auth, forgot/update password, onboarding profile setup.
- Profiles with company, RERA number, avatar/cover/KYC uploads, verification flag.
- Listings: create, browse, detail page, image upload, filter bar.
- Requirements: rich post-requirement form (budget, config, localities, funding, timeline, mandate, etc.).
- Network: browse/search brokers, broker detail pages.
- Real-time chat: conversations, participants, messages, optimistic send, unread tracking (localStorage read timestamps), global new-message notification, Supabase Realtime subscription.
- AI auto-write listing descriptions via `/api/ai-autowrite`.
- Premium UI: 3D globe/sphere, glassmorphism, Framer Motion transitions, PDF export (jspdf/html2canvas), QR codes.

**Planned / in progress:**
- PWA + Capacitor native iOS/Android packaging.
- Real matching engine between listings and requirements.
- Upgrade/monetization tier (`/upgrade` exists).
- Hardened RLS, storage security, chat stability (see §6).

## 6. Current Critical Priorities

1. **Auth route protection** — confirm `src/proxy.ts` is active in Next 16 build; `ProtectedRoute.tsx` is client-side only.
2. **Supabase RLS & database privacy** — profiles are world-readable (`USING (true)`), exposing `kyc_url`/`rera_number`; `conversation_participants` SELECT policy is self-referential (Supabase recursive-RLS risk).
3. **Storage security** — only `avatars` has path-based RLS (`20260703000001`). `covers`, `listing-images`, `kyc-documents` still use broad `FOR ALL TO authenticated USING (bucket_id=...)` — any authenticated user can overwrite others' files.
4. **Chat stability** — verify hook render cascades; `useMessages` subscribes to ALL message inserts globally then filters in state.
5. **Real search/filter** — `FilterBar`/network search partly cosmetic; confirm each control binds to a DB query.
6. **3D performance optimization** — throttle/limit `MarketSphere`, cobe globe, and R3F canvases on mobile.
7. **Toast/error state polish** — replace remaining `alert()` calls (~10 in `src/`) with proper toast UI.
8. **Closed beta readiness** — schema/code consistency (see mismatches below), remove debug logs, commit capacitor config.

### Known schema ↔ code mismatches (fix before relying on these paths)
- **`agency_name` does not exist in migrations.** Migrations define `profiles.company_name`, but code (`listings`, `network`, chat hooks) selects/reads `profiles.agency_name`. Either a migration is missing or the code is wrong — reconcile before trusting profile company display.
- **`listings.broker_id REFERENCES public.profiles(auth_id)`** in `20260616194000_create_listings.sql`, but `profiles` has **no `auth_id` column** (PK is `id`). This migration as written would fail — the live DB likely diverged from source control. Migrations are **not** guaranteed to reflect the real database; verify against the actual Supabase schema.
- Code relies on FK constraint names `listings_broker_id_fkey` and `requirements_broker_id_fkey` for embedded selects.
- `src/lib/gemini.ts` is **dead code** (not imported anywhere); the real AI path is `src/app/api/ai-autowrite/route.ts`.

## 7. Security Rules (permanent)

- Never expose secret keys.
- Never print `.env` values.
- Never move `SUPABASE_SERVICE_ROLE_KEY` to frontend code. (It is in `.env.local` and currently **not** referenced anywhere in `src/` — keep it that way; use only in server routes if ever needed.)
- Never move `GEMINI_API_KEY` to frontend code. (Correctly used server-side in the API route; never prefix it with `NEXT_PUBLIC_`.)
- Never create broad Supabase RLS policies like `USING (true)` unless explicitly justified.
- Never create storage policies that let one user overwrite another user's files.
- Always use `auth.uid()` ownership checks for private data.
- Always source-control Supabase migrations.
- Remove stray `console.log` of auth/keys (present in `src/utils/supabase/client.ts`).

## 8. Development Rules

- Do not make large changes without a plan first.
- Before editing, explain which files will change and why.
- After editing, run:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build`
- If a command fails, explain the error and fix it before proceeding.
- Do not fake completed features.
- Do not use dummy data unless clearly marked temporary.
- Do not build new features before fixing security blockers (§6).
- **Note:** `package.json`'s `lint` script is `eslint` (flat config `eslint.config.mjs`). There is no `typecheck` script — use `npx tsc --noEmit` directly.

## 9. UI/UX Direction

- Premium B2B real estate feel — institutional, trustworthy, understated.
- **Midnight Slate + Champagne Gold** palette. Verified tokens (`globals.css`): `--color-brand-primary #0B1120`, `--color-brand-accent #D4AF37`, `--color-brand-gold #FACC15`; body bg `#0F1419`, text `#F3F4F6`. App is dark-mode by default (`<html class="... dark">`).
- Glassmorphism only when it improves clarity (see `GlassCard`, `GlassInput`).
- Mobile-first layout; respects safe-area insets (`--sat/sar/sab/sal`), disables text selection/callouts/overscroll for a native feel.
- Strong trust-building design (verification badges, RERA, KYC).
- Clean loading, empty, and error states (Skeleton components exist — use them).
- No ugly native `alert()` calls in final UX — migrate to toast.

## 10. Database Rules

- Every `public` schema table exposed to the app must have RLS enabled. Current tables: `profiles`, `listings`, `requirements`, `conversations`, `conversation_participants`, `messages` (all have RLS enabled in migrations).
- **Messages** must only be readable by conversation participants (enforced via `conversation_participants` EXISTS check — good).
- **Requirements** must have clear ownership/visibility rules. Current: readable if `is_active = true OR auth.uid() = broker_id`; owner-only insert/update/delete. Note `privacy_level` column exists but is **not** enforced by RLS.
- **Listings** must have safe ownership rules: public SELECT, owner-only write via `auth.uid() = broker_id` (good — but see the `auth_id` FK bug in §6).
- **Profiles** must avoid exposing private data. Current `USING (true)` SELECT exposes every column (incl. `kyc_url`, `rera_number`) to everyone — tighten this.
- **Storage object paths must be scoped by user ID.** Only `avatars` enforces `auth.uid()::text = (storage.foldername(name))[1]`. Apply the same path-scoped pattern to `covers`, `listing-images`, and `kyc-documents`.
- `conversation_participants` SELECT policy references itself — watch for Supabase RLS infinite-recursion; prefer a `SECURITY DEFINER` helper function if it triggers.
- Buckets: `avatars` (public), `covers` (public), `listing-images` (public), `kyc-documents` (private).

## 11. Heavy-Lifting Task Policy

Use Claude CLI only for complex tasks: security audits, Supabase migrations, multi-file refactors, chat architecture, database schema design, route protection, performance optimization, build/lint/typecheck debugging, large feature implementation plans. For small copywriting, UI ideas, business strategy, or simple prompts, the user will use ChatGPT instead.

## 12. Required Response Format for Future Tasks

For future development tasks, always respond with:

1. What you understood
2. Files you will inspect
3. Risk level
4. Implementation plan
5. Files you expect to change
6. Confirmation request before major edits
7. Final test commands after changes (`npm run lint`, `npx tsc --noEmit`, `npm run build`)
