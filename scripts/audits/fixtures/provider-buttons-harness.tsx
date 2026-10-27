import { createRoot } from "react-dom/client";

import { AuthProviderButtons } from "../../../src/components/auth/auth-provider-buttons";
import { signInStartError } from "../../../src/lib/auth/start-provider-sign-in";

const root = document.getElementById("root");
if (!root) throw new Error("missing provider button harness root");

createRoot(root).render(
  <div className="landing-sign-in">
    <AuthProviderButtons start={async () => signInStartError} />
  </div>
);
