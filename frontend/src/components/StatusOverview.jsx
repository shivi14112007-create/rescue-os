import { Clock, Tag, Zap, Heart } from "lucide-react";

const CONFIG = {
  hold: { label: "Hold", icon: Clock, color: "text-brand", bg: "bg-brand-light" },
  markdown: { label: "Markdown", icon: Tag, color: "text-markdown", bg: "bg-markdown-light" },
  fast_track: { label: "Fast-Track", icon: Zap, color: "text-fasttrack", bg: "bg-fasttrack-light" },
  donate: { label: "Donate", icon: Heart, color: "text-donate", bg: "bg-donate-light" },
};

export default function StatusOverview({ batches }) {
  const active = batches.filter((b) => !["claimed", "completed"].includes(b.status));

  const groups = ["hold", "markdown", "fast_track", "donate"].map((key) => {
    const items = active.filter((b) => b.recommended_action === key);
    const kg = items.reduce((sum, b) => sum + b.quantity_kg, 0);
    return { key, count: items.length, kg, ...CONFIG[key] };
  });

  return (
    <div className="bg-panel border border-border rounded-xl p-5 shadow-card">
      <h2 className="font-semibold text-ink mb-4">Batch Status Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {groups.map((g) => (
          <div key={g.key} className={`${g.bg} rounded-lg p-4`}>
            <div className={`flex items-center gap-2 ${g.color} font-semibold text-sm mb-2`}>
              <g.icon size={16} />
              {g.label}
            </div>
            <div className="text-ink text-sm">{g.count} Batches</div>
            <div className="text-muted text-xs">{g.kg.toLocaleString()} kg</div>
          </div>
        ))}
      </div>
    </div>
  );
}
