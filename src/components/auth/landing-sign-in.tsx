"use client";

import { AuthProviderButtons } from "@/components/auth/auth-provider-buttons";
import { canShowSignInOffer, useSignInSession, type SignInSession } from "@/components/auth/sign-in-session";

export function LandingSignIn({ session }: { session?: SignInSession }) {
  const live = useSignInSession();
  if (!canShowSignInOffer(session ?? live)) return null;

  return (
    <div className="landing-sign-in">
      <AuthProviderButtons />
    </div>
  );
}
