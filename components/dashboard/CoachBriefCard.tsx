"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getLatestCoachBrief } from "@/lib/actions/dashboard-coach";
import type { CoachBriefData } from "@/lib/ai/dashboard-coach";

export default function CoachBriefCard() {
  const [brief, setBrief] = useState<CoachBriefData | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { let active = true; getLatestCoachBrief().then((value) => { if (active) { setBrief(value); setLoaded(true); } }); return () => { active = false; }; }, []);
  if (loaded && !brief) return null;
  return <Card className="border-accent-border bg-accent-muted p-5">
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-text"><Sparkles className="size-4" strokeWidth={2}/></span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Coach brief</p>
        {!loaded ? <p className="mt-2 text-sm text-text-3">Reviewing your last workout…</p> : <><h2 className="mt-1 text-lg font-semibold text-text">{brief?.headline}</h2><p className="mt-2 text-sm leading-relaxed text-text-2">{brief?.message}</p><p className="mt-2 text-sm font-medium text-text">{brief?.encouragement}</p>{brief?.source === "deterministic" && <p className="mt-2 text-[11px] text-text-faint">Local coaching fallback</p>}</>}
      </div>
    </div>
  </Card>;
}
