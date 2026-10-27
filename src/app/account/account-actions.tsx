"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { deleteAccountConfirmation, deletionConfirmed } from "@/lib/account/records";
import { clearViewHistory } from "@/components/job-board/use-account-board";

export function ExportAccountButton() {
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    const response = await fetch("/api/account/export");
    if (!response.ok) {
      setError("Export did not finish.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "endpoint-jobs-account.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="account-actions">
      <button className="compare-button" type="button" onClick={() => void download()}>
        Export my data
      </button>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function ClearViewHistoryButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    setError(null);
    const cleared = await clearViewHistory();
    if (!cleared) {
      setError("View history could not be cleared.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="account-actions">
      <button className="compare-button" type="button" onClick={() => void clear()}>
        Clear view history
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
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation })
    });
    if (!response.ok) {
      setError("Account could not be deleted.");
      return;
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
