"use client";

import { useState } from "react";

export default function SetCountControl({ name, initial }: { name: string; initial: number }) {
  const [count, setCount] = useState(initial);
  return <div>
    <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-3">Working sets</span>
    <input type="hidden" name={name} value={count}/>
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: count }, (_, i) => <span key={i} className="rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm text-text">Set {i + 1}</span>)}
      <button type="button" onClick={() => setCount(c => c + 1)} className="rounded-sm border border-accent/40 px-3 py-2 text-sm text-accent hover:bg-accent-muted">+ Add set</button>
      {count > 1 && <button type="button" onClick={() => setCount(c => c - 1)} className="px-2 py-2 text-sm text-text-3 hover:text-danger">Remove last</button>}
    </div>
  </div>;
}
