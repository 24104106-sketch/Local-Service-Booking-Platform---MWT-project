import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import PublicNavbar from "../components/PublicNavbar";
import ScrollProgress from "../components/ScrollProgress";
import BackToTop from "../components/BackToTop";
import HeroIllustration from "../components/HeroIllustration";
import "./Landing.css";

const CATEGORIES = [
  { icon: "❄️", name: "Home Appliances" },
  { icon: "🧹", name: "Cleaning" },
  { icon: "🔧", name: "Plumbing" },
  { icon: "💡", name: "Electrical" },
  { icon: "🐜", name: "Pest Control" },
  { icon: "🪚", name: "Carpentry" },
];

const STEPS = [
  { num: "01", title: "Search & Compare", body: "Browse verified local providers by category, price, and rating near you." },
  { num: "02", title: "Book Instantly", body: "Pick a slot that works for you and confirm your booking in seconds." },
  { num: "03", title: "Relax, It's Done", body: "A verified professional shows up, gets the job done, and you pay securely." },
];

const FEATURES = [
  { icon: "✅", title: "Verified Professionals", body: "Every provider is background-checked and rated by real customers." },
  { icon: "🔒", title: "Secure Payments", body: "Pay by wallet, card, or UPI — every transaction is encrypted end-to-end." },
  { icon: "⏱️", title: "Real-Time Booking", body: "See live availability and get instant confirmation, no back-and-forth calls." },
  { icon: "⭐", title: "Rated & Reviewed", body: "Transparent ratings and reviews from real bookings, not paid placements." },
];

const TESTIMONIALS = [
  { quote: "Booked an AC repair in two minutes and the technician arrived the same evening. Genuinely painless.", name: "Ananya Rao", role: "Customer, Bengaluru" },
  { quote: "As a provider, this platform actually sends me qualified leads instead of tire-kickers. My calendar stays full.", name: "Kumar Cooling Co.", role: "Service Provider" },
  { quote: "The invoice and payment tracking alone is worth it — no more chasing paper receipts for home repairs.", name: "Vikram Iyer", role: "Customer, Pune" },
];

const STATS = [
  { value: "10,000+", label: "Bookings Completed" },
  { value: "500+", label: "Verified Providers" },
  { value: "50+", label: "Service Categories" },
  { value: "4.8★", label: "Average Rating" },
];

// Shared scroll-reveal animation config, reused across every section below.
const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: "easeOut" },
};

function Landing() {
  return (
    <div className="landing">
      <ScrollProgress />
      <PublicNavbar />

      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="hero__glow hero__glow--a" />
        <div className="hero__glow hero__glow--b" />

        <motion.div
          className="hero__content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="hero__badge">Trusted by 10,000+ households</span>
          <h1>
            Local services,<br />
            booked <span className="hero__accent">instantly.</span>
          </h1>
          <p className="hero__subtitle">
            Plumbing, electrical, cleaning, repairs and more — book verified local
            professionals in a few taps, with transparent pricing and real reviews.
          </p>
          <div className="hero__cta">
            <Link to="/register" className="btn btn-primary btn-lg">Book a Service</Link>
            <Link to="/register" className="btn btn-lg">Become a Provider</Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          style={{ display: "flex", justifyContent: "center", margin: "36px 0 8px" }}
        >
          <HeroIllustration />
        </motion.div>

        <motion.div
          className="hero__stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          {STATS.map((s) => (
            <div key={s.label} className="hero__stat">
              <div className="hero__stat-value">{s.value}</div>
              <div className="hero__stat-label">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ---------- Categories ---------- */}
      <section id="categories" className="section">
        <motion.div className="section__heading" {...fadeUp}>
          <span className="section__eyebrow">What we offer</span>
          <h2>Popular service categories</h2>
          <p>From a leaking tap to a full home deep-clean — find the right pro in seconds.</p>
        </motion.div>

        <div className="category-grid">
          {CATEGORIES.map((c, i) => (
            <motion.div
              key={c.name}
              className="glass-card category-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: "easeOut" }}
              whileHover={{ y: -6 }}
            >
              <div className="category-card__icon">{c.icon}</div>
              <div className="category-card__name">{c.name}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="section section--tinted">
        <motion.div className="section__heading" {...fadeUp}>
          <span className="section__eyebrow">Simple process</span>
          <h2>How FixIt Local works</h2>
          <p>Three steps between you and a job done right.</p>
        </motion.div>

        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              className="glass-card step-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: "easeOut" }}
            >
              <div className="step-card__num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- Why us ---------- */}
      <section id="why-us" className="section">
        <motion.div className="section__heading" {...fadeUp}>
          <span className="section__eyebrow">Why FixIt Local</span>
          <h2>Built for peace of mind</h2>
          <p>Every part of the experience is designed to remove the usual hassle of hiring local help.</p>
        </motion.div>

        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass-card feature-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: "easeOut" }}
              whileHover={{ y: -6 }}
            >
              <div className="feature-card__icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- Testimonials ---------- */}
      <section id="testimonials" className="section section--tinted">
        <motion.div className="section__heading" {...fadeUp}>
          <span className="section__eyebrow">Real feedback</span>
          <h2>Loved by customers & providers</h2>
        </motion.div>

        <div className="testimonial-grid">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              className="glass-card testimonial-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: "easeOut" }}
            >
              <p className="testimonial-card__quote">"{t.quote}"</p>
              <div className="testimonial-card__author">
                <div className="testimonial-card__avatar">{t.name[0]}</div>
                <div>
                  <div className="testimonial-card__name">{t.name}</div>
                  <div className="testimonial-card__role">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="section">
        <motion.div className="cta-banner" {...fadeUp}>
          <h2>Ready to get things fixed?</h2>
          <p>Join thousands of households and providers already using FixIt Local.</p>
          <div className="hero__cta" style={{ justifyContent: "center" }}>
            <Link to="/register" className="btn btn-primary btn-lg">Create Free Account</Link>
            <Link to="/login" className="btn btn-lg">Login</Link>
          </div>
        </motion.div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="landing-footer">
        <div className="landing-footer__brand">
          <span className="public-nav__logo">🔧</span> FixIt Local
        </div>
        <p>Book trusted local services — plumbing, electrical, cleaning & repairs.</p>
        <p className="landing-footer__copy">© {new Date().getFullYear()} FixIt Local. All rights reserved.</p>
      </footer>

      <BackToTop />
    </div>
  );
}

export default Landing;
