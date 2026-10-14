import PreferencesPanel from "../PreferencesPanel";
import ThemeGallery from "../ThemeGallery";

// PreferencesPanel + the "App Theme" heading/copy + ThemeGallery was the
// exact same block pasted into customer, provider, and admin
// Personalization/Appearance tabs. Theming is app-wide, not per-role, so
// there's no reason for three copies of this markup.
function ThemeSection() {
  return (
    <>
      <PreferencesPanel />
      <h3>App Theme</h3>
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: -6, marginBottom: 14 }}>
        Pick a full look — light or dark mode and accent color together.
      </p>
      <ThemeGallery />
    </>
  );
}

export default ThemeSection;
