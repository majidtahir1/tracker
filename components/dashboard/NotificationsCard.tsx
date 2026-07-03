/**
 * Dashboard notifications list (DESIGN.md §3.12 list-item recipe, §4.1 item 5).
 * Server component — mark-as-read wires through server actions in plain forms.
 */
import Link from "next/link";
import {
  BatteryLow,
  Bell,
  Check,
  HeartPulse,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { SectionCard } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { DashboardNotification } from "@/lib/queries/dashboard";
import type { NotificationType } from "@/lib/generated/prisma/enums";

const ICON_STYLES: Record<NotificationType, { icon: LucideIcon; classes: string }> = {
  PROGRESSION: { icon: TrendingUp, classes: "bg-accent-muted text-accent" },
  DELOAD_UPCOMING: { icon: BatteryLow, classes: "bg-info-muted text-info" },
  DELOAD_ACTIVE: { icon: BatteryLow, classes: "bg-info-muted text-info" },
  PHOTO_REMINDER: { icon: Bell, classes: "bg-warning-muted text-warning" },
  MEASUREMENT_REMINDER: { icon: Bell, classes: "bg-warning-muted text-warning" },
  NUTRITION_REMINDER: { icon: Bell, classes: "bg-warning-muted text-warning" },
  PR_ACHIEVED: { icon: Trophy, classes: "bg-accent-muted text-accent" },
  FATIGUE_WARNING: { icon: HeartPulse, classes: "bg-danger-muted text-danger" },
};

export default function NotificationsCard({
  notifications,
  unreadCount,
}: {
  notifications: DashboardNotification[];
  unreadCount: number;
}) {
  return (
    <SectionCard
      title={unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications"}
      flush
      action={
        unreadCount > 0 ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="text-xs font-medium text-text-3 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-xs"
            >
              Mark all read
            </button>
          </form>
        ) : undefined
      }
    >
      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="All quiet."
          body="Progression calls, deload notices and reminders show up here as you train."
        />
      ) : (
        <ul>
          {notifications.map((n) => {
            const style = ICON_STYLES[n.type] ?? ICON_STYLES.PHOTO_REMINDER;
            const Icon = style.icon;
            return (
              <li
                key={n.id}
                className="flex gap-3 px-5 py-4 border-b border-border-faint last:border-0 hover:bg-surface-2 transition-colors"
              >
                {!n.read && (
                  <span className="size-1.5 rounded-full bg-accent self-center shrink-0" />
                )}
                <span
                  className={`size-8 shrink-0 rounded-sm grid place-items-center ${style.classes}`}
                >
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="text-sm font-semibold text-text hover:text-accent transition-colors"
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-text">{n.title}</p>
                  )}
                  {n.body && <p className="mt-0.5 text-xs text-text-3">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-text-faint">{n.timeLabel}</p>
                </div>
                {!n.read && (
                  <form action={markNotificationRead} className="self-center shrink-0">
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      title="Mark as read"
                      aria-label={`Mark "${n.title}" as read`}
                      className="size-8 rounded-sm border border-border grid place-items-center text-text-3 hover:bg-surface-2 hover:text-text hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Check className="size-4" strokeWidth={2} />
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
