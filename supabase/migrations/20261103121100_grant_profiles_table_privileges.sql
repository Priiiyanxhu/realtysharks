-- Explicit table privileges for public.profiles and public.profiles_private.
--
-- Why: these two tables were created without any GRANT and relied on Supabase's
-- default privileges to hand them to the API roles. Current Supabase images no
-- longer grant new tables to anon / authenticated / service_role automatically,
-- so a database built by replaying these migrations from empty had a `profiles`
-- table that no API role could read or write (SQLSTATE 42501). Every later
-- table already states its grants; this brings the first two in line, so the
-- schema no longer depends on what the platform grants by default.
--
-- Safe to apply to production: a database that already holds these grants
-- (through the old defaults) ends up with the same or narrower privileges.
-- The only narrowing is that anon and PUBLIC lose their table privileges. They
-- could never act on a row anyway: every policy on these tables requires a
-- signed-in user (auth.uid()), and the app reads profiles only after login.
-- RLS stays the access control; these grants only let a request reach it.
--
-- Not changed: row-level security, policies, the profiles_public view, the
-- trust-column trigger (service_role remains the only path to `verified`).

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

REVOKE ALL ON TABLE public.profiles_private FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles_private TO authenticated;
GRANT ALL ON TABLE public.profiles_private TO service_role;
