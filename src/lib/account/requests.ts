import { encodePreferences, type SavedPreferences } from "./preferences";

// Browser calls to the `/api/account/*` routes. Each route takes the user from
// the session, so no call names one. Each resolves to whether the route succeeded.

export function setJobSaved(jobId: string, saved: boolean) {
  return saved
    ? send("/api/account/saved", jsonRequest("POST", { jobId }))
    : send(`/api/account/saved?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
}

export function recordJobView(jobId: string) {
  return send("/api/account/views", jsonRequest("POST", { jobId }));
}

export function clearViewHistory() {
  return send("/api/account/views", { method: "DELETE" });
}

export function savePreferences(preferences: SavedPreferences) {
  return send("/api/account/preferences", jsonRequest("PUT", encodePreferences(preferences)));
}

export function deleteAccount(confirmation: string) {
  return send("/api/account/delete", jsonRequest("POST", { confirmation }));
}

/** Saves the account export as endpoint-jobs-account.json. */
export async function downloadAccountExport() {
  try {
    const response = await fetch("/api/account/export");
    if (!response.ok) return false;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "endpoint-jobs-account.json";
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** A network failure counts as a failed route, so callers undo or report it the same way. */
function send(path: string, init: RequestInit) {
  return fetch(path, init).then((response) => response.ok, () => false);
}

function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
