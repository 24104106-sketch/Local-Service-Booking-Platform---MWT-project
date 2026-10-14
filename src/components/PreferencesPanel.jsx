import { useContext } from "react";
import { PersonalizationContext, FONT_SIZES } from "../context/PersonalizationContext";
import { useTranslation } from "../hooks/useTranslation";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ta", label: "தமிழ்" },
];

const FONT_LABEL_KEYS = { sm: "small", md: "medium", lg: "large" };

const activeBtnStyle = { background: "var(--blue-soft)", borderColor: "var(--blue)", color: "var(--blue)" };

function PreferencesPanel() {
  const { fontSize, setFontSize } = useContext(PersonalizationContext);
  const { t, language, setLanguage } = useTranslation();

  return (
    <>
      <h3>{t("language")}</h3>
      <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="btn"
            style={language === opt.value ? activeBtnStyle : {}}
            onClick={() => setLanguage(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <h3>{t("fontSize")}</h3>
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: -6, marginBottom: 14 }}>
        {t("fontSizeHint")}
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
        {FONT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className="btn"
            style={fontSize === size ? activeBtnStyle : {}}
            onClick={() => setFontSize(size)}
          >
            {t(FONT_LABEL_KEYS[size])}
          </button>
        ))}
      </div>
    </>
  );
}

export default PreferencesPanel;
