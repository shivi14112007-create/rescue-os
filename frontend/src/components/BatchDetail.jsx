import { X, Calendar, MapPin, Package, Thermometer, Sparkles } from "lucide-react";
import ActionBadge from "./ActionBadge";
import ProduceImage from "./ProduceImage";

const TILE_BG = {
  hold: "bg-brand-light",
  markdown: "bg-markdown-light",
  fast_track: "bg-fasttrack-light",
  donate: "bg-donate-light",
};

export default function BatchDetail({ batch, onClose }) {
  if (!batch) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-panel h-full overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">Batch Details</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className={`h-40 ${TILE_BG[batch.recommended_action] || "bg-brand-light"}`}>
          <ProduceImage
            produceType={batch.produce_type}
            className="w-full h-full"
            emojiClassName={`w-full h-full ${TILE_BG[batch.recommended_action] || "bg-brand-light"}`}
          />
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-bold text-ink capitalize">{batch.produce_type}</h3>
            <p className="text-muted text-xs">Batch ID: #{batch.id}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow icon={Package} label="Quantity" value={`${batch.quantity_kg} kg`} />
            <InfoRow icon={Thermometer} label="Storage" value={batch.storage_condition.replace("_", " ")} />
            <InfoRow icon={MapPin} label="Location" value={batch.location} />
            <InfoRow icon={Calendar} label="Harvest Date" value={batch.harvest_date} />
          </div>

          <div className="bg-markdown-light border border-markdown/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-markdown font-semibold text-sm mb-3">
              <Sparkles size={15} />
              AI Recommendation
            </div>
            <ActionBadge action={batch.recommended_action} discountPct={batch.discount_pct} />
            <p className="text-ink text-sm mt-3 leading-snug">{batch.agent_reasoning}</p>
          </div>

          {batch.notes && (
            <div>
              <div className="text-xs text-muted mb-1">Notes</div>
              <p className="text-sm text-ink">{batch.notes}</p>
            </div>
          )}

          {batch.seller_name && (
            <div className="border-t border-border pt-4">
              <div className="text-xs text-muted mb-1">Seller</div>
              <p className="text-sm text-ink font-medium">{batch.seller_name}</p>
            </div>
          )}

          {batch.claimed_by && (
            <div className="bg-brand-light text-brand text-sm font-medium rounded-lg px-3 py-2">
              Claimed by {batch.claimed_by}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} className="text-muted mt-0.5" />
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-ink capitalize">{value}</div>
      </div>
    </div>
  );
}
