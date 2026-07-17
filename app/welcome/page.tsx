import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Dumbbell,
  LineChart,
  Lock,
  MessageSquareText,
  Sparkles,
  Wand2,
} from "lucide-react";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { absolute: "Progression — Train with intent" },
  description:
    "An AI coach that reads your training and your recovery. Plans every set, progresses every weight, and keeps the progress honest. Coming soon to the App Store.",
};
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Daily coach brief",
    body: "Every morning the AI coach reads yesterday's training and today's recovery, then tells you whether to push or back off.",
  },
  {
    icon: MessageSquareText,
    title: "Set-by-set coaching",
    body: "In-workout coaching between sets, with next-weight recommendations grounded in what you just lifted.",
  },
  {
    icon: Wand2,
    title: "AI program designer",
    body: "Answer a few questions, get a 13-week plan with phases and a deload. Refine it in chat until it's yours.",
  },
  {
    icon: LineChart,
    title: "Computed insights",
    body: "PRs detected automatically. Strength trends on your main lifts, weekly volume vs muscle targets, streaks.",
  },
  {
    icon: Activity,
    title: "WHOOP + Fitbit",
    body: "Optional wearable integration. Sleep, strain, and recovery feed the coaching — rough nights change the plan.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "No ads, no social feed, no selling your data. Delete your account and everything with it, in-app, any time.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick or build a program",
    body: "Start with the ready-made upper/lower split, build your own from the exercise catalog, or let the AI coach design one.",
  },
  {
    n: "02",
    title: "Log workouts",
    body: "Every exercise arrives with sets, rep ranges, effort targets, and rest. Weights progress automatically as you log.",
  },
  {
    n: "03",
    title: "Stay honest",
    body: "Insights and daily coaching keep the plan honest and the progress visible, week after week.",
  },
];

const SHOTS = [
  { src: "/marketing/01-dashboard.png", alt: "Progression dashboard showing today's workout and recovery" },
  { src: "/marketing/02-set-coach.png", alt: "In-workout set logging with AI next-weight coaching" },
  { src: "/marketing/04-insights.png", alt: "Computed training insights: strength trends and PRs" },
];

export default async function WelcomePage() {
  if (await getSessionUser()) redirect("/");
  return (
    <div className="force-dark min-h-dvh bg-bg text-text-2">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Dumbbell className="size-5 text-accent" strokeWidth={2} />
          <span className="font-display text-base font-semibold tracking-[0.18em] text-text">
            PROGRESSION
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-sm px-3 py-2 text-sm font-medium text-text-2 hover:text-text"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-sm bg-accent px-3.5 py-2 text-sm font-medium text-accent-text hover:bg-accent-hover"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-24">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.3em] text-accent">
            Progression
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-text sm:text-6xl">
            Train with intent.
            <br />
            Every set has a target.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-text-2 sm:text-lg sm:leading-8">
            An AI coach that reads your training and your recovery — plans every
            set, progresses every weight, and keeps the progress honest.
          </p>
          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-sm border border-border bg-surface px-4 py-2.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              <span className="text-sm font-medium text-text">Coming soon to the App Store</span>
              <span className="rounded-xs border border-accent-border bg-accent-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-accent">
                In review
              </span>
            </div>
            <Link
              href="/signup"
              className="rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-accent-text hover:bg-accent-hover"
            >
              Use it on the web →
            </Link>
          </div>
          <p className="mt-10 font-mono text-[11px] uppercase tracking-wider text-text-3">
            WK 05 · UPPER A — BENCH PRESS 4 × 8–12 · RPE 8 · 82.5 KG{" "}
            <span className="text-accent">→ 85 KG NEXT</span>
          </p>
        </div>
      </section>

      {/* Screenshots */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[760px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[110px]"
        />
        <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-6 px-5 py-10 sm:grid-cols-3 sm:gap-5 sm:py-16">
          {SHOTS.map((shot, i) => (
            <div
              key={shot.src}
              className={`overflow-hidden rounded-lg border border-border-strong bg-surface shadow-raise ${
                i === 1 ? "sm:-translate-y-6" : "sm:translate-y-2"
              }`}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={640}
                height={1384}
                sizes="(max-width: 640px) 90vw, 320px"
                priority
                className="h-auto w-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.3em] text-accent">
          What it does
        </p>
        <h2 className="mt-4 max-w-2xl font-display text-2xl font-semibold tracking-tight text-text sm:text-4xl">
          Built for people who take building muscle seriously.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-md border border-border bg-surface p-5">
              <f.icon className="size-5 text-accent" strokeWidth={1.75} />
              <h3 className="mt-4 font-display text-base font-semibold text-text">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-2">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-bg-subtle">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.3em] text-accent">
            How it works
          </p>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="font-mono text-sm font-medium text-accent">{s.n}</p>
                <h3 className="mt-3 font-display text-lg font-semibold text-text">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-2">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:py-24">
        <h2 className="mx-auto max-w-2xl font-display text-2xl font-semibold tracking-tight text-text sm:text-4xl">
          First program or fifteenth cycle — the plan stays honest.
        </h2>
        <div className="mt-8 flex items-center justify-center">
          <Link
            href="/signup"
            className="rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-text hover:bg-accent-hover"
          >
            Start training on the web →
          </Link>
        </div>
        <p className="mt-4 text-xs text-text-3">Free account. iOS app coming soon.</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center">
          <p className="text-xs text-text-3">© 2026 Progression</p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <Link href="/privacy" className="text-text-3 hover:text-text">Privacy</Link>
            <Link href="/support" className="text-text-3 hover:text-text">Support</Link>
            <Link href="/login" className="text-text-3 hover:text-text">Sign in</Link>
            <Link href="/signup" className="text-text-3 hover:text-text">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
