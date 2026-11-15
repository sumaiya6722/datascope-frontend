import { Suspense } from "react";
import DataExplorer from "../../../../../components/data-explorer.js";

export default function DataExplorerPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-6 py-16 text-slate-400">Loading Data Explorer...</main>}>
      <DataExplorer />
    </Suspense>
  );
}
