"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export default function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeAccount() {
    setPending(true);
    setError(null);
    const result = await authClient.deleteUser({ password });
    if (result.error) {
      setError(result.error.message ?? "Account deletion failed.");
      setPending(false);
      return;
    }
    window.location.href = "/login?deleted=1";
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text">Delete account</p>
          <p className="mt-1 text-xs text-text-3">Permanently remove your account and stored data.</p>
        </div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" strokeWidth={2} /> Delete
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-danger">This cannot be undone</p>
        <p className="mt-1 text-xs leading-5 text-text-3">
          Your workouts, measurements, nutrition, recovery data, progress photos, wearable
          connections, notification tokens, and account credentials will be permanently deleted.
        </p>
      </div>
      <div className="grid gap-3 sm:max-w-md">
        <label className="text-xs font-medium text-text-3" htmlFor="delete-password">
          Confirm your password
        </label>
        <input
          id="delete-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
        />
        <label className="text-xs font-medium text-text-3" htmlFor="delete-confirmation">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoCapitalize="characters"
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button
          variant="danger"
          disabled={pending || password.length === 0 || confirmation !== "DELETE"}
          onClick={removeAccount}
        >
          {pending ? "Deleting..." : "Permanently delete account"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
