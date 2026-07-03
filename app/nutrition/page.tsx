import { Apple, ChartLine } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/Card";
import ChartCard from "@/components/ui/ChartCard";
import ProgressBar from "@/components/ui/ProgressBar";
import NutritionForm from "@/components/nutrition/NutritionForm";
import NutritionTrendChart from "@/components/nutrition/NutritionTrendChart";
import { getNutritionData } from "@/lib/queries/tracking";
import { fmtDisplay, localToday } from "@/lib/dates";

export const metadata = { title: "Nutrition" };
export const dynamic = "force-dynamic";

function n(v: number | null): string {
  return v == null ? "—" : v.toLocaleString();
}

export default async function NutritionPage() {
  const today = localToday();
  const data = await getNutritionData(today);
  const { weekAvg } = data;

  const proteinToday = data.today.protein ?? 0;
  const proteinPct = data.proteinTargetG > 0 ? (proteinToday / data.proteinTargetG) * 100 : 0;
  const caloriesToday = data.today.calories ?? 0;
  const caloriesPct = data.calorieTarget > 0 ? (caloriesToday / data.calorieTarget) * 100 : 0;

  const avgStats: Array<{ label: string; value: string; warn?: boolean }> = [
    {
      label: "Calories",
      value: weekAvg.calories == null ? "—" : `${weekAvg.calories.toLocaleString()}`,
    },
    {
      label: "Protein",
      value: weekAvg.protein == null ? "—" : `${weekAvg.protein} g`,
      warn: weekAvg.protein != null && weekAvg.protein < data.proteinTargetG,
    },
    { label: "Carbs", value: weekAvg.carbs == null ? "—" : `${weekAvg.carbs} g` },
    { label: "Fat", value: weekAvg.fat == null ? "—" : `${weekAvg.fat} g` },
    { label: "Fiber", value: weekAvg.fiber == null ? "—" : `${weekAvg.fiber} g` },
    { label: "Water", value: weekAvg.waterOz == null ? "—" : `${weekAvg.waterOz} oz` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nutrition"
        subtitle={`Daily calories, macros, and water · targets ${data.calorieTarget.toLocaleString()} kcal / ${data.proteinTargetG} g protein`}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={data.today.logged ? "Today — quick edit" : "Log today"}>
          <NutritionForm today={data.today} />
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Today vs targets">
            <div className="space-y-5">
              <ProgressBar
                label="Protein"
                valueLabel={`${proteinToday} / ${data.proteinTargetG} g`}
                pct={proteinPct}
              />
              <ProgressBar
                label="Calories"
                valueLabel={`${caloriesToday.toLocaleString()} / ${data.calorieTarget.toLocaleString()} kcal`}
                pct={caloriesPct}
              />
              {!data.today.logged && (
                <p className="text-xs text-text-3">
                  Nothing logged yet today. Log protein before 8 PM and skip the reminder.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={`This week avg · ${weekAvg.daysLogged}/7 days logged`}
          >
            <div className="grid grid-cols-3 gap-x-4 gap-y-5">
              {avgStats.map((s) => (
                <div key={s.label}>
                  <div className="text-xs font-medium uppercase tracking-wider text-text-3">
                    {s.label}
                  </div>
                  <div
                    className={`mt-1 font-display text-lg font-semibold tabular-nums ${
                      s.warn ? "text-warning" : "text-text"
                    }`}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Last 7 days" flush>
        {data.totalLogged === 0 ? (
          <EmptyState
            icon={Apple}
            title="Nothing logged yet."
            body={`Protein target is ${data.proteinTargetG} g. First entry takes 20 seconds — the trends take care of themselves.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                    Day
                  </th>
                  {["Calories", "Protein", "Carbs", "Fat", "Fiber", "Water"].map((h) => (
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
                {data.week.map((day) => (
                  <tr
                    key={day.date}
                    className="border-b border-border-faint transition-colors last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-5 py-3.5 text-text-2">
                      {day.date === today ? "Today" : fmtDisplay(day.date)}
                    </td>
                    {[day.calories, day.protein, day.carbs, day.fat, day.fiber, day.waterOz].map(
                      (v, i) => (
                        <td
                          key={i}
                          className={`px-5 py-3.5 text-right tabular-nums ${
                            v == null
                              ? "text-text-faint"
                              : i === 1 && v < data.proteinTargetG
                                ? "text-warning"
                                : "text-text"
                          }`}
                        >
                          {n(v)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ChartCard
        title="Calories & protein — last 30 days"
        legend={[
          { label: "Calories", colorVar: "--color-chart-1" },
          { label: "Protein", colorVar: "--color-chart-2" },
        ]}
      >
        {data.trend.length >= 2 ? (
          <NutritionTrendChart data={data.trend} />
        ) : (
          <EmptyState
            chart
            icon={ChartLine}
            title="Not enough data for a trend."
            body="Two logged days draw the first line."
          />
        )}
      </ChartCard>
    </div>
  );
}
