"use client";

import { useState, type FormEvent } from "react";

import { deleteAccountConfirmation, deletionConfirmed } from "@/lib/account/records";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirmed = deletionConfirmed(confirmation);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    setError(null);
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation })
    });
    if (!response.ok) {
      setError("Account could not be deleted.");
      return;
    }
    try {
      if (isSupabaseConfigured()) {
        await createClient().auth.signOut({ scope: "local" });
      }
    } catch {
      // The delete response already expired the auth cookies.
    }
    window.location.assign("/");
  }

  return (
    <form className="account-confirm" onSubmit={(event) => void submit(event)}>
      <label htmlFor="delete-account-confirmation">
        Type “{deleteAccountConfirmation}” to confirm
      </label>
      <input
        id="delete-account-confirmation"
        autoComplete="off"
        value={confirmation}
        onChange={(event) => setConfirmation(event.currentTarget.value)}
      />
      <button className="compare-button" type="submit" disabled={!confirmed}>
        Delete account
      </button>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </form>
  );
}
