import { createContext, useContext, useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { ThemeContext } from "./ThemeContext";
import { derivePaletteFromColor } from "../utils/colorUtils";

export const PersonalizationContext = createContext(null);

export const FONT_SIZES = ["sm", "md", "lg"];
export const LANGUAGES = ["en", "ta"];
export const ACCENT_COLORS = ["blue", "purple", "green", "rose", "amber", "teal"];

export function PersonalizationProvider({ children }) {
  const [fontSize, setFontSize] = useLocalStorage("fixit_local_fontsize", "md");
  const [language, setLanguage] = useLocalStorage("fixit_local_language", "en");
  const [accentColor, setAccentColorRaw] = useLocalStorage("fixit_local_accent", "blue");
  // Any color the person picks freely (not limited to the 6 presets above).
  // When set, it takes over entirely — see the effect below.
  const [customColor, setCustomColorRaw] = useLocalStorage("fixit_local_custom_color", null);
  const { theme } = useContext(ThemeContext);

  // Whenever fontSize changes, reflect it on <html data-fontsize="..."> —
  // index.css scales the whole app off this attribute, so every page
  // (not just the one with the setting) picks it up immediately.
  useEffect(() => {
    document.documentElement.setAttribute("data-fontsize", fontSize);
  }, [fontSize]);

  // Whenever language changes, update <html lang="..."> for accessibility/
  // screen readers, and it's also what useTranslation reads from.
  useEffect(() => {
    document.documentElement.setAttribute("lang", language);
  }, [language]);

  // Preset accents (data-accent="purple" etc.) are handled entirely in CSS.
  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accentColor);
  }, [accentColor]);

  // A custom color can't be a fixed CSS rule (it's arbitrary), so it's
  // applied as inline styles on <html> — inline styles beat the
  // attribute-selector rules in index.css, so this genuinely overrides
  // whatever preset is selected, recoloring buttons, links, badges, the
  // hero gradient, AND the sidebar gradient together. Re-runs whenever
  // light/dark mode changes too, so switching modes keeps the custom
  // color legible instead of freezing it at whichever mode it was picked in.
  useEffect(() => {
    const root = document.documentElement;
    if (!customColor) {
      ["--blue", "--blue-dark", "--blue-soft", "--sidebar-from", "--sidebar-to"].forEach((v) => root.style.removeProperty(v));
      return;
    }
    const palette = derivePaletteFromColor(customColor, theme);
    root.style.setProperty("--blue", palette.blue);
    root.style.setProperty("--blue-dark", palette.blueDark);
    root.style.setProperty("--blue-soft", palette.blueSoft);
    root.style.setProperty("--sidebar-from", palette.sidebarFrom);
    root.style.setProperty("--sidebar-to", palette.sidebarTo);
  }, [customColor, theme]);

  // Picking a preset clears any custom color so the preset actually shows
  // (inline styles would otherwise keep winning over it).
  const setAccentColor = (color) => {
    setCustomColorRaw(null);
    setAccentColorRaw(color);
  };

  const setCustomColor = (hex) => setCustomColorRaw(hex);
  const clearCustomColor = () => setCustomColorRaw(null);

  return (
    <PersonalizationContext.Provider
      value={{
        fontSize, setFontSize,
        language, setLanguage,
        accentColor, setAccentColor,
        customColor, setCustomColor, clearCustomColor,
      }}
    >
      {children}
    </PersonalizationContext.Provider>
  );
}
