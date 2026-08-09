import { useEffect, useState } from "react";
import { previewBatch, createBatch } from "../api";
import ActionBadge from "./ActionBadge";
import { Sparkles } from "lucide-react";

const PRODUCE_OPTIONS = [
  "tomato", "banana", "mango", "apple", "potato",
  "onion", "spinach", "cauliflower", "grapes", "papaya",
];

const STORAGE_OPTIONS = [
  { value: "room_temp", label: "Room Temperature" },
  { value: "cold_storage", label: "Cold Storage" },
  { value: "refrigerated", label: "Refrigerated" },
];

const emptyForm = {
  produce_type: "tomato",
  quantity_kg: "",
  harvest_date: "",
  storage_condition: "room_temp",
  location: "",
  seller_name: "",
  price_per_kg: "",
  notes: "",
};

export default function AddBatchForm({ sellerName, onBatchCreated }) {
  const [form, setForm] = useState({ ...emptyForm, seller_name: sellerName || "" });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canPreview = form.quantity_kg && form.harvest_date && form.location;

  // Debounced live preview - fires ~500ms after the user stops typing/changing fields
  useEffect(() => {
    if (!canPreview) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const result = await previewBatch({
          ...form,
          quantity_kg: parseFloat(form.quantity_kg),
          price_per_kg: form.price_per_kg ? parseFloat(form.price_per_kg) : null,
        });
        setPreview(result);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.produce_type, form.quantity_kg, form.harvest_date, form.storage_condition, form.location, form.price_per_kg]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createBatch({
        ...form,
        quantity_kg: parseFloat(form.quantity_kg),
        price_per_kg: form.price_per_kg ? parseFloat(form.price_per_kg) : null,
      });
      onBatchCreated(created);
      setForm({ ...emptyForm, seller_name: sellerName || "" });
      setPreview(null);
    } catch (err) {
      setError(err.message || "Could not log this batch. Check the backend is running.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-xl p-6 shadow-card">
        <h2 className="font-semibold text-lg text-ink">Add New Batch</h2>
        <p className="text-muted text-sm mb-5">Enter details about your produce batch</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Produce Type">
            <select
              value={form.produce_type}
              onChange={(e) => update("produce_type", e.target.value)}
              className="input"
            >
              {PRODUCE_OPTIONS.map((p) => (
                <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </Field>

          <Field label="Quantity (kg)">
            <input
              type="number" min="0.1" step="0.1" required
              value={form.quantity_kg}
              onChange={(e) => update("quantity_kg", e.target.value)}
              placeholder="e.g. 1000"
              className="input"
            />
          </Field>

          <Field label="Harvest / Pack Date">
            <input
              type="date" required
              value={form.harvest_date}
              onChange={(e) => update("harvest_date", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Storage Condition">
            <select
              value={form.storage_condition}
              onChange={(e) => update("storage_condition", e.target.value)}
              className="input"
            >
              {STORAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Price per kg (₹, optional)">
            <input
              type="number" min="0" step="0.5"
              value={form.price_per_kg}
              onChange={(e) => update("price_per_kg", e.target.value)}
              placeholder="e.g. 30"
              className="input"
            />
          </Field>

          <Field label="Current Location">
            <input
              type="text" required
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="e.g. Azadpur Mandi, Delhi"
              className="input"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Additional Notes (Optional)">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any additional information about the batch..."
              className="input resize-none"
            />
          </Field>
        </div>

        {error && <p className="text-donate text-sm mt-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full sm:w-auto bg-brand text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit Batch"}
        </button>
      </form>

      <div className="bg-markdown-light border border-markdown/20 rounded-xl p-5 h-fit sticky top-6">
        <div className="flex items-center gap-2 text-markdown font-semibold text-sm mb-1">
          <Sparkles size={16} />
          AI Recommendation Preview
        </div>
        <p className="text-muted text-xs mb-4">Based on the details you've entered</p>

        {!canPreview ? (
          <p className="text-muted text-sm py-6 text-center">
            Fill in quantity, harvest date, and location to see a live recommendation.
          </p>
        ) : previewLoading && !preview ? (
          <p className="text-muted text-sm py-6 text-center">Thinking…</p>
        ) : preview ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs text-muted mb-1">Recommended Action</div>
              <ActionBadge action={preview.recommended_action} discountPct={preview.discount_pct} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted mb-1">Est. Remaining Shelf Life</div>
                <div className="text-brand font-semibold text-sm">
                  {preview.remaining_shelf_life_days <= 0 ? "Expired" : `${preview.remaining_shelf_life_days} days`}
                </div>
              </div>
              {preview.discounted_price_per_kg && (
                <div>
                  <div className="text-xs text-muted mb-1">Discounted Price</div>
                  <div className="text-ink font-semibold text-sm">₹{preview.discounted_price_per_kg}/kg</div>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Reason</div>
              <p className="text-ink text-sm leading-snug">{preview.agent_reasoning}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}
