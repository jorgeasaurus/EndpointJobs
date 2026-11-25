"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { deleteAccountConfirmation, deletionConfirmed } from "@/lib/account/records";
import { clearViewHistory, deleteAccount, downloadAccountExport } from "@/lib/account/requests";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Router = ReturnType<typeof useRouter>;

/** Each action reports whether it finished; a failure shows its message under the button. */
const accountActions = {
  export: { label: "Export my data", failure: "Export did not finish.", run: downloadAccountExport },
  "clear-views": {
    label: "Clear view history",
    failure: "View history could not be cleared.",
    run: async (router: Router) => {
      const cleared = await clearViewHistory();
      if (cleared) router.refresh();
      return cleared;
    }
  }
} satisfies Record<string, { label: string; failure: string; run: (router: Router) => Promise<boolean> }>;

export function AccountActionButton({ action }: { action: keyof typeof accountActions }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { label, failure, run } = accountActions[action];

  async function click() {
    setError(null);
    if (!(await run(router))) setError(failure);
  }

  return (
    <div className="account-actions">
      <button className="compare-button" type="button" onClick={() => void click()}>
        {label}
      </button>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirmed = deletionConfirmed(confirmation);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    setError(null);
    if (!(await deleteAccount(confirmation))) {
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
