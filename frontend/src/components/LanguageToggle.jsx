import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

export default function LanguageToggle() {
  const { language, setLanguage, languages, currentLanguageMeta, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t("language.choose")}
        className="flex items-center gap-1.5 text-sm text-muted border border-border rounded-full px-3 py-1.5 hover:text-brand hover:border-brand transition-colors"
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{currentLanguageMeta.native}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-panel border border-border rounded-lg shadow-card py-1 z-50 max-h-72 overflow-y-auto">
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setLanguage(lang.code);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-canvas transition-colors ${
                lang.code === language ? "text-brand font-medium" : "text-ink"
              }`}
            >
              <span>
                {lang.native}
                {lang.native !== lang.label && (
                  <span className="text-muted text-xs ml-1">({lang.label})</span>
                )}
              </span>
              {lang.code === language && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
