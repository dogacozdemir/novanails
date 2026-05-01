"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { StaffSlice } from "@/app/dashboard/actions";
import { EmptyState } from "@/components/ui/empty-state";

type Props = {
  data: StaffSlice[];
};

export function StaffRevenuePie({ data }: Props) {
  const chartData = data.filter((d) => d.value > 0);

  if (!chartData.length) {
    return (
      <EmptyState
        className="py-10"
        title="Henüz bir kayıt yok"
        description="Bu ay için uzman bazlı gelir kaydı bulunmuyor."
      />
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={100}
            paddingAngle={2}
            stroke="transparent"
          >
            {chartData.map((entry) => (
              <Cell key={entry.staffId} fill={entry.fill} />
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
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
