import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip session refresh for static assets, the public jobs API, and MCP.
     * Keep this list aligned with skipsSessionRefresh().
     */
    "/((?!_next/static|_next/image|favicon.ico|api/jobs(?:/|$)|api/mcp(?:/|$)|mcp(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|mjs|json|webmanifest|woff2?)$).*)"
  ]
};
