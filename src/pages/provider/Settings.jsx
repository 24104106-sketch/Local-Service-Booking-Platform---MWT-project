import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSettingsStore } from "../../hooks/useSettingsStore";
import { useTranslation } from "../../hooks/useTranslation";
import { useBookings } from "../../hooks/useBookings";
import { parseAmount, formatCurrency } from "../../utils/currency";
import Layout from "../../components/Layout";
import Avatar from "../../components/Avatar";
import SettingsShell from "../../components/settings/SettingsShell";
import ThemeSection from "../../components/settings/ThemeSection";
import SecurityTab from "../../components/settings/common/SecurityTab";
import PrivacyTab from "../../components/settings/common/PrivacyTab";
import DangerZoneTab from "../../components/settings/common/DangerZoneTab";
import { SectionCard, ToggleRow, FieldRow, LinkCard } from "../../components/settings/fields";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------------- Business Info ---------------- */
function BusinessInfoTab() {
  const { user } = useAuth();
  return (
    <SectionCard title="Business Information" description="Business name, category, experience and bio are managed on your full profile page.">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Avatar user={user} size={64} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.businessName || user?.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{user?.email}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{user?.category || "No category set"}</div>
        </div>
      </div>
      <Link to="/provider/profile" className="btn btn-primary">
        Edit Full Profile
      </Link>
    </SectionCard>
  );
}

