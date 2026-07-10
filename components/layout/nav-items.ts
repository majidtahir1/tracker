import {
  ClipboardList,
  ChartLine,
  Dumbbell,
  HeartPulse,
  History,
  LayoutDashboard,
  Library,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Routes shown in the nav, sidebar order. Icons per DESIGN.md §6 (ChartLine
 * = lucide's current name for the LineChart icon).
 * Measurements, Photos, Nutrition, Calendar, and Goals are hidden from the
 * nav (2026-07-10) — the routes still exist and deep links keep working. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workout", label: "Next Workout", icon: Dumbbell },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/history", label: "History", icon: History },
  { href: "/exercises", label: "Exercises", icon: Library },
  { href: "/records", label: "Records", icon: Trophy },
  { href: "/recovery", label: "Recovery", icon: HeartPulse },
  { href: "/analytics", label: "Analytics", icon: ChartLine },
];

/** The 4 fixed mobile tabs (5th slot is "More"). */
export const MOBILE_NAV_HREFS = ["/", "/workout", "/history", "/analytics"];
