import {
  Apple,
  CalendarDays,
  ClipboardList,
  Camera,
  ChartLine,
  Dumbbell,
  HeartPulse,
  History,
  LayoutDashboard,
  Library,
  Ruler,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** All routes, sidebar order. Icons per DESIGN.md §6 (ChartLine = lucide's
 * current name for the LineChart icon). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workout", label: "Next Workout", icon: Dumbbell },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/history", label: "History", icon: History },
  { href: "/exercises", label: "Exercises", icon: Library },
  { href: "/records", label: "Records", icon: Trophy },
  { href: "/measurements", label: "Measurements", icon: Ruler },
  { href: "/photos", label: "Photos", icon: Camera },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/recovery", label: "Recovery", icon: HeartPulse },
  { href: "/analytics", label: "Analytics", icon: ChartLine },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Target },
];

/** The 4 fixed mobile tabs (5th slot is "More"). */
export const MOBILE_NAV_HREFS = ["/", "/workout", "/analytics", "/calendar"];
