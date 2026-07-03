import { Ruler } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/Card";
import MeasurementForm from "@/components/measurements/MeasurementForm";
import MetricCardGrid from "@/components/measurements/MetricCardGrid";
import { getMeasurementsData } from "@/lib/queries/tracking";
import { fmtDisplay, localToday } from "@/lib/dates";

export const metadata = { title: "Measurements" };
export const dynamic = "force-dynamic";

function cell(v: number | null): string {
  if (v == null) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const HISTORY_COLS = ["Weight", "BF %", "Waist", "Chest", "Shoulders", "Arms", "Thighs"];

export default async function MeasurementsPage() {
  const data = await getMeasurementsData();
  const today = localToday();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Measurements"
        subtitle={
          data.latestDate
            ? `Monthly girths, weight, and body fat · last logged ${fmtDisplay(data.latestDate)}`
            : "Monthly girths, weight, and body fat."
        }
      />

      <MeasurementForm defaultDate={today} lastValues={data.latest} />

      {data.entryCount === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No measurements logged."
          body="Log a monthly baseline — trend lines need a starting point. Same tape, same spots, first thing in the morning."
        />
      ) : (
        <>
          <MetricCardGrid metrics={data.metrics} />

          <SectionCard title="History" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                      Date
                    </th>
                    {HISTORY_COLS.map((h) => (
                      <th
                        key={h}
                        className="border-b border-border px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((row) => (
                    <tr
                      key={row.date}
                      className="border-b border-border-faint transition-colors last:border-0 hover:bg-surface-2"
                    >
                      <td className="px-5 py-3.5 text-text-2">{fmtDisplay(row.date)}</td>
                      {[
                        row.weight,
                        row.bodyFat,
                        row.waist,
                        row.chest,
                        row.shoulders,
                        row.arms,
                        row.thighs,
                      ].map((v, i) => (
                        <td
                          key={i}
                          className={`px-5 py-3.5 text-right tabular-nums ${
                            v == null ? "text-text-faint" : "text-text"
                          }`}
                        >
                          {cell(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
