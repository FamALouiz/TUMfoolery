'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from 'recharts';

interface SparklineChartProps {
  data: { time: number; price: number }[];
  id: string;
}

export default function SparklineChart({ data, id }: SparklineChartProps) {
  const chartData = data.map((point) => ({
    time: point.time,
    price: point.price,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis hide={true} />
        <YAxis hide={true} />
        <Area
          type="monotone"
          dataKey="price"
          stroke="#ffffff"
          strokeWidth={2}
          fill={`url(#gradient-${id})`}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

