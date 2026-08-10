import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/**
 * Speech-to-text hook built on the Web Speech API.
 *
 * @param {string} locale - BCP-47 locale to listen in, e.g. "hi-IN".
 * @param {(text: string) => void} [onResult] - called with the final transcript.
 */
export function useSpeechRecognition(locale, onResult) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const supported = Boolean(SpeechRecognitionAPI);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);
    setTranscript("");

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = locale || "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setTranscript(finalText || interimText);
      if (finalText) onResultRef.current?.(finalText.trim());
    };

    recognition.onerror = (event) => {
      setError(event.error || "Speech recognition error");
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [locale, supported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, transcript, error, start, stop, supported };
}
