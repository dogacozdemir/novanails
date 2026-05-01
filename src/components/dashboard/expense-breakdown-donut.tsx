"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { ExpenseCategorySlice } from "@/app/dashboard/actions";
import { EmptyState } from "@/components/ui/empty-state";

type Props = {
  data: ExpenseCategorySlice[];
};

/** Küçük zarif gider kırılımı (donut). */
export function ExpenseBreakdownDonut({ data }: Props) {
  const chartData = data.filter((d) => d.value > 0);

  if (!chartData.length) {
    return (
      <EmptyState
        className="py-8"
        title="Gider kategorisi yok"
        description="Bu ay için kayıtlı gider bulunmuyor."
      />
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 4, bottom: 0, left: 4, right: 4 }}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="48%"
            innerRadius={44}
            outerRadius={74}
            paddingAngle={2}
            stroke="transparent"
          >
            {chartData.map((entry) => (
              <Cell key={entry.category} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              `${Number(value ?? 0).toLocaleString("tr-TR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })} ₺`
            }
          />
          <Legend
            verticalAlign="bottom"
            height={40}
            formatter={(value) => (
              <span className="text-[11px] text-muted-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
