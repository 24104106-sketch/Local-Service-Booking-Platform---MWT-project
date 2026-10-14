import { useContext, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";

/**
 * Sticky glass navbar for the public landing page.
 */
function PublicNavbar() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const navRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { href: "#categories", label: "Services" },
    { href: "#how-it-works", label: "How it Works" },
    { href: "#why-us", label: "Why Us" },
    { href: "#testimonials", label: "Reviews" },
  ];

  useEffect(() => {
    const sectionIds = links.map((l) => l.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header ref={navRef} className={`public-nav ${scrolled ? "public-nav--scrolled" : ""}`}>
      <div className="public-nav__inner">
        <Link to="/" className="public-nav__brand">
          <span className="public-nav__logo">🔧</span>
          FixIt Local
        </Link>

        <nav className="public-nav__links">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={activeSection === l.href.slice(1) ? "public-nav__link--active" : ""}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="public-nav__actions">
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          {isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn btn-primary" onClick={() => navigate(`/${user.role}/dashboard`)}>
                Go to Dashboard
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn">Login</Link>
              <Link to="/register" className="btn btn-primary">Get Started</Link>
            </>
          )}

          <button className="public-nav__burger" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="public-nav__mobile">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>{l.label}</a>
          ))}
          <div className="public-nav__mobile-actions">
            {isAuthenticated ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate(`/${user.role}/dashboard`);
                  }}
                >
                  Go to Dashboard
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn" onClick={() => setMobileOpen(false)}>Login</Link>
                <Link to="/register" className="btn btn-primary" onClick={() => setMobileOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default PublicNavbar;
