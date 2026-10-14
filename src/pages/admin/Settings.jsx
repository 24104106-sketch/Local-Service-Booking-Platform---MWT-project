import { useState, useContext } from "react";
import { useSettingsStore } from "../../hooks/useSettingsStore";
import { useTranslation } from "../../hooks/useTranslation";
import { useFetch } from "../../hooks/useFetch";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationContext } from "../../context/NotificationContext";
import Layout from "../../components/Layout";
import SettingsShell from "../../components/settings/SettingsShell";
import ThemeSection from "../../components/settings/ThemeSection";
import SecurityTab from "../../components/settings/common/SecurityTab";
import PrivacyTab from "../../components/settings/common/PrivacyTab";
import DangerZoneTab from "../../components/settings/common/DangerZoneTab";
import { SectionCard, ToggleRow, FieldRow, LinkCard } from "../../components/settings/fields";

/* ---------------- Platform Settings ---------------- */
function PlatformSettingsTab() {
  const [platform, updatePlatform] = useSettingsStore("platform", {
    siteName: "FixIt Local",
    supportEmail: "support@fixitlocal.example",
    currency: "INR",
    maintenanceMode: false,
  });
  const [users, updateUsers] = useSettingsStore("userManagement", {
    defaultRole: "customer",
    autoSuspendComplaintThreshold: 3,
  });
  const [verification, updateVerification] = useSettingsStore("providerVerification", {
    autoApproveExperienceYears: 0,
    requireIdProof: true,
    requireAddressProof: true,
    requireBackgroundCheck: false,
  });
  const [categoryPrefs, updateCategoryPrefs] = useSettingsStore("categoryManagement", {
    allowProviderRequests: true,
    requireApprovalForNewCategory: true,
  });
  const [bookingRules, updateBookingRules] = useSettingsStore("bookingManagement", {
    cancellationWindowHours: 2,
    noShowPenalty: true,
  });
  const [commission, updateCommission] = useSettingsStore("paymentCommission", {
    commissionPercent: 15,
    payoutCycle: "weekly",
    minPayoutAmount: 500,
  });

  return (
    <>
      <SectionCard title="General Platform Settings">
        <FieldRow label="Site Name">
          <input value={platform.siteName} onChange={(e) => updatePlatform({ siteName: e.target.value })} />
        </FieldRow>
        <FieldRow label="Support Email">
          <input value={platform.supportEmail} onChange={(e) => updatePlatform({ supportEmail: e.target.value })} />
        </FieldRow>
        <FieldRow label="Default Currency">
          <select value={platform.currency} onChange={(e) => updatePlatform({ currency: e.target.value })}>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </FieldRow>
        <ToggleRow
          label="Maintenance mode"
          hint="Shows a maintenance alert to all non-admin users"
          checked={platform.maintenanceMode}
          onChange={(v) => updatePlatform({ maintenanceMode: v })}
        />
      </SectionCard>

      <SectionCard title="Users & Provider Rules">
        <FieldRow label="Default role for new signups">
          <select value={users.defaultRole} onChange={(e) => updateUsers({ defaultRole: e.target.value })}>
            <option value="customer">Customer</option>
            <option value="provider">Service Provider</option>
          </select>
        </FieldRow>
        <FieldRow label="Auto-suspend after this many upheld complaints">
          <input
            type="number"
            min="1"
            value={users.autoSuspendComplaintThreshold}
            onChange={(e) => updateUsers({ autoSuspendComplaintThreshold: Number(e.target.value) })}
          />
        </FieldRow>
        <ToggleRow label="Require government ID proof for providers" checked={verification.requireIdProof} onChange={(v) => updateVerification({ requireIdProof: v })} />
        <ToggleRow label="Require address proof for providers" checked={verification.requireAddressProof} onChange={(v) => updateVerification({ requireAddressProof: v })} />
      </SectionCard>

      <SectionCard title="Commission & Payments">
        <FieldRow label={`Platform commission: ${commission.commissionPercent}%`}>
          <input
            type="range"
            min="0"
            max="40"
            value={commission.commissionPercent}
            onChange={(e) => updateCommission({ commissionPercent: Number(e.target.value) })}
          />
        </FieldRow>
        <FieldRow label="Provider payout cycle">
          <select value={commission.payoutCycle} onChange={(e) => updateCommission({ payoutCycle: e.target.value })}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </FieldRow>
      </SectionCard>
    </>
  );
}

