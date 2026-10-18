import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "https://*.supabase.co";
  return [
    "default-src 'self'",
    // Scripts only run if they carry this request's nonce (or were loaded by one that does).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React and the UI library set inline style attributes, which a nonce can't cover.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}${dev ? " ws: http://localhost:*" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${supabase} https://accounts.google.com`,
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  // Next reads the nonce from the request's CSP header and applies it to its own inline scripts.
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);

  const response = (await updateSession(request)) as NextResponse;
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
