"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import Button from "@/components/ui/Button";

export default function PushPermissionButton() {
  const [status, setStatus] = useState<"idle" | "pending" | "enabled" | "denied" | "error">("idle");

  async function enable() {
    if (!Capacitor.isNativePlatform()) {
      setStatus("error");
      return;
    }
    setStatus("pending");
    try {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== "granted") {
        setStatus("denied");
        return;
      }
      const handle = await PushNotifications.addListener("registration", async (token) => {
        await fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.value, platform: "ios" }),
        });
        setStatus("enabled");
        await handle.remove();
      });
      await PushNotifications.register();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mb-4 rounded-sm border border-border bg-surface-2 px-3 py-3">
      <p className="text-sm font-medium text-text">Enable notifications on this iPhone</p>
      <p className="mt-1 text-xs leading-5 text-text-3">
        Progression can send your morning training brief, a weekly streak reminder, personal
        records, and wearable reconnection alerts. You can change this later in iOS Settings.
      </p>
      <Button className="mt-3" size="sm" onClick={enable} disabled={status === "pending" || status === "enabled"}>
        <Bell className="size-4" strokeWidth={2} />
        {status === "pending" ? "Enabling..." : status === "enabled" ? "Notifications enabled" : "Enable notifications"}
      </Button>
      {status === "denied" && <p className="mt-2 text-xs text-warning">Permission was declined. Enable notifications for Progression in iOS Settings.</p>}
      {status === "error" && <p className="mt-2 text-xs text-text-3">Open this setting in the Progression iOS app.</p>}
    </div>
  );
}
