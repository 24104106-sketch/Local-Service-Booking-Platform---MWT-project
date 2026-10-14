import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Wraps a page and redirects to /login if not logged in,
 * or to that role's dashboard if the role doesn't match.
 * Usage: <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
 */
function ProtectedRoute({ role, children }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    } else if (role && user.role !== role) {
      navigate(`/${user.role}/dashboard`);
    }
  }, [isAuthenticated, user, role, navigate]);

  if (!isAuthenticated || (role && user.role !== role)) {
    return null; // brief flash before redirect effect runs
  }

  return children;
}

export default ProtectedRoute;
