import { UserRound } from "lucide-react";
import Link from "next/link";

import { SIGN_OUT_PATH } from "@/lib/auth/sign-out-navigation";

export function AccountMenu({ email }: { email: string }) {
  return (
    <details className="auth-menu">
      <summary className="feedback-link auth-entry" aria-label={`Account menu for ${email}`}>
        <UserRound size={15} aria-hidden="true" />
        <span className="auth-entry-label">{email}</span>
      </summary>
      <div className="auth-menu-panel">
        <p className="auth-menu-email">{email}</p>
        <Link className="auth-menu-action" href="/account">Account</Link>
        <form action={SIGN_OUT_PATH} method="post">
          <button className="auth-menu-action" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
