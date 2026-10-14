import { useAuth } from "../../hooks/useAuth";
import { SectionCard } from "./fields";

// The logout button + handler was identical (or near-identical) across
// customer, provider, and admin Settings — same handleLogout, same
// SectionCard shape. `description` lets each role keep its own wording
// without re-implementing the logic.
function LogoutCard({ description = "Sign out of your account on this device." }) {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <SectionCard title="Logout">
      <p style={{ fontSize: 12.5, color: "var(--muted)" }}>{description}</p>
      <button className="btn" onClick={handleLogout}>Logout</button>
    </SectionCard>
  );
}

export default LogoutCard;
