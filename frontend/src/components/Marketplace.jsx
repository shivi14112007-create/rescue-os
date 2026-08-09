import { useState } from "react";
import { claimBatch } from "../api";
import ActionBadge from "./ActionBadge";
import ProduceImage from "./ProduceImage";
import { MapPin, Search } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "markdown", label: "Markdown" },
  { key: "fast_track", label: "Fast-Track" },
  { key: "donate", label: "Donate" },
];

const TILE_BG = {
  hold: "bg-brand-light",
  markdown: "bg-markdown-light",
  fast_track: "bg-fasttrack-light",
  donate: "bg-donate-light",
};

export default function Marketplace({ batches, onClaim, onSelect }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [claimingId, setClaimingId] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [contactInput, setContactInput] = useState("");

  const available = batches.filter(
    (b) => !["claimed", "completed"].includes(b.status) && b.recommended_action !== "hold"
  );

  const filtered = available.filter((b) => {
    const matchesFilter = filter === "all" || b.recommended_action === filter;
    const matchesSearch =
      !search ||
      b.produce_type.toLowerCase().includes(search.toLowerCase()) ||
      b.location.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  async function handleClaim(id) {
    if (!nameInput.trim()) return;
    const updated = await claimBatch(id, nameInput.trim(), contactInput.trim());
    onClaim(updated);
    setClaimingId(null);
    setNameInput("");
    setContactInput("");
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Marketplace</h1>
          <p className="text-muted text-sm">Find discounted and donated produce batches</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search produce or location..."
            className="input pl-9"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key ? "bg-brand text-white" : "bg-panel border border-border text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl p-10 text-center text-muted shadow-card">
          No batches match right now — check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((b) => (
            <div key={b.id} className="bg-panel border border-border rounded-xl overflow-hidden shadow-card flex flex-col">
              <div className={`relative h-32 ${TILE_BG[b.recommended_action] || "bg-brand-light"}`}>
                <ProduceImage
                  produceType={b.produce_type}
                  className="w-full h-full"
                  emojiClassName={`w-full h-full ${TILE_BG[b.recommended_action] || "bg-brand-light"}`}
                />
                <span className="absolute top-2 left-2">
                  <ActionBadge action={b.recommended_action} discountPct={b.discount_pct} small />
                </span>
              </div>

              <div className="p-4 flex flex-col gap-1.5 flex-1">
                <h3 className="font-semibold text-ink capitalize">{b.produce_type}</h3>
                <p className="text-muted text-xs flex items-center gap-1">
                  {b.quantity_kg} kg &middot;
                  <MapPin size={12} /> {b.location}
                </p>
                <p className="text-muted text-xs">
                  {b.remaining_shelf_life_days <= 0 ? "Expired" : `${b.remaining_shelf_life_days} days left`}
                </p>

                {b.price_per_kg && (
                  <div className="text-sm mt-1">
                    {b.recommended_action === "donate" ? (
                      <span className="text-donate font-semibold">Free · Pickup Only</span>
                    ) : (
                      <>
                        <span className="text-ink font-semibold">
                          ₹{(b.price_per_kg * (1 - (b.discount_pct || 0) / 100)).toFixed(0)}/kg
                        </span>
                        {b.discount_pct > 0 && (
                          <span className="text-muted line-through ml-1.5">₹{b.price_per_kg}</span>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-3 flex flex-col gap-2">
                  {claimingId === b.id ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Your name / org"
                        className="input text-xs py-1.5"
                      />
                      <input
                        value={contactInput}
                        onChange={(e) => setContactInput(e.target.value)}
                        placeholder="Phone (optional)"
                        className="input text-xs py-1.5"
                      />
                      <button
                        onClick={() => handleClaim(b.id)}
                        disabled={!nameInput.trim()}
                        className="bg-brand text-white text-xs font-semibold py-1.5 rounded-lg disabled:opacity-50"
                      >
                        Confirm Claim
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setClaimingId(b.id)}
                      className="border border-brand text-brand text-sm font-medium py-1.5 rounded-lg hover:bg-brand-light transition-colors"
                    >
                      {b.recommended_action === "donate" ? "Claim Donation" : "View Details"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
