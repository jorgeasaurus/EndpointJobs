import { createRoot } from "react-dom/client";

import { AuthMenu } from "../../../src/components/auth/auth-menu";

const root = document.getElementById("root");
if (!root) throw new Error("missing sign-in dialog harness root");

createRoot(root).render(<AuthMenu />);
