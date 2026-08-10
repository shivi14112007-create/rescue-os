// Visual quality grade shown after a produce photo is analyzed by
// POST /vision/analyze-image. Reuses the same badge shape/sizing pattern as
// ActionBadge.jsx so the two feel like one design system, with a traffic-light
// color scale (green = excellent -> brown = spoiled) that reads at a glance.
const CONFIG = {
  excellent: { label: "Excellent", bg: "bg-brand-light", text: "text-brand" },
  good: { label: "Good", bg: "bg-brand-light", text: "text-brand" },
  fair: { label: "Fair", bg: "bg-markdown-light", text: "text-markdown" },
  poor: { label: "Poor", bg: "bg-fasttrack-light", text: "text-fasttrack" },
  spoiled: { label: "Spoiled", bg: "bg-donate-light", text: "text-donate" },
};

export default function QualityBadge({ qualityLabel, qualityScore, small = false }) {
  if (!qualityLabel) return null;

  const c = CONFIG[qualityLabel] || { label: qualityLabel, bg: "bg-gray-100", text: "text-gray-600" };
  const sizing = small ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${c.bg} ${c.text} ${sizing}`}>
      {c.label}
      {typeof qualityScore === "number" ? ` \u00b7 ${qualityScore}/100` : ""}
    </span>
  );
}
