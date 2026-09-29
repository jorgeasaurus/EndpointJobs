"use client";

import { useEffect, useRef } from "react";

import { siteUrl } from "@/app/site-metadata";

export function AppreciateButton() {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // The widget mutates its own attributes; mount after React hydrates its host.
    const button = document.createElement("appreciate-button");
    button.dataset.key = "pk_8645244f778c5c051940ebd5447377ac";
    button.dataset.api = "https://appreciate-button.com";
    button.dataset.item = siteUrl;
    button.dataset.label = "Appreciate this board";
    button.dataset.count = "right";
    container.append(button);

    return () => button.remove();
  }, []);

  return (
    <div className="footer-appreciation">
      <span>Appreciate this board</span>
      <span className="appreciate-button-host" ref={containerRef} />
    </div>
  );
}
