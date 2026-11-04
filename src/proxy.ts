import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isBlockedInThisEnv } from "@/utils/devOnlyRoutes";

export async function proxy(req: NextRequest) {
  // Dev-only routes (e.g. /testbed, a component playground with dummy data) do not
  // exist outside development: answer a real 404 before auth or rendering, even
  // for signed-in users. Rewriting to a path that matches no route renders the
  // app's standard not-found page with a 404 status.
  if (isBlockedInThisEnv(req.nextUrl.pathname, process.env.NODE_ENV)) {
    return NextResponse.rewrite(new URL("/dev-only-route-disabled", req.url));
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res = NextResponse.next({
              request: {
                headers: req.headers,
              },
            });
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getClaims() verifies the JWT signature. getSession() only decodes the
  // cookie, so a hand-forged cookie would otherwise be treated as logged in.
  const { data: claimsData } = await supabase.auth.getClaims();
  const session = claimsData?.claims?.sub ? claimsData.claims : null;

  const pathname = req.nextUrl.pathname;

  // /update-password is intentionally NOT public: /auth/callback exchanges the
  // recovery code for a session first, so the user arrives authenticated.
  const publicRoutes = ['/', '/login', '/register', '/forgot-password'];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/auth/callback');
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (!session && !isPublicRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .*\.(?:svg|png|jpg|jpeg|gif|webp)$ (images)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)',
  ],
};
