import { createRoot } from "react-dom/client";
import { useReducer } from "react";

import { filterReducer, initialFilterState } from "@/components/job-board/filter-model";
import { useAccountBoard } from "@/components/job-board/use-account-board";

import { accountReads } from "./stubs/signed-in-account";

const root = document.getElementById("root");
if (!root) throw new Error("missing account board harness root");

Object.assign(window, { accountReads });

function Harness() {
  const [filters, dispatch] = useReducer(filterReducer, initialFilterState);
  const account = useAccountBoard(filters, dispatch);

  return (
    <>
      <p>{account.savedIds.size} saved, {account.viewedIds.size} viewed</p>
      <button
        type="button"
        onClick={() => {
          // The board rewrites the query string for every filter change.
          window.history.replaceState(null, "", "?q=Intune");
          dispatch({ type: "setQuery", value: "Intune" });
        }}
      >
        Search Intune
      </button>
    </>
  );
}

createRoot(root).render(<Harness />);
