"use client";

import type { ReactNode } from "react";

import { openSignInDialog } from "@/components/auth/open-sign-in";

export function LandingSignIn({ children }: { children: ReactNode }) {
  return (
    <p className="landing-sign-in">
      <button type="button" onClick={openSignInDialog}>
        {children}
      </button>
    </p>
  );
}
