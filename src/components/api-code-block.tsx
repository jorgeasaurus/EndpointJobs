"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

// Adapted from Beautiful UI's Code Block primitive.
// https://www.beautifului.dev/#code-block
export function ApiCodeBlock({
  code,
  language,
  title
}: {
  code: string;
  language: string;
  title: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  const buttonLabel = copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy";

  return (
    <figure className="api-code-block">
      <figcaption>
        <span>{title}</span>
        <span className="api-code-language">{language}</span>
        <button aria-label={`Copy ${title}`} type="button" onClick={copyCode}>
          {copyState === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {buttonLabel}
        </button>
      </figcaption>
      <pre tabIndex={0} aria-label={`${title} code`}><code>{code}</code></pre>
      <span className="sr-only" aria-live="polite">
        {copyState === "copied"
          ? `Copied ${title} to clipboard`
          : copyState === "error"
            ? `Could not copy ${title}`
            : ""}
      </span>
    </figure>
  );
}
