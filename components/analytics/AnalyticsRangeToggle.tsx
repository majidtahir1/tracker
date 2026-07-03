"use client";

/** Wires the shared RangeToggle to the ?range= searchParam (server refetch). */
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import RangeToggle from "@/components/ui/RangeToggle";

export default function AnalyticsRangeToggle({ active }: { active: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className={isPending ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <RangeToggle
        options={["4W", "12W", "All"]}
        active={active}
        onChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("range", value);
          startTransition(() => router.replace(`/analytics?${params.toString()}`, { scroll: false }));
        }}
      />
    </div>
  );
}
