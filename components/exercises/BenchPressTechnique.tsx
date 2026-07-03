import Image from "next/image";
import { Card } from "@/components/ui/Card";

const FRAMES = [
  { file: "01.png", title: "Set your position", detail: "Eyes under the bar, feet planted, shoulder blades back and down." },
  { file: "02.png", title: "Lower with control", detail: "Keep wrists stacked over elbows and maintain full-body tension." },
  { file: "03.png", title: "Touch the chest", detail: "Bring the bar to the lower-mid chest without bouncing or lifting your glutes." },
  { file: "04.png", title: "Press up and back", detail: "Drive through your feet as the bar returns over the shoulders." },
];

const CUES = [
  "Retract and depress your shoulder blades.",
  "Keep your upper back and glutes on the bench.",
  "Plant your feet and maintain steady leg drive.",
  "Brace your torso with a slight natural arch.",
  "Keep wrists stacked over elbows.",
  "Lower to the lower-mid chest under control.",
  "Press upward and slightly back toward the rack.",
  "Do not bounce the bar or lift your glutes.",
];

export default function BenchPressTechnique() {
  return <Card className="overflow-hidden">
    <div className="border-b border-border-faint px-5 py-4">
      <h2 className="text-sm font-semibold text-text">Bench press technique</h2>
      <p className="mt-1 text-xs text-text-3">Proof of concept · review each position before lifting.</p>
    </div>
    <div className="grid gap-px bg-border-faint sm:grid-cols-2 xl:grid-cols-4">
      {FRAMES.map((frame, index) => <figure key={frame.file} className="bg-surface p-3">
        <div className="overflow-hidden rounded-sm bg-bg-subtle">
          <Image src={`/exercises/bench-press-frames/${frame.file}`} alt={`Bench press step ${index + 1}: ${frame.title}`} width={720} height={1165} className="h-auto w-full" sizes="(min-width: 1280px) 20vw, (min-width: 640px) 40vw, 90vw"/>
        </div>
        <figcaption className="pt-3"><p className="text-xs font-semibold uppercase tracking-wider text-accent">Step {index + 1}</p><p className="mt-1 text-sm font-semibold text-text">{frame.title}</p><p className="mt-1 text-xs leading-relaxed text-text-3">{frame.detail}</p></figcaption>
      </figure>)}
    </div>
    <div className="border-t border-border-faint p-5">
      <h3 className="text-sm font-semibold text-text">Form cues</h3>
      <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">{CUES.map(cue => <li key={cue} className="flex gap-2 text-sm text-text-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"/>{cue}</li>)}</ul>
    </div>
  </Card>;
}
