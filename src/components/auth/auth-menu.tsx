"use client";

import { LogIn, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { AccountMenu } from "./account-menu";
import { AuthProviderButtons } from "./auth-provider-buttons";
import { closeDialogOnBackdrop } from "./dialog-backdrop";
import { registerSignInOpener } from "./open-sign-in";
import { canShowSignInOffer, useSignInSession } from "./sign-in-session";

export function AuthMenu() {
  const { configured, email } = useSignInSession();
  const dialogTitleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [providerReset, setProviderReset] = useState(0);
  const offerSignIn = canShowSignInOffer({ configured, email });
  const openSignIn = useCallback(() => {
    setProviderReset((value) => value + 1);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!offerSignIn) return;
    const dialog = dialogRef.current;
    const unregister = registerSignInOpener(openSignIn);
    if (!dialog) return unregister;

    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("click", closeDialogOnBackdrop);
    dialog.addEventListener("keydown", trapTab);
    return () => {
      dialog.removeEventListener("click", closeDialogOnBackdrop);
      dialog.removeEventListener("keydown", trapTab);
      unregister();
    };
  }, [offerSignIn, openSignIn]);

  if (!offerSignIn) return email ? <AccountMenu email={email} /> : null;

  return (
    <>
      <button
        className="feedback-link auth-entry"
        type="button"
        aria-haspopup="dialog"
        onClick={openSignIn}
      >
        <LogIn size={15} aria-hidden="true" />
        <span className="auth-entry-label">Sign in</span>
      </button>
      <dialog
        ref={dialogRef}
        className="auth-dialog"
        aria-labelledby={dialogTitleId}
      >
        <form method="dialog" className="auth-dialog-body">
          <h2 id={dialogTitleId}>Sign in to Endpoint Jobs</h2>
          <p>Save jobs, keep your filters, and hide what you've seen.</p>
          <AuthProviderButtons key={providerReset} />
          <p className="auth-dialog-privacy">
            By continuing you agree to the{" "}
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
          <button className="auth-dialog-close" type="submit" aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </form>
      </dialog>
    </>
  );
}
