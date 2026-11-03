import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for Route Handlers / Server Components. Uses the anon key and
 * the caller's cookies only — never the service role key.
 *
 * To establish WHO the caller is on the server, use `getVerifiedUserId()`.
 * Never trust `auth.getSession()` on the server: it reads the cookie without
 * verifying the JWT, so a forged cookie passes it.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a context where cookies are read-only (Server
            // Component). Safe to ignore: the proxy refreshes the session.
          }
        },
      },
    }
  );
}

/**
 * Returns the authenticated user's id, or null. The JWT signature is verified
 * (getClaims), so a forged or tampered cookie yields null.
 */
export async function getVerifiedUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}
