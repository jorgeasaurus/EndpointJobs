import type { Route } from "next";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

export function ToggleButton({
  activeClassName,
  children,
  href,
  inactiveClassName,
  isActive,
  onClick
}: {
  activeClassName: string;
  children: ReactNode;
  href?: Route;
  inactiveClassName: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const className = isActive ? activeClassName : inactiveClassName;

  if (!href) {
    return (
      <button
        className={className}
        type="button"
        aria-pressed={isActive ? "true" : "false"}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={className}
      href={href}
      onClick={(event) => {
        if (shouldFollowHref(event)) {
          return;
        }

        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </Link>
  );
}

function shouldFollowHref(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
