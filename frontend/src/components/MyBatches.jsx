import { completeBatch } from "../api";
import ActionBadge from "./ActionBadge";
import ProduceImage from "./ProduceImage";

export default function MyBatches({ batches, onSelect, onComplete }) {
  async function handleMarkPickedUp(id) {
    const updated = await completeBatch(id);
    onComplete(updated);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-ink mb-1">My Batches</h1>
      <p className="text-muted text-sm mb-5">Every batch you've logged, and what the agent recommends.</p>

      <div className="bg-panel border border-border rounded-xl shadow-card overflow-hidden">
        {batches.length === 0 ? (
          <p className="text-muted text-sm py-10 text-center">No batches logged yet — add one from "Add Batch".</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs border-b border-border bg-canvas">
                <th className="px-5 py-3 font-medium">Produce</th>
                <th className="px-5 py-3 font-medium">Quantity</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Shelf Life</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-canvas/60">
                  <td className="px-5 py-3 flex items-center gap-2 capitalize">
                    <span className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-brand-light inline-block">
                      <ProduceImage
                        produceType={b.produce_type}
                        className="w-8 h-8"
                        emojiClassName="w-8 h-8 bg-brand-light"
                        emojiSize="text-base"
                      />
                    </span>
                    {b.produce_type}
                  </td>
                  <td className="px-5 py-3 text-muted">{b.quantity_kg} kg</td>
                  <td className="px-5 py-3 text-muted">{b.location}</td>
                  <td className="px-5 py-3">
                    <ActionBadge action={b.recommended_action} discountPct={b.discount_pct} small />
                    {b.status === "claimed" && (
                      <span className="ml-2 text-xs text-markdown font-medium">Claimed — awaiting pickup</span>
                    )}
                    {b.status === "completed" && (
                      <span className="ml-2 text-xs text-brand font-medium">Rescued ✓</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {b.remaining_shelf_life_days <= 0 ? "Expired" : `${b.remaining_shelf_life_days}d`}
                  </td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-3">
                    {b.status === "claimed" && (
                      <button
                        onClick={() => handleMarkPickedUp(b.id)}
                        className="text-markdown text-xs font-medium hover:underline"
                      >
                        Mark Picked Up
                      </button>
                    )}
                    <button onClick={() => onSelect(b)} className="text-brand text-xs font-medium hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
