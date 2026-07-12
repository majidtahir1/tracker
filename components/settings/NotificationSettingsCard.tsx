"use client";

/**
 * Push notification preferences (settings page). Two toggles — the morning
 * brief and the Sunday streak saver. PR and wearable-reconnect pushes are
 * always on. Delivery requires the iOS app (device registers on launch).
 */
import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "@/lib/actions/settings";

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="mt-0.5 block text-xs text-text-3">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function NotificationSettingsCard({
  initial,
  deviceRegistered,
}: {
  initial: { notifyMorningBrief: boolean; notifyStreakSaver: boolean };
  deviceRegistered: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();

  const update = (next: typeof prefs) => {
    setPrefs(next);
    startTransition(async () => {
      await updateNotificationPrefs(next);
    });
  };

  return (
    <div>
      {!deviceRegistered && (
        <p className="mb-2 rounded-sm border border-border bg-surface-2 px-3 py-2 text-xs text-text-3">
          No device registered yet — open the iOS app once and allow notifications to start
          receiving pushes.
        </p>
      )}
      <div className="divide-y divide-border-faint">
        <Toggle
          label="Morning brief"
          description="Daily at 7am: recovery, today's workout, and what changed."
          checked={prefs.notifyMorningBrief}
          disabled={pending}
          onChange={(v) => update({ ...prefs, notifyMorningBrief: v })}
        />
        <Toggle
          label="Streak saver"
          description="Sunday afternoon, only when one session short of the weekly target."
          checked={prefs.notifyStreakSaver}
          disabled={pending}
          onChange={(v) => update({ ...prefs, notifyStreakSaver: v })}
        />
      </div>
      <p className="mt-2 text-xs text-text-3">
        PR alerts and wearable-reconnect alerts are always on — they only fire when something real
        happens.
      </p>
    </div>
  );
}
