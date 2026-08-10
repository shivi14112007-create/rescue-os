import { useEffect, useState } from "react";
import { previewBatch, createBatch } from "../api";
import { getBrowserLocation, reverseGeocode } from "../geo";
import ActionBadge from "./ActionBadge";
import MicButton from "./MicButton";
import SpeakButton from "./SpeakButton";
import { useLanguage } from "../i18n/LanguageContext";
import { Sparkles, LocateFixed, Loader2 } from "lucide-react";

const PRODUCE_OPTIONS = [
  "tomato", "banana", "mango", "apple", "potato",
  "onion", "spinach", "cauliflower", "grapes", "papaya",
];

const STORAGE_OPTIONS = ["room_temp", "cold_storage", "refrigerated"];

const emptyForm = {
  produce_type: "tomato",
  quantity_kg: "",
  harvest_date: "",
  storage_condition: "room_temp",
  location: "",
  latitude: null,
  longitude: null,
  seller_name: "",
  price_per_kg: "",
  notes: "",
};

export default function AddBatchForm({ sellerName, onBatchCreated }) {
  const { t, language } = useLanguage();
  const [form, setForm] = useState({ ...emptyForm, seller_name: sellerName || "" });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateLocationText(value) {
    // Hand-typed edits invalidate any coordinates captured via "Use my location"
    setForm((f) => ({ ...f, location: value, latitude: null, longitude: null }));
  }

  async function handleUseMyLocation() {
    setLocating(true);
    setLocateError(null);
    try {
      const { latitude, longitude } = await getBrowserLocation({ forceFresh: true });
      const label = await reverseGeocode(latitude, longitude).catch(
        () => `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      );
      setForm((f) => ({ ...f, location: label, latitude, longitude }));
    } catch (err) {
      setLocateError(err.message || "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
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
          language,
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
  }, [form.produce_type, form.quantity_kg, form.harvest_date, form.storage_condition, form.location, form.price_per_kg, language]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createBatch({
        ...form,
        quantity_kg: parseFloat(form.quantity_kg),
        price_per_kg: form.price_per_kg ? parseFloat(form.price_per_kg) : null,
        language,
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
        <h2 className="font-semibold text-lg text-ink">{t("form.addNewBatch")}</h2>
        <p className="text-muted text-sm mb-5">{t("form.addNewBatchSubtitle")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("form.produceType")}>
            <select
              value={form.produce_type}
              onChange={(e) => update("produce_type", e.target.value)}
              className="input"
            >
              {PRODUCE_OPTIONS.map((p) => (
                <option key={p} value={p}>{t(`form.produce.${p}`)}</option>
              ))}
            </select>
          </Field>

          <Field label={t("form.quantity")}>
            <input
              type="number" min="0.1" step="0.1" required
              value={form.quantity_kg}
              onChange={(e) => update("quantity_kg", e.target.value)}
              placeholder={t("form.quantityPlaceholder")}
              className="input"
            />
          </Field>

          <Field label={t("form.harvestDate")}>
            <input
              type="date" required
              value={form.harvest_date}
              onChange={(e) => update("harvest_date", e.target.value)}
              className="input"
            />
          </Field>

          <Field label={t("form.storageCondition")}>
            <select
              value={form.storage_condition}
              onChange={(e) => update("storage_condition", e.target.value)}
              className="input"
            >
              {STORAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>{t(`form.storage.${s}`)}</option>
              ))}
            </select>
          </Field>

          <Field label={t("form.pricePerKg")}>
            <input
              type="number" min="0" step="0.5"
              value={form.price_per_kg}
              onChange={(e) => update("price_per_kg", e.target.value)}
              placeholder={t("form.pricePlaceholder")}
              className="input"
            />
          </Field>

          <Field label={t("form.currentLocation")}>
            <div className="flex gap-2">
              <input
                type="text" required
                value={form.location}
                onChange={(e) => updateLocationText(e.target.value)}
                placeholder={t("form.locationPlaceholder")}
                className="input flex-1"
              />
              <MicButton onResult={(text) => updateLocationText(text)} />
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                title="Use my current location"
                className="shrink-0 flex items-center gap-1.5 px-3 rounded-lg border border-border text-sm text-muted hover:text-brand hover:border-brand disabled:opacity-50 transition-colors"
              >
                {locating ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                <span className="hidden sm:inline">{locating ? t("form.locating") : t("form.useMyLocation")}</span>
              </button>
            </div>
            {form.latitude && (
              <p className="text-xs text-brand mt-1">{t("form.locationCaptured")}</p>
            )}
            {locateError && <p className="text-xs text-donate mt-1">{locateError}</p>}
          </Field>
        </div>

        <div className="mt-4">
          <Field label={t("form.notes")}>
            <div className="flex gap-2">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder={t("form.notesPlaceholder")}
                className="input resize-none flex-1"
              />
              <MicButton onResult={(text) => update("notes", (form.notes ? form.notes + " " : "") + text)} />
            </div>
          </Field>
        </div>

        {error && <p className="text-donate text-sm mt-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full sm:w-auto bg-brand text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? t("form.submitting") : t("form.submit")}
        </button>
      </form>

      <div className="bg-markdown-light border border-markdown/20 rounded-xl p-5 h-fit sticky top-6">
        <div className="flex items-center gap-2 text-markdown font-semibold text-sm mb-1">
          <Sparkles size={16} />
          {t("preview.title")}
        </div>
        <p className="text-muted text-xs mb-4">{t("preview.subtitle")}</p>

        {!canPreview ? (
          <p className="text-muted text-sm py-6 text-center">
            {t("preview.emptyPrompt")}
          </p>
        ) : previewLoading && !preview ? (
          <p className="text-muted text-sm py-6 text-center">{t("preview.thinking")}</p>
        ) : preview ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs text-muted mb-1">{t("preview.recommendedAction")}</div>
              <ActionBadge action={preview.recommended_action} discountPct={preview.discount_pct} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted mb-1">{t("preview.remainingShelfLife")}</div>
                <div className="text-brand font-semibold text-sm">
                  {preview.remaining_shelf_life_days <= 0
                    ? t("preview.expired")
                    : t("preview.days", { n: preview.remaining_shelf_life_days })}
                </div>
              </div>
              {preview.discounted_price_per_kg && (
                <div>
                  <div className="text-xs text-muted mb-1">{t("preview.discountedPrice")}</div>
                  <div className="text-ink font-semibold text-sm">₹{preview.discounted_price_per_kg}/kg</div>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-muted">{t("preview.reason")}</div>
                <SpeakButton text={preview.agent_reasoning} />
              </div>
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
