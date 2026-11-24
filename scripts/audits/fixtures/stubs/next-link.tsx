import type { MouseEventHandler, ReactNode } from "react";

type LinkProps = {
  href: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children?: ReactNode;
};

/** `next/link` as a plain anchor, for harness bundles that run outside Next. */
export default function Link({ href, className, onClick, children }: LinkProps) {
  return (
    <a className={className} href={href} onClick={onClick}>
      {children}
    </a>
  );
}
