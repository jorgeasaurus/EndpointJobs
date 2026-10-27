"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { accountMenuWidth, placeAccountMenuPanel } from "@/lib/auth/account-menu-placement";
import { SIGN_OUT_PATH } from "@/lib/auth/sign-out-navigation";

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;

    function position() {
      const currentPanel = panelRef.current;
      const currentTrigger = triggerRef.current;
      if (!currentPanel || !currentTrigger) return;
      const viewport = {
        width: document.documentElement.clientWidth,
        height: window.innerHeight
      };
      const width = accountMenuWidth(viewport.width);
      currentPanel.style.width = `${width}px`;
      const placed = placeAccountMenuPanel(
        currentTrigger.getBoundingClientRect(),
        viewport,
        { width, height: currentPanel.getBoundingClientRect().height }
      );
      // Fixed coordinates are viewport-relative unless an ancestor (the header's
      // backdrop-filter, for example) becomes the containing block. One measurement
      // corrects that drift. Portaling to body also escapes the page's overflow clip.
      currentPanel.style.position = "fixed";
      currentPanel.style.top = `${placed.top}px`;
      currentPanel.style.left = `${placed.left}px`;
      currentPanel.style.width = `${placed.width}px`;
      const actual = currentPanel.getBoundingClientRect();
      const driftX = actual.left - placed.left;
      const driftY = actual.top - placed.top;
      if (Math.abs(driftX) > 0.5 || Math.abs(driftY) > 0.5) {
        currentPanel.style.left = `${placed.left - driftX}px`;
        currentPanel.style.top = `${placed.top - driftY}px`;
      }
      currentPanel.dataset.placed = "true";
    }

    position();
    // Focus the panel, not Sign out. A held Enter that opened the menu must not
    // land on the submit button. Tab from here reaches Sign out.
    panel.focus();
    let frame = 0;
    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        position();
      });
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      panel.dataset.placed = "false";
    };
  }, [open, email]);

  useLayoutEffect(() => {
    if (!open) return;

    function close() {
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const cycle = [
        panel,
        ...panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
      ];
      const active = document.activeElement;
      const index = active instanceof HTMLElement ? cycle.indexOf(active) : -1;
      event.preventDefault();
      const next = event.shiftKey
        ? cycle[(index <= 0 ? cycle.length : index) - 1]
        : cycle[index === -1 || index === cycle.length - 1 ? 0 : index + 1];
      next?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const panel = (
    <div
      ref={panelRef}
      id={panelId}
      className="auth-menu-panel"
      hidden={!open}
      tabIndex={-1}
      aria-label="Account"
    >
      <p className="auth-menu-email" title={email}>
        {email}
      </p>
      <Link className="auth-menu-action" href="/account">Account</Link>
      {/* Native POST reloads the document. A server-action redirect to / keeps this email state. */}
      <form action={SIGN_OUT_PATH} method="post">
        <button className="auth-menu-action" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="auth-menu">
      <button
        ref={triggerRef}
        className="feedback-link auth-entry"
        type="button"
        aria-label={`Account menu for ${email}`}
        aria-expanded={open}
        aria-controls={panelId}
        onKeyDown={(event) => {
          if (event.repeat) event.preventDefault();
        }}
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound size={15} aria-hidden="true" />
        <span className="auth-entry-label">{email}</span>
      </button>
      {open && typeof document !== "undefined" ? createPortal(panel, document.body) : panel}
    </div>
  );
}
