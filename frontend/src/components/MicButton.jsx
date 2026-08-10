import { Mic, MicOff, Loader2 } from "lucide-react";
import { useSpeechRecognition } from "../voice/useSpeechRecognition";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * Voice-input button. Drop next to any input/textarea:
 *
 *   <MicButton onResult={(text) => update("notes", text)} />
 *
 * Listens in the currently selected app language and calls onResult with
 * the recognized text once the user stops speaking.
 */
export default function MicButton({ onResult, className = "" }) {
  const { speechLocale, t } = useLanguage();
  const { listening, start, stop, supported, error } = useSpeechRecognition(speechLocale, onResult);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? t("form.listening") : t("form.speakToFill")}
      className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
        listening
          ? "bg-brand text-white border-brand animate-pulse"
          : "border-border text-muted hover:text-brand hover:border-brand"
      } ${className}`}
    >
      {listening ? <Loader2 size={15} className="animate-spin" /> : error ? <MicOff size={15} /> : <Mic size={15} />}
    </button>
  );
}
