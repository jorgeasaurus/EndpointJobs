"use client";

import type { ReactNode } from "react";

import { openSignInDialog } from "@/components/auth/open-sign-in";
import { canShowSignInOffer, useSignInSession, type SignInSession } from "@/components/auth/sign-in-session";

export function LandingSignIn({
  children,
  session
}: {
  children: ReactNode;
  session?: SignInSession;
}) {
  const live = useSignInSession();
  if (!canShowSignInOffer(session ?? live)) return null;

  return (
    <p className="landing-sign-in">
      <button type="button" onClick={openSignInDialog}>
        {children}
      </button>
    </p>
  );
}
