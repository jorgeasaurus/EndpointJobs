import { useEffect } from "react";
import type { RefObject } from "react";

export function useSearchFocusShortcut(
  searchInputRef: RefObject<HTMLInputElement | null>
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isTypingElement(event.target)) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchInputRef]);
}

function isTypingElement(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT");
}
