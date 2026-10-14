import { useContext } from "react";
import { PersonalizationContext } from "../context/PersonalizationContext";
import { translations } from "../i18n/translations";

// Custom hook — mirrors the shape of useAuth/useWallet elsewhere in the app.
// t(key) looks up the current language's string, falls back to English,
// then to the raw key itself, so a missing translation never renders blank.
export function useTranslation() {
  const context = useContext(PersonalizationContext);
  const language = context?.language || "en";
  const setLanguage = context?.setLanguage || (() => {});

  const t = (key) => translations[language]?.[key] ?? translations.en[key] ?? key;

  return { t, language, setLanguage };
}
