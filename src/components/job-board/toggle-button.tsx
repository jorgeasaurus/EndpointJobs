import type { ReactNode } from "react";

export function ToggleButton({
  activeClassName,
  children,
  inactiveClassName,
  isActive,
  onClick
}: {
  activeClassName: string;
  children: ReactNode;
  inactiveClassName: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const className = isActive ? activeClassName : inactiveClassName;

  if (isActive) {
    return (
      <button
        className={className}
        type="button"
        aria-pressed="true"
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      className={className}
      type="button"
      aria-pressed="false"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
