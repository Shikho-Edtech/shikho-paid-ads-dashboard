"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import type { DailySpend } from "@/lib/types";
import { CHANNEL_COLOR } from "@/lib/colors";
import { fmtUSD } from "@/lib/aggregate";

interface Props {
  data: DailySpend[];
}

export default function SpendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-ink-muted py-8 text-center">
        No daily spend in the selected window yet.
      </div>
    );
  }
  return (
    <div className="w-full h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#646A7E" }}
            tickFormatter={(d) => d.slice(5)} // MM-DD
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#646A7E" }}
            tickFormatter={(v) => fmtUSD(v)}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            cursor={{ fill: "rgba(48, 64, 144, 0.04)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #DCDFE6",
              fontSize: 12,
            }}
            formatter={(v: number, name: string) => [fmtUSD(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar
            dataKey="meta"
            stackId="spend"
            fill={CHANNEL_COLOR.meta}
            name="Meta"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="google"
            stackId="spend"
            fill={CHANNEL_COLOR.google}
            name="Google"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
