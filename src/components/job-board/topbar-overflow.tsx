"use client";

import { Menu } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function TopbarOverflow({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }

    function onPointer(event: PointerEvent) {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="topbar-overflow" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="topbar-overflow-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        aria-label="More links"
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={18} aria-hidden="true" />
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={open ? "topbar-overflow-panel is-open" : "topbar-overflow-panel"}
      >
        {children}
      </div>
    </div>
  );
}
