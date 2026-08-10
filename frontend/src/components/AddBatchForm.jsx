import { useEffect, useRef, useState } from "react";
import { previewBatch, createBatch, analyzeProduceImage } from "../api";
import { getBrowserLocation, reverseGeocode } from "../geo";
import ActionBadge from "./ActionBadge";
import QualityBadge from "./QualityBadge";
import MicButton from "./MicButton";
import SpeakButton from "./SpeakButton";
import { useLanguage } from "../i18n/LanguageContext";

import {
  Sparkles,
  LocateFixed,
  Loader2,
  Camera,
  Upload,
  X,
  RefreshCw,
  ScanEye,
} from "lucide-react";

const PRODUCE_OPTIONS = [
  "tomato",
  "banana",
  "mango",
  "apple",
  "potato",
  "onion",
  "spinach",
  "cauliflower",
  "grapes",
  "papaya",
];

const STORAGE_OPTIONS = [
  {
    value: "room_temp",
    label: "Room Temperature",
  },
  {
    value: "cold_storage",
    label: "Cold Storage",
  },
  {
    value: "refrigerated",
    label: "Refrigerated",
  },
];

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
  // Filled in automatically by Produce Vision once a photo is analyzed -
  // left null for manual entries, exactly like before this feature existed.
  quality_label: null,
  quality_score: null,
  vision_source: null,
};

