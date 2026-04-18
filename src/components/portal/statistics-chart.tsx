"use client";

type DataPoint = {
  label: string;
  value: number;
};

export function StatisticsChart({
  type,
  data,
}: {
  type: "bar" | "line" | "pie";
  data: DataPoint[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[1.4rem] border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        Belum ada data yang cocok dengan filter saat ini.
      </div>
    );
  }

  if (type === "pie") {
    return <PieChart data={data} />;
  }

  if (type === "line") {
    return <LineChart data={data} />;
  }

  return <BarChart data={data} />;
}

function BarChart({ data }: { data: DataPoint[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
      <div className="flex min-h-[280px] items-end gap-4">
        {data.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
            <div className="text-sm font-semibold text-foreground">{item.value}</div>
            <div
              className="w-full rounded-t-2xl bg-primary/80 transition-all"
              style={{ height: `${Math.max((item.value / maxValue) * 180, 12)}px` }}
            />
            <div className="text-center text-xs text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: DataPoint[] }) {
  const width = 680;
  const height = 240;
  const padding = 24;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
    const y = height - padding - (item.value / maxValue) * (height - padding * 2);

    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
      <svg viewBox={`0 0 ${width} ${height + 48}`} className="w-full">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="4" className="text-primary" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="6" className="fill-primary" />
            <text x={point.x} y={height + 20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {point.label}
            </text>
            <text x={point.x} y={point.y - 12} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
              {point.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PieChart({ data }: { data: DataPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const colors = ["#2563eb", "#0f766e", "#ea580c", "#7c3aed", "#dc2626", "#0891b2"];
  const segments = data.reduce<
    {
      label: string;
      value: number;
      color: string;
      path: string;
    }[]
  >((items, item, index) => {
    const previousValue = items.reduce((sum, entry) => sum + entry.value, 0);
    const startAngle = (previousValue / total) * Math.PI * 2 - Math.PI / 2;
    const nextValue = previousValue + item.value;
    const endAngle = (nextValue / total) * Math.PI * 2 - Math.PI / 2;
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
    const radius = 90;
    const center = 110;
    const startX = center + radius * Math.cos(startAngle);
    const startY = center + radius * Math.sin(startAngle);
    const endX = center + radius * Math.cos(endAngle);
    const endY = center + radius * Math.sin(endAngle);
    const path = [
      `M ${center} ${center}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      "Z",
    ].join(" ");

    items.push({
      label: item.label,
      value: item.value,
      color: colors[index % colors.length],
      path,
    });

    return items;
  }, []);

  return (
    <div className="grid gap-6 rounded-[1.4rem] border border-border bg-card/80 p-5 md:grid-cols-[280px_1fr] md:items-center">
      <svg viewBox="0 0 220 220" className="mx-auto h-[240px] w-[240px]">
        {segments.map((segment) => (
          <path key={segment.label} d={segment.path} fill={segment.color} />
        ))}
      </svg>

      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-sm text-foreground">{segment.label}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
