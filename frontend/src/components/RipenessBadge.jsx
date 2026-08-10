// Ripeness badge shown alongside QualityBadge after a produce photo is
// analyzed. Ripeness is a separate axis from quality/spoilage - a batch can
// be perfectly fresh (quality=excellent) while still unripe or overripe.
// Renders nothing for "not_applicable" (root/leafy veg that don't ripen
// this way, or when confidence was too low to guess) so it never clutters
// the UI with a meaningless badge.
const CONFIG = {
  unripe: { label: "Unripe", bg: "bg-brand-light", text: "text-brand" },
  ripe: { label: "Ripe", bg: "bg-markdown-light", text: "text-markdown" },
  overripe: { label: "Overripe", bg: "bg-fasttrack-light", text: "text-fasttrack" },
};

export default function RipenessBadge({ ripeness, ripenessConfidence, small = false }) {
  if (!ripeness || ripeness === "not_applicable") return null;

  const c = CONFIG[ripeness] || { label: ripeness, bg: "bg-gray-100", text: "text-gray-600" };
  const sizing = small ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${c.bg} ${c.text} ${sizing}`}>
      {c.label}
      {typeof ripenessConfidence === "number" && ripenessConfidence > 0
        ? ` \u00b7 ${Math.round(ripenessConfidence * 100)}%`
        : ""}
    </span>
  );
}
