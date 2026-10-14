import { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";
import { PersonalizationContext } from "../context/PersonalizationContext";

// Each preset is a real hex pair (not a CSS var) purely for the preview
// swatch — it has to render correctly regardless of which theme is
// *currently* active, so it can't read from --blue etc. The actual applied
// colors still come from the CSS variable overrides in index.css; clicking
// a card just sets data-theme + data-accent together, same mechanism as
// the separate dark-mode toggle and accent picker did individually before.
const THEME_PRESETS = [
  { id: "classic-light", label: "Classic Light", mode: "light", accent: "blue", bg: "#f6f8fc", accentHex: "#2563eb", surface: "#ffffff" },
  { id: "midnight", label: "Midnight", mode: "dark", accent: "blue", bg: "#0b1220", accentHex: "#3b82f6", surface: "#121a2e" },
  { id: "royal-purple", label: "Royal Purple", mode: "light", accent: "purple", bg: "#f6f8fc", accentHex: "#7c3aed", surface: "#ffffff" },
  { id: "purple-night", label: "Purple Night", mode: "dark", accent: "purple", bg: "#0b1220", accentHex: "#a78bfa", surface: "#121a2e" },
  { id: "fresh-green", label: "Fresh Green", mode: "light", accent: "green", bg: "#f6f8fc", accentHex: "#059669", surface: "#ffffff" },
  { id: "forest-night", label: "Forest Night", mode: "dark", accent: "green", bg: "#0b1220", accentHex: "#34d399", surface: "#121a2e" },
  { id: "rose-blossom", label: "Rose Blossom", mode: "light", accent: "rose", bg: "#f6f8fc", accentHex: "#e11d48", surface: "#ffffff" },
  { id: "golden-hour", label: "Golden Hour", mode: "light", accent: "amber", bg: "#f6f8fc", accentHex: "#d97706", surface: "#ffffff" },
  { id: "ocean-teal", label: "Ocean Teal", mode: "light", accent: "teal", bg: "#f6f8fc", accentHex: "#0d9488", surface: "#ffffff" },
  { id: "deep-teal", label: "Deep Teal", mode: "dark", accent: "teal", bg: "#0b1220", accentHex: "#2dd4bf", surface: "#121a2e" },
];

function ThemeGallery() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { accentColor, setAccentColor, customColor, setCustomColor, clearCustomColor } = useContext(PersonalizationContext);

  const activePreset = THEME_PRESETS.find((p) => p.mode === theme && p.accent === accentColor);

  const applyPreset = (preset) => {
    setTheme(preset.mode);
    setAccentColor(preset.accent);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {["light", "dark"].map((m) => (
          <button
            key={m}
            type="button"
            className="btn"
            style={theme === m ? { background: "var(--blue-soft)", borderColor: "var(--blue)", color: "var(--blue)" } : {}}
            onClick={() => setTheme(m)}
          >
            {m === "light" ? "☀️ Light" : "🌙 Dark"}
          </button>
        ))}
      </div>

      {/* Real color picker — pick literally any color and the whole app
          (buttons, links, badges, sidebar gradient) recolors around it,
          not just a swap between a fixed list of preset combos. */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 14, marginBottom: 22,
          padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--stripe)",
        }}
      >
        <input
          type="color"
          value={customColor || "#2563eb"}
          onChange={(e) => setCustomColor(e.target.value)}
          style={{ width: 48, height: 48, border: "none", borderRadius: 10, cursor: "pointer", background: "none", padding: 0 }}
        />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Pick your own color</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
            {customColor
              ? `Applied everywhere — buttons, links, sidebar, badges (${customColor})`
              : "Choose any color and the entire app recolors around it, live"}
          </p>
        </div>
        {customColor && (
          <button type="button" className="btn" onClick={clearCustomColor} style={{ fontSize: 11.5 }}>
            Reset to presets
          </button>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 12px" }}>Or start from a preset:</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 14,
          marginBottom: 8,
          opacity: customColor ? 0.45 : 1,
          pointerEvents: customColor ? "none" : "auto",
        }}
      >
        {THEME_PRESETS.map((preset) => {
          const isActive = !customColor && activePreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              title={preset.label}
              style={{
                cursor: "pointer",
                borderRadius: 12,
                padding: 4,
                border: isActive ? `2px solid ${preset.accentHex}` : "2px solid var(--border)",
                background: "var(--surface)",
                boxShadow: isActive ? "var(--shadow-md)" : "none",
                transition: "transform 0.15s ease",
              }}
            >
              {/* Mini preview: a tiny "browser window" showing this theme's
                  actual background, surface card, and accent color together —
                  exactly what picking it will look like, at a glance. */}
              <div
                style={{
                  height: 56, borderRadius: 8, background: preset.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 8, marginBottom: 6, position: "relative", overflow: "hidden",
                }}
              >
                <div style={{ width: "70%", height: "70%", background: preset.surface, borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }} />
                <div style={{ position: "absolute", bottom: 10, left: 10, width: 18, height: 18, borderRadius: "50%", background: preset.accentHex }} />
                {isActive && (
                  <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: preset.accentHex, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 11, textAlign: "center", margin: 0, color: isActive ? preset.accentHex : "var(--ink)", fontWeight: isActive ? 600 : 400 }}>
                {preset.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ThemeGallery;