/* ---------------- System Activity Overview ---------------- */
function SystemTab() {
  const { notifications } = useContext(NotificationContext);
  const recent = notifications.slice(0, 5);

  return (
    <SectionCard title="System Activity Logs" description={`${notifications.length} platform events recorded.`}>
      <LinkCard to="/admin/system-logs" icon="🧾" title="View Full Activity Log" description="Search and filter every platform event" />
      {recent.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 12.5 }}>No activity recorded yet.</p>
      ) : (
        recent.map((n) => (
          <div
            key={n.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 12.5,
            }}
          >
            <span>
              <strong>{n.title}</strong> — <span style={{ color: "var(--muted)" }}>{n.recipient}</span>
            </span>
          </div>
        ))
      )}
    </SectionCard>
  );
}

/* ---------------- Notification Broadcast Management ---------------- */
function NotificationManagementTab() {
  const [prefs, updatePrefs] = useSettingsStore("notifications", {
    newProviderApplications: true,
    complaintAlerts: true,
    systemReports: false,
    userSignups: false,
  });
  const { data: platformUsers } = useFetch(fetchPlatformUsers);
  const { notify } = useNotifications();
  const [announcement, setAnnouncement] = useState("");
  const [sent, setSent] = useState(false);

  const rows = [
    { key: "newProviderApplications", label: "New provider applications" },
    { key: "complaintAlerts", label: "Complaint alerts" },
    { key: "systemReports", label: "Weekly system reports" },
    { key: "userSignups", label: "New user signups" },
  ];

  const handleSend = (e) => {
    e.preventDefault();
    if (!announcement.trim() || !platformUsers) return;
    platformUsers.forEach((u) => notify(u.name, "Platform Announcement", announcement.trim()));
    setAnnouncement("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <>
      <SectionCard title="My Notification Preferences">
        {rows.map((r) => (
          <ToggleRow key={r.key} label={r.label} checked={prefs[r.key]} onChange={(v) => updatePrefs({ [r.key]: v })} />
        ))}
      </SectionCard>

      <SectionCard title="Broadcast Announcement" description={`Send a platform-wide notification to all ${platformUsers?.length ?? "…"} registered users.`}>
        <form onSubmit={handleSend}>
          <textarea rows={3} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="e.g. Scheduled maintenance on Sunday 2–4 AM" />
          <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }} disabled={!platformUsers}>
            Send to All Users
          </button>
          {sent && <span style={{ marginLeft: 12, color: "var(--green)", fontSize: 12 }}>Sent to every user's notification feed!</span>}
        </form>
      </SectionCard>
    </>
  );
}

function AdminSettings() {
  const { t } = useTranslation();

  const sections = [
    {
      id: "platform",
      title: "Platform & System",
      icon: "⚙️",
      items: [
        {
          id: "platform_config",
          title: "Platform Configuration",
          description: "Site name, support email, maintenance mode and default currency.",
          icon: "⚙️",
          color: "blue",
          content: <PlatformSettingsTab />,
        },
        {
          id: "security",
          title: "Security & Access",
          description: "Change password, manage login sessions and access permissions.",
          icon: "🔒",
          color: "green",
          content: <SecurityTab role="admin" />,
        },
        {
          id: "system",
          title: "System Logs & Audit",
          description: "View real-time event logs, booking actions and system alerts.",
          icon: "🧾",
          color: "purple",
          content: <SystemTab />,
        },
      ],
    },
    {
      id: "preferences",
      title: "Preferences & Broadcasts",
      icon: "🎛️",
      items: [
        {
          id: "notifications",
          title: "Broadcast & Notifications",
          description: "Manage system alerts and send platform-wide announcements.",
          icon: "📣",
          color: "gold",
          content: <NotificationManagementTab />,
        },
        {
          id: "appearance",
          title: "Appearance",
          description: "Customize platform theme, colors, and layout display.",
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
          description: "Manage privacy policies and administrator permissions.",
          icon: "🛡️",
          color: "teal",
          content: <PrivacyTab role="admin" />,
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
          id: "danger_zone",
          title: "Reset Platform Demo Data",
          description: "Reset all platform demo data or delete administrative account.",
          icon: "🗑️",
          color: "red",
          actionLabel: "Reset / Delete",
          content: <DangerZoneTab role="admin" />,
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

export default AdminSettings;
