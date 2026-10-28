/** Dependency-free charts (CSS/SVG) with text alternatives. */

export function BarList({ items, color = "#2a3fd6" }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((n, i) => n + i.value, 0);
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="shrink-0 tabular-nums text-gray-500">
              {i.value}
              {total > 0 && ` (${Math.round((i.value / total) * 100)}%)`}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface DayPoint {
  date: string;
  views: number;
  starts: number;
  completed: number;
}

/** Grouped bars per day: views, conversations started, completed. */
export function DailyChart({ data, labels = ["Views", "Started", "Completed"] }: { data: DayPoint[]; labels?: [string, string, string] }) {
  const H = 140;
  const max = Math.max(1, ...data.flatMap((d) => [d.views, d.starts, d.completed]));
  const bw = data.length > 45 ? 3 : data.length > 20 ? 5 : 8;
  const gap = 4;
  const group = bw * 3 + gap;
  const W = Math.max(300, data.length * group);
  const series: [keyof DayPoint, string][] = [["views", "#c3cbf7"], ["starts", "#6f7eea"], ["completed", "#2a3fd6"]];
  const total = (k: "views" | "starts" | "completed") => data.reduce((n, d) => n + d[k], 0);
  return (
    <figure>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-44 w-full min-w-[300px]" role="img" aria-label={`Daily activity. ${total("views")} views, ${total("starts")} conversations started, ${total("completed")} completed.`} preserveAspectRatio="none">
          <line x1="0" x2={W} y1={H} y2={H} stroke="#e5e7eb" />
          {data.map((d, i) => (
            <g key={d.date} transform={`translate(${i * group},0)`}>
              <title>{`${d.date}: ${d.views} views, ${d.starts} started, ${d.completed} completed`}</title>
              {series.map(([k, c], j) => {
                const h = ((d[k] as number) / max) * (H - 4);
                return <rect key={k} x={j * bw} y={H - h} width={bw - 1} height={h} fill={c} rx="1" />;
              })}
            </g>
          ))}
          <text x="0" y={H + 13} fontSize="9" fill="#6b7280">{data[0]?.date}</text>
          <text x={W} y={H + 13} fontSize="9" fill="#6b7280" textAnchor="end">{data[data.length - 1]?.date}</text>
        </svg>
      </div>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-xs text-gray-600">
        {series.map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
            {labels[k === "views" ? 0 : k === "starts" ? 1 : 2]}
          </span>
        ))}
        <span className="ml-auto text-gray-400">Peak: {max}/day (UTC)</span>
      </figcaption>
    </figure>
  );
}
