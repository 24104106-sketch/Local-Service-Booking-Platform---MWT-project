import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useWallet } from "../../hooks/useWallet";
import { useSettingsStore } from "../../hooks/useSettingsStore";
import { useAddresses } from "../../hooks/useAddresses";
import { useTranslation } from "../../hooks/useTranslation";
import Layout from "../../components/Layout";
import Avatar from "../../components/Avatar";
import SettingsShell from "../../components/settings/SettingsShell";
import ThemeSection from "../../components/settings/ThemeSection";
import SecurityTab from "../../components/settings/common/SecurityTab";
import PrivacyTab from "../../components/settings/common/PrivacyTab";
import DangerZoneTab from "../../components/settings/common/DangerZoneTab";
import { SectionCard, ToggleRow } from "../../components/settings/fields";

/* ---------------- Account Information Overview ---------------- */
function AccountInfoTab() {
  const { user } = useAuth();
  return (
    <SectionCard title="Account Information" description="Name, photo, phone and email are managed on your full profile page.">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Avatar user={user} size={64} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{user?.email}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{user?.phone || "No phone on file"}</div>
        </div>
      </div>
      <Link to="/customer/profile" className="btn btn-primary">
        Edit Full Profile
      </Link>
    </SectionCard>
  );
}

/* ---------------- Notifications ---------------- */
function NotificationsTab() {
  const [prefs, updatePrefs] = useSettingsStore("notifications", {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    smsNotifications: true,
  });

  const rows = [
    { key: "bookingUpdates", label: "Booking updates", hint: "Confirmed, completed, cancelled notifications" },
    { key: "reminders", label: "Upcoming booking reminders", hint: "Alerts 2 hours before scheduled time" },
    { key: "promotions", label: "Promotions & offers", hint: "Discounts and seasonal specials" },
    { key: "smsNotifications", label: "SMS notifications", hint: "Important status updates via text" },
  ];

  return (
    <SectionCard title="Notification Preferences">
      {rows.map((r) => (
        <ToggleRow
          key={r.key}
          label={r.label}
          hint={r.hint}
          checked={prefs[r.key]}
          onChange={(v) => updatePrefs({ [r.key]: v })}
        />
      ))}
    </SectionCard>
  );
}

/* ---------------- Addresses ---------------- */
function AddressTab() {
  const { user } = useAuth();
  const { addresses, addAddress, removeAddress } = useAddresses();
  const [label, setLabel] = useState("");
  const [line, setLine] = useState("");

  const handleAdd = (e) => {
    e.preventDefault();
    if (addAddress(label, line)) {
      setLabel("");
      setLine("");
    }
  };

  return (
    <>
      <SectionCard title="Default Address" description="Used to pre-fill new bookings — edit it from your profile.">
        <p style={{ fontSize: 13.5, margin: "0 0 14px 0" }}>
          {user?.address || <span style={{ color: "var(--faint)" }}>No default address set</span>}
        </p>
        <Link to="/customer/profile" className="btn">
          Edit Default Address
        </Link>
      </SectionCard>

      <SectionCard title="Saved Addresses" description="These show up as quick-select options when booking a service.">
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="Label (Home, Office...)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ width: 150 }}
            required
          />
          <input
            placeholder="Address line (House, Street, City)"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
            required
          />
          <button type="submit" className="btn btn-primary">
            + Add Address
          </button>
        </form>

        {addresses.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>No saved addresses yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {addresses.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--stripe)",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>{a.label}</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{a.line}</div>
                </div>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeAddress(a.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function CustomerSettings() {
  const { t } = useTranslation();

  const sections = [
    {
      id: "account",
      title: "Account",
      icon: "👤",
      items: [
        {
          id: "account_info",
          title: "Account Information",
          description: "Manage your name, email, phone number and profile photo.",
          icon: "👤",
          color: "blue",
          content: <AccountInfoTab />,
        },
        {
          id: "security",
          title: "Security & Password",
          description: "Change your password and manage login security preferences.",
          icon: "🔒",
          color: "green",
          content: <SecurityTab role="customer" />,
        },
        {
          id: "addresses",
          title: "Addresses",
          description: "Add, edit or remove your saved addresses for service bookings.",
          icon: "📍",
          color: "purple",
          content: <AddressTab />,
        },
      ],
    },
    {
      id: "preferences",
      title: "Preferences",
      icon: "🎛️",
      items: [
        {
          id: "notifications",
          title: "Notifications",
          description: "Choose what notifications you want to receive and how you receive them.",
          icon: "🔔",
          color: "gold",
          content: <NotificationsTab />,
        },
        {
          id: "appearance",
          title: "Appearance",
          description: "Customize theme, language and other display preferences.",
          icon: "🎨",
          color: "magenta",
          content: <ThemeSection />,
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy",
      icon: "🛡️",
      items: [
        {
          id: "privacy",
          title: "Privacy Settings",
          description: "Manage your privacy preferences and data permissions.",
          icon: "🛡️",
          color: "teal",
          content: <PrivacyTab role="customer" />,
        },
      ],
    },
    {
      id: "danger",
      title: "Danger Zone",
      icon: "⚠️",
      isDanger: true,
      items: [
        {
          id: "delete",
          title: "Delete Account",
          description: "Permanently delete your account and all your data.",
          icon: "🗑️",
          color: "red",
          actionLabel: "Delete Account",
          content: <DangerZoneTab role="customer" />,
        },
      ],
    },
  ];

  return (
    <Layout title={t("settings")}>
      <SettingsShell sections={sections} />
    </Layout>
  );
}

export default CustomerSettings;
