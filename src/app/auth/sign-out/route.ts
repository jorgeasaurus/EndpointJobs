import { NextResponse } from "next/server";

import { signOutRedirectUrl } from "@/lib/auth/sign-out-navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(signOutRedirectUrl(request.url), 303);
}
