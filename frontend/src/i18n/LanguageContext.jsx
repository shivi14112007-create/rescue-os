import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGES, TRANSLATIONS, DEFAULT_LANGUAGE } from "./translations";

const STORAGE_KEY = "rescueos_language";

const LanguageContext = createContext(null);

function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch {
    // localStorage unavailable (private browsing etc) - fall through
  }

  const browserLang = (navigator.language || "en").split("-")[0];
  if (TRANSLATIONS[browserLang]) return browserLang;

  return DEFAULT_LANGUAGE;
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return Object.keys(vars).reduce(
    (acc, key) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), vars[key]),
    str
  );
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(code) {
    if (TRANSLATIONS[code]) setLanguageState(code);
  }

  // t("form.submit") -> looks up TRANSLATIONS[language].form.submit,
  // falling back to English, then to the key itself if truly missing.
  function t(key, vars) {
    const value =
      getByPath(TRANSLATIONS[language], key) ??
      getByPath(TRANSLATIONS[DEFAULT_LANGUAGE], key) ??
      key;
    return typeof value === "string" ? interpolate(value, vars) : value;
  }

  const currentLanguageMeta = useMemo(
    () => LANGUAGES.find((l) => l.code === language) || LANGUAGES[0],
    [language]
  );

  const value = {
    language,
    setLanguage,
    t,
    languages: LANGUAGES,
    currentLanguageMeta,
    speechLocale: currentLanguageMeta.speechLocale,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
