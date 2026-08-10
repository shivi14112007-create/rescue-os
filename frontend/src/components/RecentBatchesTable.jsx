import ActionBadge from "./ActionBadge";
import ProduceImage from "./ProduceImage";

export default function RecentBatchesTable({
  batches,
  onSelect
}) {
  const recent = batches.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-ink">
          Recent Batches
        </h2>

        <button className="text-brand text-sm font-medium hover:underline">
          View All
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="text-muted text-sm py-6 text-center">
          No batches logged yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs border-b border-border">
              <th className="pb-2 font-medium">
                Produce
              </th>

              <th className="pb-2 font-medium">
                Quantity
              </th>

              <th className="pb-2 font-medium">
                Status
              </th>

              <th className="pb-2 font-medium">
                Shelf Life
              </th>

              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>

          <tbody>
            {recent.map((b) => (
              <tr
                key={b.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-3 flex items-center gap-2 capitalize">

                  <span className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-brand-light">
                    <ProduceImage
                      produce={b.produce_type}
                    />
                  </span>

                  {b.produce_type}
                </td>

                <td className="py-3 text-muted">
                  {b.quantity_kg} kg
                </td>

                <td className="py-3">
                  <ActionBadge
                    action={b.recommended_action}
                    discountPct={b.discount_pct}
                    small
                  />
                </td>

                <td className="py-3 text-muted">
                  {b.remaining_shelf_life_days <= 0
                    ? "Expired"
                    : `${b.remaining_shelf_life_days}d left`}
                </td>

                <td className="py-3 text-right">
                  <button
                    onClick={() => onSelect(b)}
                    className="text-brand text-xs font-medium hover:underline"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
