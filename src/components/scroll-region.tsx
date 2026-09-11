"use client";

import { useCallback, useRef, useSyncExternalStore, type ReactNode } from "react";

/** Only scrollable content needs a keyboard focus stop for arrow-key scrolling. */
export function ScrollRegion({
  as = "section",
  children,
  className,
  label
}: {
  as?: "section" | "pre";
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const regionRef = useRef<HTMLElement>(null);
  const subscribe = useCallback((onChange: () => void) => {
    const region = regionRef.current;
    if (!region) return () => {};

    const observer = new ResizeObserver(onChange);
    observer.observe(region);
    for (const child of region.children) observer.observe(child);
    const mutations = new MutationObserver(() => {
      for (const child of region.children) observer.observe(child);
      onChange();
    });
    mutations.observe(region, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
  const getSnapshot = useCallback(() => {
    const region = regionRef.current;
    return !!region && (
      region.scrollWidth > region.clientWidth || region.scrollHeight > region.clientHeight
    );
  }, []);
  const scrollable = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const tabIndex = scrollable ? 0 : undefined;

  if (as === "pre") {
    return (
      <pre
        ref={(node) => { regionRef.current = node; }}
        aria-label={label}
        className={className}
        role="region"
        tabIndex={tabIndex}
      >
        {children}
      </pre>
    );
  }

  return (
    <section ref={regionRef} aria-label={label} className={className} tabIndex={tabIndex}>
      {children}
    </section>
  );
}
