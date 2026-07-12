"use client";

/**
 * PushRegistrar — mounted once for authenticated users (see app/layout.tsx).
 * On the native iOS shell it requests notification permission, registers
 * with APNs via Capacitor, and forwards the resulting device token to
 * /api/push/register. Renders nothing. No-op on web (Capacitor.isNativePlatform()
 * is false in the browser), so this is safe to mount unconditionally for
 * authed users.
 */
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

async function registerToken(token: string) {
  try {
    await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: "ios" }),
    });
  } catch (err) {
    console.error("[push] failed to register device token", err);
  }
}

export default function PushRegistrar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let registrationHandle: { remove: () => void } | undefined;
    let errorHandle: { remove: () => void } | undefined;

    (async () => {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted") return;

        registrationHandle = await PushNotifications.addListener("registration", (token) => {
          void registerToken(token.value);
        });
        errorHandle = await PushNotifications.addListener("registrationError", (err) => {
          console.error("[push] registration error", err);
        });

        await PushNotifications.register();
      } catch (err) {
        console.error("[push] setup failed", err);
      }
    })();

    return () => {
      registrationHandle?.remove();
      errorHandle?.remove();
    };
  }, []);

  return null;
}
