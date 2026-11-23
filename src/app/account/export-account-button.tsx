"use client";

import { useState } from "react";

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
