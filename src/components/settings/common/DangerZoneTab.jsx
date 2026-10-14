import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { resetDemoData } from "../../../utils/resetDemoData";
import LogoutCard from "../LogoutCard";
import { SectionCard } from "../fields";

/**
 * Shared Danger Zone & Logout Tab.
 */
function DangerZoneTab({ role = "customer" }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleDeleteAccount = () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      logout();
      navigate("/login");
    }
  };

  const handleResetDemoData = () => {
    if (
      window.confirm(
        "Reset all platform demo data? This wipes every booking, complaint, review, and registered user from this browser and re-seeds fresh data."
      )
    ) {
      resetDemoData();
    }
  };

  return (
    <>
      <LogoutCard description={`Sign out of your ${role} account on this device.`} />

      <SectionCard title="Danger Zone">
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
          Permanently remove your account and all stored local preferences from this browser.
        </p>
        <button
          type="button"
          className="btn"
          style={{ color: "var(--red)", borderColor: "var(--red)", marginBottom: role === "admin" ? 16 : 0 }}
          onClick={handleDeleteAccount}
        >
          Delete Account
        </button>

        {role === "admin" && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16 }}>
            <h4 style={{ color: "var(--red)", margin: "0 0 6px 0", fontSize: 13 }}>Reset Platform Demo Data</h4>
            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
              Resets bookings, notifications, reviews, wallets, and registered accounts to the initial default state.
            </p>
            <button
              type="button"
              className="btn"
              style={{ color: "var(--red)", borderColor: "var(--red)" }}
              onClick={handleResetDemoData}
            >
              Reset All Demo Data
            </button>
          </div>
        )}
      </SectionCard>
    </>
  );
}

export default DangerZoneTab;
