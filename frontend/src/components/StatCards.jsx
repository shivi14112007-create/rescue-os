import { Package, Leaf, IndianRupee, BadgeCheck } from "lucide-react";

export default function StatCards({ impact }) {
  if (!impact) return null;

  const cards = [
    {
      icon: Package,
      value: `${impact.total_kg_listed?.toLocaleString() ?? 0} kg`,
      label: "Total Produce Listed",
      color: "text-brand",
      bg: "bg-brand-light",
    },
    {
      icon: Leaf,
      value: `${impact.kg_rescued?.toLocaleString() ?? 0} kg`,
      label: "Produce Rescued",
      color: "text-brand",
      bg: "bg-brand-light",
    },
    {
      icon: IndianRupee,
      value: `₹${impact.revenue_recovered?.toLocaleString() ?? 0}`,
      label: "Revenue Recovered",
      color: "text-markdown",
      bg: "bg-markdown-light",
    },
    {
      icon: BadgeCheck,
      value: `${impact.batches_rescued ?? 0}`,
      label: "Batches Saved",
      color: "text-brand",
      bg: "bg-brand-light",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-panel border border-border rounded-xl p-4 shadow-card">
          <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.color} flex items-center justify-center mb-3`}>
            <c.icon size={18} />
          </div>
          <div className="text-xl font-bold text-ink">{c.value}</div>
          <div className="text-xs text-muted mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
