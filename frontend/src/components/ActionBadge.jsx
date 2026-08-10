const CONFIG = {
  hold: { label: "Hold", bg: "bg-brand-light", text: "text-brand" },
  markdown: { label: "Markdown", bg: "bg-markdown-light", text: "text-markdown" },
  fast_track: { label: "Fast-Track", bg: "bg-fasttrack-light", text: "text-fasttrack" },
  donate: { label: "Donate", bg: "bg-donate-light", text: "text-donate" },
  compost: { label: "Compost", bg: "bg-compost-light", text: "text-compost" },
};

export default function ActionBadge({ action, discountPct, small = false }) {
  const c = CONFIG[action] || { label: action, bg: "bg-gray-100", text: "text-gray-600" };
  const sizing = small ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${c.bg} ${c.text} ${sizing}`}>
      {c.label}
      {action === "markdown" && discountPct > 0 ? ` ${discountPct}%` : ""}
    </span>
  );
}