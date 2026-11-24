"use client";

import { AuthProviderButtons } from "@/components/auth/auth-provider-buttons";
import { canShowSignInOffer, useSignInSession } from "@/components/auth/sign-in-session";
import type { SignInSession } from "@/lib/auth/session";

export function LandingSignIn({ session }: { session?: SignInSession }) {
  const live = useSignInSession();
  if (!canShowSignInOffer(session ?? live)) return null;

  return (
    <div className="landing-sign-in">
      <AuthProviderButtons />
    </div>
  );
}
