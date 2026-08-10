import { useCallback, useEffect, useState } from "react";

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

/**
 * Text-to-speech hook built on the Web Speech Synthesis API.
 */
export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const supported = Boolean(synth);

  useEffect(() => {
    return () => {
      synth?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text, locale) => {
      if (!supported || !text) return;
      synth.cancel(); // stop anything currently speaking first

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale || "en-IN";

      // Prefer a voice that matches the locale exactly, then a language-family match.
      const voices = synth.getVoices();
      const exact = voices.find((v) => v.lang === locale);
      const family = voices.find((v) => v.lang?.startsWith((locale || "en").split("-")[0]));
      if (exact) utterance.voice = exact;
      else if (family) utterance.voice = family;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      synth.speak(utterance);
    },
    [supported]
  );

  const cancel = useCallback(() => {
    synth?.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, speak, cancel, supported };
}
