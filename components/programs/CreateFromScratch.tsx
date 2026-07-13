"use client";

/**
 * Secondary path on /programs: a quiet "create one from scratch" link that
 * expands into the manual name/description form. The primary path is the AI
 * Program Builder — the bare form used to sit at the top of the page and
 * read as required.
 */
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createProgram } from "@/lib/actions/programs";

export default function CreateFromScratch() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <p className="text-sm text-text-3">
        Prefer to plan every day yourself?{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-accent hover:underline"
        >
          Create a program from scratch
        </button>
        .
      </p>
    );
  }

  return (
    <Card className="p-5">
      <form action={createProgram} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input name="name" placeholder="Program name" required autoFocus />
        <Input name="description" placeholder="Description (optional)" />
        <div className="flex gap-2">
          <Button>Create program</Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
