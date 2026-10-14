import { useSettingsStore } from "../../../hooks/useSettingsStore";
import { SectionCard, ToggleRow, FieldRow } from "../fields";

/**
 * Shared PrivacyTab with role-aware privacy toggles and controls.
 */
function PrivacyTab({ role = "customer" }) {
  const [privacy, updatePrivacy] = useSettingsStore(
    role === "admin" ? "platformPrivacy" : "privacy",
    role === "admin"
      ? { sessionTimeoutMinutes: 30, auditLogEnabled: true, ipAllowlist: "" }
      : role === "provider"
      ? { shareLocationWithCustomers: true, showEarningsPublicly: false }
      : { shareLocation: true, shareBookingHistoryWithProviders: true, personalizedAds: false }
  );

  if (role === "admin") {
    return (
      <SectionCard title="Privacy & Access Control">
        <FieldRow label="Admin session timeout (minutes)">
          <input
            type="number"
            min="5"
            value={privacy.sessionTimeoutMinutes}
            onChange={(e) => updatePrivacy({ sessionTimeoutMinutes: Number(e.target.value) })}
          />
        </FieldRow>
        <ToggleRow
          label="Enable audit logging"
          hint="Records every admin action to System Logs"
          checked={privacy.auditLogEnabled}
          onChange={(v) => updatePrivacy({ auditLogEnabled: v })}
        />
        <FieldRow label="Admin IP allowlist (comma-separated, optional)">
          <input
            value={privacy.ipAllowlist}
            onChange={(e) => updatePrivacy({ ipAllowlist: e.target.value })}
            placeholder="e.g. 203.0.113.10, 203.0.113.11"
          />
        </FieldRow>
      </SectionCard>
    );
  }

  if (role === "provider") {
    return (
      <SectionCard title="Privacy Settings">
        <ToggleRow
          label="Share live location with customers during active bookings"
          checked={privacy.shareLocationWithCustomers}
          onChange={(v) => updatePrivacy({ shareLocationWithCustomers: v })}
        />
        <ToggleRow
          label="Show earnings on public profile"
          hint="Not recommended — most providers keep this off"
          checked={privacy.showEarningsPublicly}
          onChange={(v) => updatePrivacy({ showEarningsPublicly: v })}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Privacy Settings">
      <ToggleRow
        label="Share live location during active bookings"
        hint="Lets your assigned provider see your location for tracking"
        checked={privacy.shareLocation}
        onChange={(v) => updatePrivacy({ shareLocation: v })}
      />
      <ToggleRow
        label="Share booking history with providers"
        hint="Helps providers understand your service preferences"
        checked={privacy.shareBookingHistoryWithProviders}
        onChange={(v) => updatePrivacy({ shareBookingHistoryWithProviders: v })}
      />
      <ToggleRow
        label="Personalized ads"
        checked={privacy.personalizedAds}
        onChange={(v) => updatePrivacy({ personalizedAds: v })}
      />
    </SectionCard>
  );
}

export default PrivacyTab;
