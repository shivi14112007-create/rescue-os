import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function ImpactSnapshot({ batches }) {
  const claimed = batches.filter((b) => b.status === "claimed");
  const soldViaMarkdown = claimed
    .filter((b) => b.recommended_action === "markdown")
    .reduce((s, b) => s + b.quantity_kg, 0);
  const fastTrackSales = claimed
    .filter((b) => b.recommended_action === "fast_track")
    .reduce((s, b) => s + b.quantity_kg, 0);
  const donated = claimed
    .filter((b) => b.recommended_action === "donate")
    .reduce((s, b) => s + b.quantity_kg, 0);

  const total = soldViaMarkdown + fastTrackSales + donated;

  const data = [
    { name: "Sold via Markdown", value: soldViaMarkdown, color: "#F5A623" },
    { name: "Fast-Track Sales", value: fastTrackSales, color: "#E8622C" },
    { name: "Donated", value: donated, color: "#D64545" },
  ].filter((d) => d.value > 0);

  const mealsNotWasted = Math.round(total * 2.5); // rough estimate: 1kg ≈ 2.5 meals

  return (
    <div className="bg-panel border border-border rounded-xl p-5 shadow-card flex flex-col">
      <h2 className="font-semibold text-ink mb-1">Impact Snapshot</h2>
      <p className="text-muted text-xs mb-3">Batches rescued so far</p>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted text-sm py-10">
          No rescues yet — claim a batch to see impact here.
        </div>
      ) : (
        <>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xl font-bold text-ink">{total.toLocaleString()} kg</div>
              <div className="text-[11px] text-muted">Total Rescued</div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-3 text-xs">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="text-ink font-medium">{d.value.toLocaleString()} kg</span>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-brand-light text-brand text-sm font-medium rounded-lg px-3 py-2 text-center">
            That's {mealsNotWasted.toLocaleString()} meals not wasted 🌱
          </div>
        </>
      )}
    </div>
  );
}
