import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import heroImg from "../assets/illustrations/login-hero-card.png";
import Modal from "../components/Modal";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  // Forgot Password / Reset Flow State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState("request"); // 'request' | 'reset'
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetTokenInput, setResetTokenInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  // Google Setup Info Modal
  const [googleConfigModalOpen, setGoogleConfigModalOpen] = useState(false);

  const { login, googleLogin, requestPasswordReset, confirmPasswordReset, loading, error } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleBtnContainerRef = useRef(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Handle URL reset token from email link (?resetToken=...&email=...)
  useEffect(() => {
    const urlToken = searchParams.get("resetToken") || searchParams.get("token");
    const urlEmail = searchParams.get("email");
    if (urlToken) {
      setResetTokenInput(urlToken);
      if (urlEmail) setForgotEmail(urlEmail);
      setForgotStep("reset");
      setForgotModalOpen(true);
    }
  }, [searchParams]);

  // Navigate to appropriate role dashboard
  const handleRoleRedirect = useCallback(
    (authenticatedUser) => {
      const userRole = authenticatedUser?.role;
      if (userRole === "admin") {
        navigate("/admin/dashboard");
      } else if (userRole === "provider") {
        navigate("/provider/dashboard");
      } else {
        navigate("/customer/dashboard");
      }
    },
    [navigate]
  );

  // Google GIS Credential Callback
  const handleGoogleCredentialResponse = useCallback(
    async (response) => {
      if (!response?.credential) {
        showToast("No Google credential received.", "error");
        return;
      }
      try {
        const authUser = await googleLogin(response.credential);
        showToast(`Signed in with Google as ${authUser?.name || "User"}!`, "success");
        handleRoleRedirect(authUser);
      } catch (err) {
        showToast(err.message || "Google sign-in failed. Please check backend token verification.", "error");
      }
    },
    [googleLogin, showToast, handleRoleRedirect]
  );

  // Initialize official Google Identity Services if client ID is configured
  useEffect(() => {
    if (window.google?.accounts?.id && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });

        if (googleBtnContainerRef.current) {
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: "outline",
            size: "large",
            width: "100%",
            text: "continue_with",
            shape: "rectangular",
          });
        }
      } catch (e) {
        console.warn("[Google GIS] Initialization warning:", e);
      }
    }
  }, [googleClientId, handleGoogleCredentialResponse]);

  const handleGoogleButtonClick = () => {
    if (!googleClientId) {
      setGoogleConfigModalOpen(true);
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      showToast("Google Identity Services is loading. Please try again in a moment.", "info");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!email.trim() || !password) {
      setFormError("Please enter both email and password.");
      return;
    }

    try {
      const authenticatedUser = await login({ email: email.trim(), password });
      showToast(`Welcome back, ${authenticatedUser?.name || "User"}!`, "success");
      handleRoleRedirect(authenticatedUser);
    } catch {
      // Error handled by Auth Context
    }
  };

  // Forgot Password: Step 1 (Send Email Request)
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");

    if (!forgotEmail.trim()) {
      setForgotError("Please enter your registered email address.");
      return;
    }

    setForgotLoading(true);
    try {
      await requestPasswordReset(forgotEmail.trim());
      setForgotMessage(
        "If an account exists for this email, password reset instructions have been sent. Please check your inbox or spam folder."
      );
      showToast("Reset request processed. Check your email.", "info");
    } catch (err) {
      setForgotError(err.message || "Failed to process password reset request.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password: Step 2 (Submit New Password with Token)
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");

    if (!resetTokenInput.trim() || !newPassword) {
      setForgotError("Please provide the reset token and your new password.");
      return;
    }

    if (newPassword.length < 6) {
      setForgotError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await confirmPasswordReset(resetTokenInput.trim(), newPassword);
      showToast(res?.data?.message || "Password has been reset successfully!", "success");
      setForgotModalOpen(false);
      setForgotStep("request");
      setResetTokenInput("");
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
    } catch (err) {
      setForgotError(err.response?.data?.message || err.message || "Invalid or expired reset token.");
    } finally {
      setForgotLoading(false);
    }
  };

  const displayError = formError || error;

  return (
    <div className="login-fullpage-layout">
      {/* ================= LEFT HERO SPLIT ================= */}
      <div className="login-fullpage-left">
        <motion.div
          className="hero-inner-container"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="login-hero-image-wrapper">
            <img src={heroImg} alt="FixIt Local Hero" className="login-hero-3d-img" />
          </div>

          <div className="login-hero-content">
            <div className="login-trust-badge">
              <span className="badge-shield-icon">🛡️</span>
              <span>TRUSTED LOCAL SERVICES</span>
            </div>

            <h1 className="login-brand-title">
              FixIt <span className="login-brand-accent">Local</span>
            </h1>

            <p className="login-brand-subtitle">Reliable services. Right at your doorstep.</p>

            <div className="login-features-row">
              <div className="login-feature-item">
                <div className="feature-icon-circle blue">🛡️</div>
                <div className="feature-text-block">
                  <strong>Verified Professionals</strong>
                  <p>Skilled &amp; verified experts you can trust.</p>
                </div>
              </div>

              <div className="login-feature-item">
                <div className="feature-icon-circle gold">⚡</div>
                <div className="feature-text-block">
                  <strong>Community Discovery</strong>
                  <p>Find nearby providers for your apartment complex.</p>
                </div>
              </div>

              <div className="login-feature-item">
                <div className="feature-icon-circle green">📍</div>
                <div className="feature-text-block">
                  <strong>Live GPS Tracking</strong>
                  <p>Real-time location beacon when provider is on the way.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ================= RIGHT FORM SPLIT ================= */}
      <div className="login-fullpage-right">
        <motion.div
          className="login-form-inner"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="login-form-header">
            <h2>Welcome back 👋</h2>
            <p>
              Sign in to continue to <span className="brand-highlight">FixIt Local</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-main-form">
            {/* Email Field */}
            <div className="login-input-group">
              <label htmlFor="login-email">Email address</label>
              <div className="input-with-icon">
                <span className="input-leading-icon">✉️</span>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="login-input-group">
              <div className="password-label-row">
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotModalOpen(true);
                  }}
                  className="forgot-password-link"
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-with-icon">
                <span className="input-leading-icon">🔒</span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {displayError && <div className="login-error-banner">{displayError}</div>}

            {/* Submit Button */}
            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? "Signing in..." : "Login →"}
            </button>

            {/* Social Divider */}
            <div className="login-divider">
              <span>or continue with</span>
            </div>

            {/* Google OAuth Button / GIS Container */}
            {googleClientId ? (
              <div ref={googleBtnContainerRef} style={{ width: "100%", minHeight: 44, display: "flex", justifyContent: "center" }}>
                {/* Rendered by Google Identity Services */}
              </div>
            ) : (
              <button
                type="button"
                className="login-google-btn"
                onClick={handleGoogleButtonClick}
                disabled={loading}
              >
                <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}

            {/* Register Footer */}
            <p className="login-register-prompt">
              New to FixIt Local?{" "}
              <Link to="/register" className="register-link">
                Create an account →
              </Link>
            </p>
          </form>

          {/* Security & Trust Footer */}
          <div className="login-security-footer">
            <span>🔒 Secure login</span>
            <span className="dot-sep">•</span>
            <span>✅ Verified providers</span>
            <span className="dot-sep">•</span>
            <span>🛡️ © 2026 FixIt Local</span>
          </div>
        </motion.div>
      </div>

      {/* ================= REAL FORGOT PASSWORD MODAL ================= */}
      {forgotModalOpen && (
        <Modal
          title={forgotStep === "request" ? "🔒 Reset Your Password" : "🔑 Set New Password"}
          isOpen={forgotModalOpen}
          onClose={() => {
            setForgotModalOpen(false);
            setForgotError("");
            setForgotMessage("");
          }}
        >
          {forgotStep === "request" ? (
            <form onSubmit={handleRequestReset}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, marginBottom: 16 }}>
                Enter your registered email address. We'll send you a secure one-time password reset link with a 15-minute validity.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 4 }}>
                  Registered Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="text-input"
                  style={{ width: "100%" }}
                  disabled={forgotLoading}
                />
              </div>

              {forgotMessage && (
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid #10b981",
                    color: "#10b981",
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    marginBottom: 14,
                  }}
                >
                  ✓ {forgotMessage}
                </div>
              )}

              {forgotError && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    color: "#fca5a5",
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    marginBottom: 14,
                  }}
                >
                  ⚠️ {forgotError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setForgotStep("reset")}
                >
                  Have a reset token? Enter it here →
                </button>

                <button type="submit" className="btn btn-primary" disabled={forgotLoading}>
                  {forgotLoading ? "Sending Link..." : "Send Reset Email"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmReset}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, marginBottom: 16 }}>
                Enter the one-time reset token from your email and your new password.
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 4 }}>
                  Reset Token / Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste 64-character token from email"
                  value={resetTokenInput}
                  onChange={(e) => setResetTokenInput(e.target.value)}
                  className="text-input"
                  style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                  disabled={forgotLoading}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 4 }}>
                  New Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-input"
                  style={{ width: "100%" }}
                  disabled={forgotLoading}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 4 }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-input"
                  style={{ width: "100%" }}
                  disabled={forgotLoading}
                />
              </div>

              {forgotError && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    color: "#fca5a5",
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    marginBottom: 14,
                  }}
                >
                  ⚠️ {forgotError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setForgotStep("request")}
                >
                  ← Request another link
                </button>

                <button type="submit" className="btn btn-primary" disabled={forgotLoading}>
                  {forgotLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ================= GOOGLE OAUTH CONFIGURATION GUIDANCE MODAL ================= */}
      {googleConfigModalOpen && (
        <Modal
          title="🔐 Google Sign-In Configuration"
          isOpen={googleConfigModalOpen}
          onClose={() => setGoogleConfigModalOpen(false)}
        >
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)" }}>
            <p style={{ marginTop: 0 }}>
              FixIt Local uses <strong>Official Google Identity Services (GIS)</strong> with backend OAuth2 token verification.
            </p>
            <p>
              To enable Google Sign-In with real Google accounts, configure your Google Cloud Client ID:
            </p>
            <ol style={{ paddingLeft: 20, margin: "10px 0" }}>
              <li>
                Open <strong>Google Cloud Console</strong> &rarr; <em>APIs &amp; Services</em> &rarr; <em>Credentials</em>.
              </li>
              <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web application).</li>
              <li>
                Add Authorized JavaScript origins:
                <br />
                <code style={{ background: "var(--stripe)", padding: "2px 6px", borderRadius: 4 }}>http://localhost:5173</code>
              </li>
              <li>
                Add Authorized redirect URIs:
                <br />
                <code style={{ background: "var(--stripe)", padding: "2px 6px", borderRadius: 4 }}>http://localhost:5173</code>
              </li>
              <li>
                Set the Client ID in your project root <code style={{ color: "var(--blue)" }}>.env</code>:
                <br />
                <code style={{ background: "var(--stripe)", padding: "2px 6px", borderRadius: 4 }}>
                  VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
                </code>
              </li>
              <li>
                Set the Client ID in <code style={{ color: "var(--blue)" }}>backend/.env</code>:
                <br />
                <code style={{ background: "var(--stripe)", padding: "2px 6px", borderRadius: 4 }}>
                  GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
                </code>
              </li>
            </ol>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn btn-primary" onClick={() => setGoogleConfigModalOpen(false)}>
                Got It
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
