import { useAuth } from "../../../hooks/useAuth";
import { useSettingsStore } from "../../../hooks/useSettingsStore";
import ChangePasswordCard from "../ChangePasswordCard";
import { SectionCard, ToggleRow, LinkCard } from "../fields";

/**
 * Shared SecurityTab for Customer, Provider, and Admin settings.
 */
function SecurityTab({ role = "customer" }) {
  const { user } = useAuth();
  const [security, updateSecurity] = useSettingsStore("security", {
    loginAlerts: true,
    requirePasswordNewDevice: true,
    twoFactorEnabled: false,
  });

  const recentLogins = [
    { device: "Chrome · Windows", location: "Chennai, IN", date: "Today, 09:14 AM" },
    { device: "Safari · iPhone", location: "Chennai, IN", date: "Yesterday, 07:02 PM" },
  ];

  return (
    <>
      {role === "admin" && (
        <LinkCard
          to="/admin/profile"
          icon="👤"
          title={user?.name || "Admin Profile"}
          description="View and edit your full admin profile"
        />
      )}

      <ChangePasswordCard />

      <SectionCard title="Login Security">
        <ToggleRow
          label="Email me on new device login"
          hint="Get notified whenever your account is used from a device we don't recognize"
          checked={security.loginAlerts}
          onChange={(v) => updateSecurity({ loginAlerts: v })}
        />
        {role !== "admin" && (
          <ToggleRow
            label="Require password confirmation on new devices"
            checked={security.requirePasswordNewDevice}
            onChange={(v) => updateSecurity({ requirePasswordNewDevice: v })}
          />
        )}
        {role === "admin" && (
          <ToggleRow
            label="Require a one-time code at login (2FA)"
            hint="Adds an extra verification step beyond your password"
            checked={security.twoFactorEnabled}
            onChange={(v) => updateSecurity({ twoFactorEnabled: v })}
          />
        )}
      </SectionCard>

      {role === "admin" && (
        <SectionCard title="Recent Login Activity">
          {recentLogins.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: 12.5,
              }}
            >
              <span>
                {l.device} · {l.location}
              </span>
              <span style={{ color: "var(--muted)" }}>{l.date}</span>
            </div>
          ))}
        </SectionCard>
      )}
    </>
  );
}

export default SecurityTab;
