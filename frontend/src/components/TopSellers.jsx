import { Trophy } from "lucide-react";

const RANK_STYLES = [
  "bg-markdown text-white",   // 1st - gold-ish (amber brand color)
  "bg-gray-300 text-ink",     // 2nd - silver
  "bg-[#CD7F32] text-white",  // 3rd - bronze
];

export default function TopSellers({ batches }) {
  const rescued = batches.filter((b) => ["claimed", "completed"].includes(b.status));

  const bySeller = {};
  for (const b of rescued) {
    const name = b.seller_name?.trim() || "Unknown Seller";
    if (!bySeller[name]) {
      bySeller[name] = { name, kg: 0, batches: 0 };
    }
    bySeller[name].kg += b.quantity_kg;
    bySeller[name].batches += 1;
  }

  const leaderboard = Object.values(bySeller)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 5);

  return (
    <div className="bg-panel border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-markdown" />
        <h2 className="font-semibold text-ink">Top Sellers</h2>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-muted text-sm py-6 text-center">
          No rescues yet — top sellers will show up here.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leaderboard.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3">
              <span
                className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  RANK_STYLES[i] || "bg-canvas text-muted border border-border"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{s.name}</div>
                <div className="text-xs text-muted">{s.batches} batch{s.batches !== 1 ? "es" : ""} rescued</div>
              </div>
              <div className="text-sm font-semibold text-brand shrink-0">
                {s.kg.toLocaleString()} kg
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}