/* ---------------- Availability & Hours ---------------- */
function AvailabilityTab() {
  const { user, updateProfile } = useAuth();
  const isOnline = (user?.availabilityStatus ?? "ONLINE") !== "OFFLINE";
  const [hours, updateHours] = useSettingsStore("workingHours", {
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false },
    start: "09:00",
    end: "18:00",
  });

  const toggleDay = (d) => updateHours({ days: { ...hours.days, [d]: !hours.days[d] } });

  return (
    <>
      <SectionCard title="Accepting New Bookings">
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
          Toggle off if you're fully booked or on leave — customers won't be able to book you while offline.
        </p>
        <button
          type="button"
          className={`btn ${isOnline ? "btn-primary" : ""}`}
          onClick={() => updateProfile({ availabilityStatus: isOnline ? "OFFLINE" : "ONLINE" })}
        >
          {isOnline ? "🟢 Online" : "⚪ Offline"}
        </button>
      </SectionCard>

      <SectionCard title="Working Days & Operating Hours">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              className="btn"
              style={hours.days[d] ? { background: "var(--blue-soft)", borderColor: "var(--blue)", color: "var(--blue)" } : {}}
              onClick={() => toggleDay(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <FieldRow label="Start Time">
            <input type="time" value={hours.start} onChange={(e) => updateHours({ start: e.target.value })} />
          </FieldRow>
          <FieldRow label="End Time">
            <input type="time" value={hours.end} onChange={(e) => updateHours({ end: e.target.value })} />
          </FieldRow>
        </div>
      </SectionCard>

      <LinkCard to="/provider/availability" icon="🗓️" title="Manage Time Slots" description="Set your exact day-by-day available time slots for customer bookings" />
    </>
  );
}

/* ---------------- Services & Pricing ---------------- */
function ServiceSettingsTab() {
  const [prefs, updatePrefs] = useSettingsStore("serviceSettings", { showPricingPublicly: true, minNoticeHours: 2 });
  return (
    <>
      <LinkCard to="/provider/services" icon="🧰" title="Manage Services Catalog" description="Add, edit, price and activate/deactivate the services you offer" />
      <SectionCard title="Service Display Settings">
        <ToggleRow
          label="Show pricing publicly"
          hint="If off, customers see 'Contact for price' instead of exact rates"
          checked={prefs.showPricingPublicly}
          onChange={(v) => updatePrefs({ showPricingPublicly: v })}
        />
        <FieldRow label="Minimum booking notice (hours)">
          <input type="number" min="0" value={prefs.minNoticeHours} onChange={(e) => updatePrefs({ minNoticeHours: Number(e.target.value) })} />
        </FieldRow>
      </SectionCard>
    </>
  );
}

/* ---------------- Earnings & Payout ---------------- */
function EarningsPayoutTab() {
  const { user } = useAuth();
  const { bookings } = useBookings();
  const [payout, updatePayout] = useSettingsStore("payout", { method: "bank", schedule: "weekly", upiId: "", accountNumber: "" });

  const completed = bookings.filter((b) => b.provider === user?.name && b.status === "Completed");
  const monthLabel = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const monthlyEarnings = completed.filter((b) => b.date && b.date.includes(monthLabel)).reduce((sum, b) => sum + parseAmount(b.amount), 0);

  return (
    <>
      <SectionCard title="Earnings Summary">
        <p style={{ fontSize: 13.5, margin: "0 0 4px 0" }}>
          This month: <strong>{formatCurrency(monthlyEarnings)}</strong>
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px 0" }}>{completed.length} completed jobs all time.</p>
        <Link to="/provider/earnings" className="btn btn-sm">
          View Full Earnings
        </Link>
      </SectionCard>

      <SectionCard title="Payout Settings">
        <FieldRow label="Payout Method">
          <select value={payout.method} onChange={(e) => updatePayout({ method: e.target.value })}>
            <option value="bank">Bank Transfer</option>
            <option value="upi">UPI</option>
          </select>
        </FieldRow>
        {payout.method === "upi" ? (
          <FieldRow label="UPI ID">
            <input value={payout.upiId} onChange={(e) => updatePayout({ upiId: e.target.value })} placeholder="name@bank" />
          </FieldRow>
        ) : (
          <FieldRow label="Account Number">
            <input value={payout.accountNumber} onChange={(e) => updatePayout({ accountNumber: e.target.value })} placeholder="XXXXXXXXXXXX" />
          </FieldRow>
        )}
        <FieldRow label="Payout Schedule">
          <select value={payout.schedule} onChange={(e) => updatePayout({ schedule: e.target.value })}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </FieldRow>
      </SectionCard>
    </>
  );
}

/* ---------------- Notifications ---------------- */
function NotificationsTab() {
  const [prefs, updatePrefs] = useSettingsStore("notifications", {
    newBookingRequests: true,
    customerMessages: true,
    payoutAlerts: true,
    promotions: false,
  });

  const rows = [
    { key: "newBookingRequests", label: "New booking requests" },
    { key: "customerMessages", label: "Customer messages" },
    { key: "payoutAlerts", label: "Payout & wallet alerts" },
    { key: "promotions", label: "Platform announcements" },
  ];

  return (
    <SectionCard title="Notification Preferences">
      {rows.map((r) => (
        <ToggleRow key={r.key} label={r.label} checked={prefs[r.key]} onChange={(v) => updatePrefs({ [r.key]: v })} />
      ))}
    </SectionCard>
  );
}

function ProviderSettings() {
  const { t } = useTranslation();

  const sections = [
    {
      id: "account",
      title: "Account & Business",
      icon: "👤",
      items: [
        {
          id: "business_info",
          title: "Business Information",
          description: "Manage your business name, bio, and profile photo.",
          icon: "👤",
          color: "blue",
          content: <BusinessInfoTab />,
        },
        {
          id: "security",
          title: "Security & Password",
          description: "Change your password and manage login security preferences.",
          icon: "🔒",
          color: "green",
          content: <SecurityTab role="provider" />,
        },
        {
          id: "availability",
          title: "Availability & Hours",
          description: "Manage your online status and daily operating schedule.",
          icon: "🕒",
          color: "purple",
          content: <AvailabilityTab />,
        },
      ],
    },
    {
      id: "preferences",
      title: "Preferences & Operations",
      icon: "🎛️",
      items: [
        {
          id: "services",
          title: "Services & Pricing",
          description: "Configure public pricing visibility and minimum notice time.",
          icon: "🧰",
          color: "teal",
          content: <ServiceSettingsTab />,
        },
        {
          id: "payout",
          title: "Earnings & Payout",
          description: "Set up your bank account or UPI ID for weekly payouts.",
          icon: "💵",
          color: "green",
          content: <EarningsPayoutTab />,
        },
        {
          id: "notifications",
          title: "Notifications",
          description: "Choose which alerts you receive for bookings and messages.",
          icon: "🔔",
          color: "gold",
          content: <NotificationsTab />,
        },
        {
          id: "appearance",
          title: "Appearance",
          description: "Customize theme, language and display settings.",
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
          description: "Manage your data permissions and profile visibility.",
          icon: "🛡️",
          color: "teal",
          content: <PrivacyTab role="provider" />,
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
          description: "Permanently delete your provider account and all your data.",
          icon: "🗑️",
          color: "red",
          actionLabel: "Delete Account",
          content: <DangerZoneTab role="provider" />,
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

export default ProviderSettings;
