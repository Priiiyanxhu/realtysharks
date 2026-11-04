# Known gaps

What is broken, unbuilt, unverified or undecided. Check here before starting a feature, and add an entry when you find something you are not fixing. Remove an entry in the change that fixes it.

## Needs the owner's decision

- **Upgrade page** (`src/app/(app)/upgrade/page.tsx`) is a stub: the plan buttons only `alert()` and no payment exists. Its footer says "RealtySharks is a closed, invite-only network" (signup is open and there is no invite code), "all subscriptions are subject to KYC verification" and promises a full refund within 5-7 days if KYC is rejected (no KYC review exists). The plans also sell features that do not exist ("Dedicated Relationship Manager", "Expert Negotiation Assistance", "Exclusive Off-Market Project Reach", "Unlimited Premium Leads"). Hide the page until payments are real, or rewrite it.
- **Verification:** no admin KYC review exists, so no broker shows a badge. The RERA number a broker enters is displayed nowhere; a plain "RERA … (self-reported)" chip on the broker profile would be honest.

## Unverified

- `requirements.broker_id` references `auth.users` in migrations, yet the code embeds `profiles!requirements_broker_id_fkey`. Confirm the live FK before touching either. The same embeds through `requirements_feed` are unverified against PostgREST.
- The Network Feed's realtime "Live Requirement Posted" items subscribe to INSERTs on the `requirements` base table. Once `20261103120300_requirements_base_select_owner_only` is applied, Realtime applies RLS, so a broker should receive only their own new requirements. Check on staging; if confirmed, drop those items or move them to a server-side source.

## Broken or unbuilt

- **Reports** are not reviewed anywhere in the app (no admin UI).
- **Listing-tag message format** (`__TAG_LISTING:id|title|price|location__`, written in the Messages page, parsed by `src/utils/listingTag.ts`) is fragile: a `|` in the title or price shifts the fields (wrong title or price on the card), and an `_` in the location stops the tag matching so the raw text shows. Listing titles are free text, so real listings can hit this. A sturdier encoding needs a backward-compatible parser for stored messages.
- **`MarketSphere`** reads the legacy `listings.location` column that new listings never fill, so the globe shows demo data.
- **Profile page:** a failed avatar or cover upload is silent (the helper's error is never read). `alert()` is still used for some failures (`grep -rn "alert(" src`).
- **Network Feed** links are plain `<a>`, so each click reloads the page.

## Tidy-ups

- `QuickActionsPanel` (`src/components/dashboard/`) is unused.
- `src/utils/supabase/client.ts` logs debug lines.
- No `capacitor.config` is committed, so native builds are not reproducible.
- `fix_blue.py` and `fix_emerald.py` are one-off scripts.
