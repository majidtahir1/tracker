"use client";

/** TEMPORARY instrumented registrar — reports each step to /api/push/debug. */
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

function report(step: string, detail?: unknown) {
  try {
    void fetch("/api/push/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, detail: detail == null ? null : String(JSON.stringify(detail)).slice(0, 300) }),
    });
  } catch {}
}

async function registerToken(token: string) {
  try {
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: "ios" }),
    });
    report("register-post", { status: res.status });
  } catch (err) {
    report("register-post-failed", String(err));
  }
}

export default function PushRegistrar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    report("start");

    let registrationHandle: { remove: () => void } | undefined;
    let errorHandle: { remove: () => void } | undefined;

    (async () => {
      try {
        const permission = await PushNotifications.requestPermissions();
        report("permission", permission);
        if (permission.receive !== "granted") return;

        registrationHandle = await PushNotifications.addListener("registration", (token) => {
          report("registration-event", { len: token.value?.length });
          void registerToken(token.value);
        });
        errorHandle = await PushNotifications.addListener("registrationError", (err) => {
          report("registration-error", err);
        });

        await PushNotifications.register();
        report("register-called");
      } catch (err) {
        report("setup-failed", String(err));
      }
    })();

    return () => {
      registrationHandle?.remove();
      errorHandle?.remove();
    };
  }, []);

  return null;
}
