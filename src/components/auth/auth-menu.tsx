"use client";

import { Github, LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buildOAuthRedirectTo } from "@/lib/auth/safe-next-path";
import { signOut } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Provider = "google" | "github";

export function AuthMenu() {
  const configured = isSupabaseConfigured();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    let active = true;
    void supabase.auth.getClaims().then(({ data }) => {
      if (!active || !data?.claims?.sub) return;
      const claimEmail = data.claims.email;
      setEmail(typeof claimEmail === "string" && claimEmail ? claimEmail : "Signed in");
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [configured]);

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

  if (!configured) return null;

  if (email) {
    return (
      <details className="auth-menu">
        <summary className="feedback-link auth-entry" aria-label={`Account menu for ${email}`}>
          <UserRound size={15} aria-hidden="true" />
          <span className="auth-entry-label">{email}</span>
        </summary>
        <div className="auth-menu-panel">
          <p className="auth-menu-email">{email}</p>
          <form action={signOut}>
            <button className="auth-menu-action" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </details>
    );
  }

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
      <dialog ref={dialogRef} className="auth-dialog" aria-labelledby="auth-dialog-title">
        <form method="dialog" className="auth-dialog-body">
          <h2 id="auth-dialog-title">Sign in</h2>
          <p>Use Google or GitHub. Endpoint Jobs never sees that password.</p>
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
            <Link href="/privacy">Privacy policy</Link>
          </p>
          <button className="auth-dialog-close" type="submit" value="cancel">
            Close
          </button>
        </form>
      </dialog>
    </>
  );
}
