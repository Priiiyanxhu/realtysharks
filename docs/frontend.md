# Frontend: routing, error screens, layout

Read this before changing pages, layout, routing, the 404/500 screens or user-facing copy. Copy that makes claims about security or verification is governed by "Claims the UI may make" in [`backend.md`](backend.md).

## Routing

- **Route gate:** `src/proxy.ts` (Next 16's name for middleware). `/api/*` answers 401 and pages redirect to `/login`. `ProtectedRoute` and `GlobalLayout` are client-side extras. `/update-password` stays protected on purpose: `/auth/callback` exchanges the emailed code for a session first.
- **Dev-only routes:** `/testbed` (a component playground with dummy data, including a fake "Verified" card) exists only under `next dev`. List such routes in `DEV_ONLY_PATHS` (`src/utils/devOnlyRoutes.ts`); the proxy answers a real 404 for them, before auth, whenever `NODE_ENV` is not `development`, and normalizes spellings like `/./testbed` and `/%2e/testbed`. A `notFound()` in a layout is no substitute: Next can answer 200 when it streams. The page is still compiled into the build but is unreachable through the server.

## 404 and 500 screens

- **404:** `src/app/not-found.tsx`, used for unknown URLs and for dev-only routes. It sits at the root, so it has no sidebar (the `(app)` shell wraps only that route group). Signed-out visitors reach it only for dev-only routes: the proxy redirects other unknown URLs to `/login`.
- **500:** `src/app/error.tsx` (outside the shell), `src/app/(app)/error.tsx` (inside it, so the sidebar stays) and `src/app/global-error.tsx` (a failing root layout; it brings its own `<html>` and the stylesheet). All render `ErrorScreen` on the `StatusScreen` the 404 shares.
- **What an error screen shows:** `error.digest` as a selectable "Reference", never `error.message` (an error thrown in client code carries its real message). Retry with Next 16's `unstable_retry`, not `reset`. `src/utils/errorPages.test.ts` guards the structure.
- **Status codes:** a server error inside the shell is HTTP 200 (the shell has already streamed); outside it, or in the root layout, it is a real 500.
- **Seeing one:** add a throwaway page that awaits `connection()` and then throws (a static page throws at build time instead), and delete it afterwards.

## Layout

Institutional, understated, trustworthy: Midnight Slate + Champagne Gold (tokens in `globals.css`), dark by default, glass only where it aids clarity. Mobile-first with safe-area insets. Build loading, empty and error states with the Skeleton components and surface failures as toasts.

- **`<main>` has `min-w-0`** (`GlobalLayout`). As a flex item it would grow to its content's minimum width, so one nowrap line or unbroken word stretches the page past the screen and pushes controls off it. `overflow-x-clip` hides that overflow instead of showing a scrollbar, and `min-w-0` on elements between the content and `<main>` cannot prevent it.
- **Breakpoints:** from `md` (768px) the sidebar takes 288px, so a page has about 480px at 768px, not 768px. A row layout that needs more switches at `lg` or `xl`, or wraps: `flex-wrap` with `min-w-max` on the items keeps each label on one line and lets the row wrap. Cards must work at any width, not only the one the design assumed (worked examples: the broker profile header, the dashboard grid, the Sphere's canvas box).
- **Clipping:** use `overflow-x-clip`, not `overflow-x-hidden`: `hidden` on a wrapper makes it a scroll container and silently breaks `position: sticky`. The root layout and `GlobalLayout` clip this way, so sticky bars (the Listings filter bar, the listing-detail contact card) stick.
- **Fixed elements:** the desktop sidebar, the phone tab bar and overlays are `position: fixed`. A `transform`, `filter`, `backdrop-filter`, `perspective` or `contain` on an ancestor makes that ancestor the containing block, and the element scrolls with the page (a phone tab bar ends up off-screen on tall pages). `src/app/template.tsx` wraps the whole shell, so it animates opacity only; animate rise or blur inside `GlobalLayout`'s `<main>`.
- **Overhanging decoration:** absolutely positioned decoration with negative offsets (`bottom-[-10%]`) adds scrollable overflow; the root glows once made every page scroll 10% past its content. Give it its own `absolute inset-0 overflow-hidden pointer-events-none` layer (`overflow-hidden` is safe there because it holds no content), as the glows in `src/app/layout.tsx` do.
- **Phone tab bar:** it covers the bottom 100px plus the safe area, and `<main>` reserves that space. A full-height screen ends above it, as Messages does with `h-[calc(100dvh_-_100px_-_env(safe-area-inset-bottom))] md:h-[100dvh]`; otherwise the bar covers the screen's bottom controls (it once covered the chat composer).
