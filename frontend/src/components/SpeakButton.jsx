import { Volume2, VolumeX } from "lucide-react";
import { useSpeechSynthesis } from "../voice/useSpeechSynthesis";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * Voice-output button. Drop next to any AI-generated text:
 *
 *   <SpeakButton text={preview.agent_reasoning} />
 *
 * Speaks the given text aloud in the currently selected app language.
 */
export default function SpeakButton({ text, className = "" }) {
  const { speechLocale, t } = useLanguage();
  const { speaking, speak, cancel, supported } = useSpeechSynthesis();

  if (!supported || !text) return null;

  return (
    <button
      type="button"
      onClick={() => (speaking ? cancel() : speak(text, speechLocale))}
      title={t("preview.listenToReason")}
      className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
        speaking
          ? "bg-brand text-white border-brand"
          : "border-border text-muted hover:text-brand hover:border-brand"
      } ${className}`}
    >
      {speaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
    </button>
  );
}