export default function AddBatchForm({
  sellerName,
  onBatchCreated,
}) {
  const { t, language } = useLanguage();

  const [form, setForm] = useState({
    ...emptyForm,
    seller_name: sellerName || "",
  });

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState(null);

  // LOCATION
  const [locating, setLocating] =
    useState(false);

  const [locateError, setLocateError] =
    useState(null);

  // PHOTO
  const [producePhoto, setProducePhoto] =
    useState(null);

  const [photoPreview, setPhotoPreview] =
    useState("");

  const [photoLoading, setPhotoLoading] =
    useState(false);

  // PRODUCE VISION (type + quality detection from the photo)
  const [visionResult, setVisionResult] =
    useState(null);

  const [visionLoading, setVisionLoading] =
    useState(false);

  const [visionError, setVisionError] =
    useState(null);

  // CAMERA
  const [cameraOpen, setCameraOpen] =
    useState(false);

  const [cameraStream, setCameraStream] =
    useState(null);

  const [cameraMode, setCameraMode] =
    useState("environment");

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // =========================
  // FORM UPDATE
  // =========================

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateLocationText(value) {
    setForm((current) => ({
      ...current,
      location: value,
      latitude: null,
      longitude: null,
    }));
  }

  // =========================
  // LOCATION
  // =========================

  async function handleUseMyLocation() {
    setLocating(true);
    setLocateError(null);

    try {
      const {
        latitude,
        longitude,
      } = await getBrowserLocation({
        forceFresh: true,
      });

      const label = await reverseGeocode(
        latitude,
        longitude
      ).catch(
        () =>
          `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      );

      setForm((current) => ({
        ...current,
        location: label,
        latitude,
        longitude,
      }));
    } catch (err) {
      setLocateError(
        err?.message ||
          "Couldn't get your location."
      );
    } finally {
      setLocating(false);
    }
  }

  // =========================
  // PHOTO UPLOAD
  // =========================

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    setPhotoLoading(true);
    setProducePhoto(file);

    const reader = new FileReader();

    reader.onload = () => {
      setPhotoPreview(reader.result);
      setPhotoLoading(false);
    };

    reader.onerror = () => {
      setPhotoLoading(false);
      setProducePhoto(null);
      setPhotoPreview("");
    };

    reader.readAsDataURL(file);

    runVisionAnalysis(file);
  }

  // =========================
  // PRODUCE VISION
  // Sends the photo to POST /vision/analyze-image and, on success, auto-fills
  // produce_type (only if the model is confident and it's a type we know
  // about) plus the visible-quality grade, which nudges the shelf-life
  // estimate on the backend. Falls back gracefully: on any failure we just
  // leave the fields for the seller to fill in manually, exactly like before
  // this feature existed - it's a shortcut, never a requirement.
  // =========================

  async function runVisionAnalysis(file) {
    setVisionLoading(true);
    setVisionError(null);
    setVisionResult(null);

    try {
      const result = await analyzeProduceImage(file);
      setVisionResult(result);

      setForm((current) => ({
        ...current,
        produce_type:
          result.produce_confidence >= 0.4 &&
          PRODUCE_OPTIONS.includes(result.produce_type)
            ? result.produce_type
            : current.produce_type,
        quality_label: result.quality_label,
        quality_score: result.quality_score,
        vision_source: result.source,
      }));
    } catch (err) {
      setVisionError(
        err?.message ||
          "Couldn't analyze the photo automatically - please fill in the details manually."
      );
    } finally {
      setVisionLoading(false);
    }
  }

  // =========================
  // START CAMERA
  // =========================

  async function startCamera(
    mode = cameraMode
  ) {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        alert(
          "Camera access is not supported by this browser."
        );
        return;
      }

      // Stop previous camera
      if (cameraStream) {
        cameraStream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      let stream;

      try {
        stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode: {
                  exact: mode,
                },
              },
              audio: false,
            }
          );
      } catch {
        // Fallback
        stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode: mode,
              },
              audio: false,
            }
          );
      }

      setCameraStream(stream);
      setCameraMode(mode);
      setCameraOpen(true);
    } catch (err) {
      console.error("Camera error:", err);

      if (
        err?.name === "NotAllowedError"
      ) {
        alert(
          "Camera permission was denied. Please allow camera access in your browser settings."
        );
      } else if (
        err?.name === "NotFoundError"
      ) {
        alert(
          "No camera was found on this device."
        );
      } else {
        alert(
          "Unable to access the camera."
        );
      }
    }
  }

  // =========================
  // CONNECT STREAM TO VIDEO
  // =========================

  useEffect(() => {
    if (
      cameraOpen &&
      cameraStream &&
      videoRef.current
    ) {
      videoRef.current.srcObject =
        cameraStream;

      videoRef.current
        .play()
        .catch(() => {});
    }
  }, [cameraOpen, cameraStream]);

  // =========================
  // SWITCH CAMERA
  // =========================

  async function switchCamera() {
    const newMode =
      cameraMode === "environment"
        ? "user"
        : "environment";

    await startCamera(newMode);
  }

  // =========================
  // STOP CAMERA
  // =========================

  function stopCamera() {
    if (cameraStream) {
      cameraStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );
    }

    setCameraStream(null);
    setCameraOpen(false);
  }

  // =========================
  // CAPTURE PHOTO
  // =========================

  function capturePhoto() {
    const video = videoRef.current;

    if (!video) return;

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      alert(
        "Camera is still loading. Please wait a moment and try again."
      );
      return;
    }

    const canvas =
      document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context =
      canvas.getContext("2d");

    if (!context) return;

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert(
            "Could not capture the photo."
          );
          return;
        }

        const file = new File(
          [blob],
          "produce-photo.jpg",
          {
            type: "image/jpeg",
          }
        );

        setProducePhoto(file);

        const imageUrl =
          URL.createObjectURL(blob);

        setPhotoPreview(imageUrl);

        stopCamera();

        runVisionAnalysis(file);
      },
      "image/jpeg",
      0.9
    );
  }

  // =========================
  // REMOVE PHOTO
  // =========================

  function removePhoto() {
    if (
      photoPreview &&
      photoPreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        photoPreview
      );
    }

    setProducePhoto(null);
    setPhotoPreview("");

    setVisionResult(null);
    setVisionLoading(false);
    setVisionError(null);

    setForm((current) => ({
      ...current,
      quality_label: null,
      quality_score: null,
      vision_source: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // =========================
  // CLEAN CAMERA
  // =========================

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, [cameraStream]);

  // =========================
  // AI PREVIEW
  // =========================

  const canPreview =
    form.quantity_kg &&
    form.harvest_date &&
    form.location;

  useEffect(() => {
    if (!canPreview) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(
      async () => {
        setPreviewLoading(true);

        try {
          const result =
            await previewBatch({
              ...form,

              quantity_kg:
                parseFloat(
                  form.quantity_kg
                ),

              price_per_kg:
                form.price_per_kg
                  ? parseFloat(
                      form.price_per_kg
                    )
                  : null,

              language,
            });

          setPreview(result);
        } catch {
          setPreview(null);
        } finally {
          setPreviewLoading(false);
        }
      },
      500
    );

    return () =>
      clearTimeout(timer);
  }, [
    form.produce_type,
    form.quantity_kg,
    form.harvest_date,
    form.storage_condition,
    form.location,
    form.price_per_kg,
    language,
  ]);

  // =========================
  // SUBMIT
  // =========================

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const created =
        await createBatch({
          ...form,

          quantity_kg:
            parseFloat(
              form.quantity_kg
            ),

          price_per_kg:
            form.price_per_kg
              ? parseFloat(
                  form.price_per_kg
                )
              : null,

          language,
        });

      onBatchCreated(created);

      setForm({
        ...emptyForm,
        seller_name:
          sellerName || "",
      });

      setPreview(null);

      removePhoto();
    } catch (err) {
      setError(
        err?.message ||
          "Could not log this batch. Check the backend is running."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

        {/* =========================
            FORM
        ========================= */}

        <form
          onSubmit={handleSubmit}
          className="bg-panel border border-border rounded-xl p-6 shadow-card"
        >
          <h2 className="font-semibold text-lg text-ink">
            {t("form.addNewBatch")}
          </h2>

          <p className="text-muted text-sm mb-5">
            {t("form.addNewBatchSubtitle")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* PRODUCE */}
            <Field
              label={t(
                "form.produceType"
              )}
            >
              <select
                value={form.produce_type}
                onChange={(e) =>
                  update(
                    "produce_type",
                    e.target.value
                  )
                }
                className="input"
              >
                {PRODUCE_OPTIONS.map(
                  (produce) => (
                    <option
                      key={produce}
                      value={produce}
                    >
                      {t(
                        `form.produce.${produce}`
                      )}
                    </option>
                  )
                )}
              </select>
            </Field>

            {/* QUANTITY */}
            <Field
              label={t(
                "form.quantity"
              )}
            >
              <input
                type="number"
                min="0.1"
                step="0.1"
                required
                value={
                  form.quantity_kg
                }
                onChange={(e) =>
                  update(
                    "quantity_kg",
                    e.target.value
                  )
                }
                placeholder={t(
                  "form.quantityPlaceholder"
                )}
                className="input"
              />
            </Field>

            {/* HARVEST DATE */}
            <Field
              label={t(
                "form.harvestDate"
              )}
            >
              <input
                type="date"
                required
                value={
                  form.harvest_date
                }
                onChange={(e) =>
                  update(
                    "harvest_date",
                    e.target.value
                  )
                }
                className="input"
              />
            </Field>

            {/* STORAGE */}
            <Field
              label={t(
                "form.storageCondition"
              )}
            >
              <select
                value={
                  form.storage_condition
                }
                onChange={(e) =>
                  update(
                    "storage_condition",
                    e.target.value
                  )
                }
                className="input"
              >
                {STORAGE_OPTIONS.map(
                  (storage) => (
                    <option
                      key={storage.value}
                      value={
                        storage.value
                      }
                    >
                      {t(
                        `form.storage.${storage.value}`
                      )}
                    </option>
                  )
                )}
              </select>
            </Field>

            {/* PRICE */}
            <Field
              label={t(
                "form.pricePerKg"
              )}
            >
              <input
                type="number"
                min="0"
                step="0.5"
                value={
                  form.price_per_kg
                }
                onChange={(e) =>
                  update(
                    "price_per_kg",
                    e.target.value
                  )
                }
                placeholder={t(
                  "form.pricePlaceholder"
                )}
                className="input"
              />
            </Field>

            {/* LOCATION */}
            <Field
              label={t(
                "form.currentLocation"
              )}
            >
              <div className="flex gap-2">

                <input
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) =>
                    updateLocationText(
                      e.target.value
                    )
                  }
                  placeholder={t(
                    "form.locationPlaceholder"
                  )}
                  className="input flex-1"
                />

                {/* VOICE LOCATION */}
                <MicButton
                  onResult={(text) =>
                    updateLocationText(
                      text
                    )
                  }
                />

                {/* GPS */}
                <button
                  type="button"
                  onClick={
                    handleUseMyLocation
                  }
                  disabled={locating}
                  className="shrink-0 flex items-center gap-1.5 px-3 rounded-lg border border-border text-sm text-muted hover:text-brand hover:border-brand disabled:opacity-50 transition-colors"
                  title={t(
                    "form.useMyLocation"
                  )}
                >
                  {locating ? (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <LocateFixed
                      size={15}
                    />
                  )}

                  <span className="hidden xl:inline">
                    {locating
                      ? t(
                          "form.locating"
                        )
                      : t(
                          "form.useMyLocation"
                        )}
                  </span>
                </button>
              </div>

              {form.latitude && (
                <p className="text-xs text-brand mt-1">
                  📍{" "}
                  {t(
                    "form.locationCaptured"
                  )}
                </p>
              )}

              {locateError && (
                <p className="text-xs text-donate mt-1">
                  {locateError}
                </p>
              )}
            </Field>
          </div>

          {/* =========================
              PHOTO
          ========================= */}

          <div className="mt-5">
            <Field label="Produce Photo">

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={
                  handlePhotoChange
                }
                className="hidden"
              />

              <div className="flex flex-wrap gap-2">

                {/* UPLOAD */}
                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-ink hover:bg-gray-50"
                >
                  <Upload size={16} />
                  Upload Photo
                </button>

                {/* CAMERA */}
                <button
                  type="button"
                  onClick={() =>
                    startCamera(
                      "environment"
                    )
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-ink hover:bg-gray-50"
                >
                  <Camera size={16} />
                  Take Photo
                </button>
              </div>

              {photoLoading && (
                <div className="flex items-center gap-2 text-xs text-muted mt-2">
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                  Loading photo...
                </div>
              )}

              {photoPreview &&
                !photoLoading && (
                  <div className="border border-border rounded-xl p-3 mt-3">

                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Selected produce"
                        className="w-full h-56 object-cover rounded-lg"
                      />

                      <button
                        type="button"
                        onClick={
                          removePhoto
                        }
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-ink hover:bg-gray-100"
                      >
                        <X size={16} />
                      </button>

                      {visionLoading && (
                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                          <div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-full text-xs font-medium text-ink">
                            <Loader2 size={14} className="animate-spin" />
                            Analyzing photo...
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PRODUCE VISION RESULT */}
                    {!visionLoading && visionResult && (
                      <div className="mt-3 flex items-start gap-2 bg-canvas rounded-lg p-2.5">
                        <ScanEye size={16} className="text-brand mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-xs font-medium text-ink capitalize">
                              {visionResult.produce_type !== "unknown"
                                ? visionResult.produce_type
                                : "Type not detected"}
                            </span>
                            <QualityBadge
                              qualityLabel={visionResult.quality_label}
                              qualityScore={visionResult.quality_score}
                              small
                            />
                          </div>
                          {visionResult.reasoning && (
                            <p className="text-xs text-muted leading-snug">
                              {visionResult.reasoning}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {!visionLoading && visionError && (
                      <p className="mt-3 text-xs text-donate">
                        {visionError}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between">

                      <div>
                        <p className="text-sm font-medium text-ink">
                          Photo selected
                        </p>

                        <p className="text-xs text-muted truncate max-w-[220px]">
                          {
                            producePhoto?.name
                          }
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-ink hover:bg-gray-50"
                      >
                        <Upload
                          size={14}
                        />
                        Change
                      </button>
                    </div>
                  </div>
                )}
            </Field>
          </div>

          {/* =========================
              NOTES + VOICE
          ========================= */}

          <div className="mt-4">
            <Field
              label={t(
                "form.notes"
              )}
            >
              <div className="flex gap-2">

                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    update(
                      "notes",
                      e.target.value
                    )
                  }
                  placeholder={t(
                    "form.notesPlaceholder"
                  )}
                  className="input resize-none flex-1"
                />

                <MicButton
                  onResult={(text) =>
                    update(
                      "notes",
                      form.notes
                        ? `${form.notes} ${text}`
                        : text
                    )
                  }
                />
              </div>
            </Field>
          </div>

          {/* ERROR */}

          {error && (
            <p className="text-donate text-sm mt-4">
              {error}
            </p>
          )}

          {/* SUBMIT */}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full sm:w-auto bg-brand text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {submitting
              ? t(
                  "form.submitting"
                )
              : t("form.submit")}
          </button>
        </form>

        {/* =========================
            AI RECOMMENDATION
        ========================= */}

        <div className="bg-markdown-light border border-markdown/20 rounded-xl p-5 h-fit sticky top-6">

          <div className="flex items-center gap-2 text-markdown font-semibold text-sm mb-1">
            <Sparkles size={16} />

            {t(
              "preview.title"
            )}
          </div>

          <p className="text-muted text-xs mb-4">
            {t(
              "preview.subtitle"
            )}
          </p>

          {!canPreview ? (
            <p className="text-muted text-sm py-6 text-center">
              {t(
                "preview.emptyPrompt"
              )}
            </p>
          ) : previewLoading &&
            !preview ? (
            <p className="text-muted text-sm py-6 text-center">
              {t(
                "preview.thinking"
              )}
            </p>
          ) : preview ? (
            <div className="flex flex-col gap-4">

              {/* ACTION */}

              <div>
                <div className="text-xs text-muted mb-1">
                  {t(
                    "preview.recommendedAction"
                  )}
                </div>

                <ActionBadge
                  action={
                    preview.recommended_action
                  }
                  discountPct={
                    preview.discount_pct
                  }
                />
              </div>

              {/* SHELF LIFE + PRICE */}

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <div className="text-xs text-muted mb-1">
                    {t(
                      "preview.remainingShelfLife"
                    )}
                  </div>

                  <div className="text-brand font-semibold text-sm">
                    {preview.remaining_shelf_life_days <=
                    0
                      ? t(
                          "preview.expired"
                        )
                      : t(
                          "preview.days",
                          {
                            n: preview.remaining_shelf_life_days,
                          }
                        )}
                  </div>
                </div>

                {preview.discounted_price_per_kg && (
                  <div>
                    <div className="text-xs text-muted mb-1">
                      {t(
                        "preview.discountedPrice"
                      )}
                    </div>

                    <div className="text-ink font-semibold text-sm">
                      ₹
                      {
                        preview.discounted_price_per_kg
                      }
                      /kg
                    </div>
                  </div>
                )}
              </div>

              {/* REASON + SPEAK */}

              <div>
                <div className="flex items-center justify-between mb-1">

                  <div className="text-xs text-muted">
                    {t(
                      "preview.reason"
                    )}
                  </div>

                  <SpeakButton
                    text={
                      preview.agent_reasoning
                    }
                  />
                </div>

                <p className="text-ink text-sm leading-snug">
                  {
                    preview.agent_reasoning
                  }
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* =========================
          CAMERA MODAL
      ========================= */}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">

          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-xl">

            {/* HEADER */}

            <div className="flex items-center justify-between px-4 py-3 border-b border-border">

              <h3 className="font-semibold text-ink">
                Take Produce Photo
              </h3>

              <button
                type="button"
                onClick={
                  stopCamera
                }
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* VIDEO */}

            <div className="bg-black relative">

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover"
              />

              <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                {cameraMode ===
                "environment"
                  ? "Back Camera"
                  : "Front Camera"}
              </div>
            </div>

            {/* CAMERA CONTROLS */}

            <div className="flex items-center justify-center gap-3 px-4 py-4">

              <button
                type="button"
                onClick={
                  switchCamera
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-gray-50"
              >
                <RefreshCw
                  size={16}
                />
                Switch Camera
              </button>

              <button
                type="button"
                onClick={
                  capturePhoto
                }
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-brand/90"
              >
                <Camera
                  size={17}
                />
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1.5">
        {label}
      </span>

      {children}
    </label>
  );
}