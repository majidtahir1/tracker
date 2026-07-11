"use client";

/**
 * components/layout/PullToRefresh.tsx — native-feeling pull-to-refresh for the
 * iOS shell (and mobile web). Pulling down while the page is scrolled to the
 * top shows an indicator; releasing past the threshold calls router.refresh(),
 * re-fetching all server-component data without a full page reload.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDown } from "lucide-react";

const THRESHOLD = 70; // px of (dampened) pull that triggers a refresh
const MAX_PULL = 100;

/** True when some scrollable ancestor of the touch target is scrolled down —
 * pulling inside it should scroll it, never trigger the page refresh. */
function innerScrolled(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return true;
    el = el.parentElement;
  }
  return false;
}

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing || innerScrolled(e.target)) return;
      startYRef.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startYRef.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      // Dampen the drag so the indicator feels weighted, like the native control.
      setPull(Math.min(dy * 0.45, MAX_PULL));
      if (dy > 12 && e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      if (startYRef.current == null) return;
      startYRef.current = null;
      setPull((p) => {
        if (p >= THRESHOLD && !refreshing) {
          setRefreshing(true);
          startTransition(() => router.refresh());
        }
        return 0;
      });
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing, router]);

  // The refresh is done when the transition settles; retire the spinner.
  useEffect(() => {
    if (refreshing && !isPending) {
      const t = window.setTimeout(() => setRefreshing(false), 150);
      return () => window.clearTimeout(t);
    }
  }, [refreshing, isPending]);

  const visible = pull > 8 || refreshing;
  const armed = pull >= THRESHOLD;
  const offset = refreshing ? 44 : Math.min(pull, MAX_PULL) * 0.6;

  return (
    <>
      <div
        aria-hidden={!refreshing}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          transform: `translateY(${visible ? offset : -40}px)`,
          opacity: visible ? 1 : 0,
          transition: startYRef.current == null ? "transform 200ms ease, opacity 200ms ease" : "opacity 120ms ease",
        }}
      >
        <span className="grid size-9 place-items-center rounded-full border border-border bg-surface shadow-[var(--shadow-raise)]">
          {refreshing ? (
            <Loader2 className="size-4 animate-spin text-accent" strokeWidth={2} />
          ) : (
            <ArrowDown
              className={`size-4 transition-transform duration-150 ${armed ? "rotate-180 text-accent" : "text-text-3"}`}
              strokeWidth={2}
            />
          )}
        </span>
      </div>
      {children}
    </>
  );
}
