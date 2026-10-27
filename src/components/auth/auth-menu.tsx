"use client";

import { Github, LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { buildOAuthRedirectTo } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/client";

import { AccountMenu } from "./account-menu";
import { registerSignInOpener } from "./open-sign-in";
import { canShowSignInOffer, useSignInSession } from "./sign-in-session";

type Provider = "google" | "github";

export function AuthMenu() {
  const { configured, email } = useSignInSession();
  const dialogTitleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const offerSignIn = canShowSignInOffer({ configured, email });

  useEffect(() => {
    if (!offerSignIn) return;
    return registerSignInOpener(() => {
      setError(null);
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) dialog.showModal();
    });
  }, [offerSignIn]);

  async function signIn(provider: Provider) {
    setError(null);
    const redirectTo = buildOAuthRedirectTo(
      window.location.origin,
      `${window.location.pathname}${window.location.search}`
    );
    const { error: signInError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });
    if (signInError) setError("Sign-in could not start. Try again in a moment.");
  }

  if (!offerSignIn) return email ? <AccountMenu email={email} /> : null;

  return (
    <>
      <button
        className="feedback-link auth-entry"
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        <LogIn size={15} aria-hidden="true" />
        <span className="auth-entry-label">Sign in</span>
      </button>
      <dialog ref={dialogRef} className="auth-dialog" aria-labelledby={dialogTitleId}>
        <form method="dialog" className="auth-dialog-body">
          <h2 id={dialogTitleId}>Sign in or create an account</h2>
          <p>
            Use Google or GitHub. The first sign-in creates your account. Endpoint Jobs never
            sees that password.
          </p>
          <button className="auth-provider" type="button" onClick={() => void signIn("google")}>
            Continue with Google
          </button>
          <button className="auth-provider" type="button" onClick={() => void signIn("github")}>
            <Github size={15} aria-hidden="true" />
            Continue with GitHub
          </button>
          {error ? (
            <p className="auth-dialog-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="auth-dialog-privacy">
            <Link
              href="/privacy"
              onClick={() => {
                // Same-route navigation does not unmount this dialog, so the backdrop would stay up.
                dialogRef.current?.close();
              }}
            >
              Privacy policy
            </Link>
          </p>
          <button className="auth-dialog-close" type="submit" value="cancel">
            Close
          </button>
        </form>
      </dialog>
    </>
  );
}
