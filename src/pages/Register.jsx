import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { validateRegistrationForm } from "../utils/validation";
import apiClient from "../api/apiClient";
import { useToast } from "../hooks/useToast";
import { getCurrentCoordinates, reverseGeocode } from "../utils/geocode";
import heroImg from "../assets/illustrations/login-hero-card.png";
import "./Register.css";

export const PRIMARY_CATEGORIES = [
  "Electrician",
  "Plumber",
  "AC Repair",
  "Carpenter",
  "Cleaning",
  "Pest Control",
  "Appliance Repair",
  "Painting",
  "Other",
];

export const CATEGORY_SERVICES_MAP = {
  "Electrician": [
    "Electrical Wiring",
    "Fan Installation",
    "Light Installation",
    "Switch & Socket Repair",
    "Inverter Installation",
    "MCB Installation",
  ],
  "Plumber": [
    "Pipe Repair",
    "Tap Repair",
    "Bathroom Plumbing",
    "Water Tank Repair",
    "Drainage Repair",
  ],
  "AC Repair": [
    "AC General Service",
    "AC Repair & Service",
    "AC Installation",
    "Gas Refilling",
    "AC Maintenance",
  ],
  "Cleaning": [
    "Home Cleaning",
    "Deep Home Cleaning",
    "Bathroom Cleaning",
    "Kitchen Cleaning",
    "Move-in / Move-out Cleaning",
  ],
  "Carpenter": [
    "Carpentry Work",
    "Furniture Repair",
    "Door & Window Repair",
    "Lock Fitting",
    "Modular Furniture Assembly",
  ],
  "Pest Control": [
    "Pest Control General Treatment",
    "Cockroach Control",
    "Termite Treatment",
    "Bedbug Control",
    "Mosquito & Fly Control",
  ],
  "Appliance Repair": [
    "Washing Machine Repair",
    "Refrigerator Repair",
    "Microwave Repair",
    "Water Purifier / RO Service",
    "Geyser / Water Heater Repair",
  ],
  "Painting": [
    "Full House Interior Painting",
    "Exterior Wall Painting",
    "Waterproofing & Primer",
    "Wall Stencil & Texturing",
  ],
  "Other": [
    "General Home Maintenance",
    "Handyman Services",
    "Custom Home Care",
  ],
};

function Register() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    address: "",
    role: "customer",
    password: "",
    confirmPassword: "",
    // Provider specific fields:
    primaryCategory: "",
    selectedServices: [],
    businessName: "",
    experienceYears: "",
    skills: "",
    bio: "",
    serviceArea: "",
    city: "",
    state: "Tamil Nadu",
    pincode: "",
    serviceRadius: 15,
    avatar: "",
  });

  const [servicesList, setServicesList] = useState([]);
  const [customServiceText, setCustomServiceText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [formError, setFormError] = useState("");

  const { register, loading, error } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleUseCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const coords = await getCurrentCoordinates();
      const addr = await reverseGeocode(coords.latitude, coords.longitude);
      setForm((prev) => ({
        ...prev,
        address: addr,
        latitude: coords.latitude,
        longitude: coords.longitude,
        lat: coords.latitude,
        lng: coords.longitude,
      }));
      showToast("📍 Real GPS coordinates detected & address populated!", "success");
    } catch (err) {
      showToast(err.message || "Location permission denied. Please enter the address manually.", "info");
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    apiClient.get("/services")
      .then((res) => {
        if (isMounted && res && res.data && Array.isArray(res.data)) {
          setServicesList(res.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setServicesList([
            { id: 1, title: "AC Repair & Service", category: "AC Repair" },
            { id: 4, title: "Deep Home Cleaning", category: "Cleaning" },
            { id: 2, title: "Plumbing Fix", category: "Plumbing" },
            { id: 3, title: "Electrical Wiring", category: "Electrical" },
            { id: 7, title: "Pest Control", category: "Pest Control" },
            { id: 8, title: "Carpentry Work", category: "Carpentry" }
          ]);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setForm((prev) => ({
      ...prev,
      primaryCategory: newCat,
      selectedServices: [],
    }));
    if (formError) setFormError("");
  };

  const handleToggleService = (serviceName) => {
    setForm((prev) => {
      const exists = prev.selectedServices.includes(serviceName);
      const updated = exists
        ? prev.selectedServices.filter((s) => s !== serviceName)
        : [...prev.selectedServices, serviceName];
      return { ...prev, selectedServices: updated };
    });
    if (formError) setFormError("");
  };

  const handleAddCustomService = () => {
    const trimmed = customServiceText.trim();
    if (!trimmed) return;
    setForm((prev) => {
      if (!prev.selectedServices.includes(trimmed)) {
        return { ...prev, selectedServices: [...prev.selectedServices, trimmed] };
      }
      return prev;
    });
    setCustomServiceText("");
  };

  // Compute available services for selected category (catalog + predefined map + any user added)
  const availableCategoryServices = useMemo(() => {
    if (!form.primaryCategory) return [];
    const predefined = CATEGORY_SERVICES_MAP[form.primaryCategory] || [];
    const matchedFromCatalog = servicesList
      .filter((s) => {
        const cat = (s.category || "").toLowerCase();
        const primary = form.primaryCategory.toLowerCase();
        return (
          cat === primary ||
          (primary === "electrician" && cat === "electrical") ||
          (primary === "plumber" && cat === "plumbing") ||
          (primary === "carpenter" && cat === "carpentry") ||
          (primary === "ac repair" && (cat === "ac repair" || cat === "home appliances"))
        );
      })
      .map((s) => s.title || s.name)
      .filter(Boolean);

    const merged = Array.from(new Set([...predefined, ...matchedFromCatalog, ...form.selectedServices]));
    return merged;
  }, [form.primaryCategory, servicesList, form.selectedServices]);

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (formError) setFormError("");
  };

  const handleRoleSelect = (selectedRole) => {
    setForm((prev) => ({ ...prev, role: selectedRole }));
    if (formError) setFormError("");
  };

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    const pwd = form.password;
    if (!pwd) return { score: 0, label: "", class: "" };
    if (pwd.length < 6) return { score: 1, label: "Weak", class: "weak" };

    let score = 1;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8 && (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd))) score++;
    if (pwd.length >= 10 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;

    if (score === 2) return { score: 2, label: "Fair", class: "fair" };
    if (score === 3) return { score: 3, label: "Good", class: "good" };
    return { score: 4, label: "Strong password", class: "strong" };
  }, [form.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!agreedTerms) {
      setFormError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    const validationError = validateRegistrationForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (form.role === "provider") {
      if (!form.primaryCategory) {
        setFormError("Please select your primary service category.");
        return;
      }
      if (!form.selectedServices || form.selectedServices.length === 0) {
        setFormError("Please select at least one service you provide.");
        return;
      }
      if (!form.businessName?.trim()) {
        setFormError("Please enter your business or professional name.");
        return;
      }
      if (!form.experienceYears) {
        setFormError("Please enter your years of experience.");
        return;
      }
    }

    setFormError("");

    try {
      const payload = {
        ...form,
        name: (form.fullName || form.name || "").trim(),
        fullName: (form.fullName || form.name || "").trim(),
        primaryCategory: form.primaryCategory,
        category: form.primaryCategory,
        services: form.selectedServices,
        serviceRadius: Number(form.serviceRadius) || 15,
        serviceRadiusKm: Number(form.serviceRadius) || 15,
        latitude: form.latitude ?? form.lat ?? null,
        longitude: form.longitude ?? form.lng ?? null,
        city: form.city || "Chennai",
        state: form.state || "Tamil Nadu",
        pincode: form.pincode || "",
        avatar: form.avatar || "",
        profilePhoto: form.avatar || "",
      };
      const newUser = await register(payload);
      if (newUser?.role === "provider") {
        showToast("Provider application submitted! Status: Pending Administrator Approval.", "info");
      }
      navigate(`/${newUser.role}/dashboard`);
    } catch {
      // Error handled in auth hook
    }
  };

  const displayError = formError || error;

  return (
    <div className="register-fullpage-layout">
      {/* ================= LEFT BRANDING & BENEFITS PANEL ================= */}
      <div className="register-fullpage-left">
        <motion.div
          className="register-hero-inner"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Brand Logo & Name */}
          <div className="register-brand-header">
            <div className="register-brand-logo-badge">🔧</div>
            <div className="register-brand-name-group">
              <h1>
                FixIt <span className="brand-accent">Local</span>
              </h1>
              <p>Local Service Booking Platform</p>
            </div>
          </div>

          {/* Hero Headline & Tagline */}
          <h2 className="register-hero-headline">
            Your trusted partner <br />
            for every <span className="highlight-blue">service need</span>
          </h2>
          <p className="register-hero-subtext">
            Join thousands of happy customers who book trusted professionals in minutes.
          </p>

          {/* 3 Simple Benefits */}
          <div className="register-benefits-list">
            <div className="register-benefit-item">
              <div className="benefit-icon-badge">🛡️</div>
              <div className="benefit-text">
                <strong>Verified Professionals</strong>
                <p>All professionals are background checked and verified</p>
              </div>
            </div>

            <div className="register-benefit-item">
              <div className="benefit-icon-badge">⚡</div>
              <div className="benefit-text">
                <strong>Quick &amp; Easy Booking</strong>
                <p>Book your service in less than 2 minutes</p>
              </div>
            </div>

            <div className="register-benefit-item">
              <div className="benefit-icon-badge">🎧</div>
              <div className="benefit-text">
                <strong>24/7 Support</strong>
                <p>We're always here to help you anytime, anywhere</p>
              </div>
            </div>
          </div>

          {/* 3D Service Professional Illustration */}
          <div className="register-hero-image-wrapper">
            <img src={heroImg} alt="FixIt Local 3D Professional" className="register-hero-3d-img" />
          </div>

          {/* Social Proof Pill */}
          <div className="register-social-proof">
            <div className="proof-avatars">
              <div className="proof-avatar">👨</div>
              <div className="proof-avatar">👩</div>
              <div className="proof-avatar">👦</div>
            </div>
            <div className="proof-text">
              <span>Join 10K+ satisfied customers</span>
              <span className="proof-stars">★★★★★</span>
              <span>4.8/5</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ================= RIGHT FORM PANEL ================= */}
      <div className="register-fullpage-right">
        <motion.div
          className="register-form-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Card Top Header */}
          <div className="register-card-header">
            <div className="register-header-icon-circle">👤</div>
            <div className="register-header-text">
              <h2>{t("createAccount")}</h2>
              <p>Join FixIt Local as a customer or service provider in under a minute.</p>
            </div>
          </div>

          {/* Step / Section Indicators */}
          <div className="register-steps-indicator">
            <div className="step-indicator-item active">
              <span className="step-number-badge">1</span>
              <span>Account Details</span>
            </div>
            <div className="step-connecting-line" />
            <div className="step-indicator-item">
              <span className="step-number-badge">2</span>
              <span>Security &amp; Preferences</span>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="register-main-form">
            <div className="register-form-grid">
              {/* Row 1: Full Name & Username */}
              <div className="register-input-group">
                <label htmlFor="reg-fullname">
                  Full Name <span className="required-star">*</span>
                </label>
                <div className="register-input-wrapper">
                  <span className="register-leading-icon">👤</span>
                  <input
                    id="reg-fullname"
                    required
                    value={form.fullName}
                    onChange={updateField("fullName")}
                    placeholder="Jane Doe"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="register-input-group">
                <label htmlFor="reg-username">
                  Username <span className="required-star">*</span>
                </label>
                <div className="register-input-wrapper">
                  <span className="register-leading-icon">@</span>
                  <input
                    id="reg-username"
                    required
                    value={form.username}
                    onChange={updateField("username")}
                    placeholder="janedoe24"
                    disabled={loading}
                  />
                </div>
                <p className="register-input-helper">This will be your unique identity</p>
              </div>

              {/* Row 2: Email & Phone Number */}
              <div className="register-input-group">
                <label htmlFor="reg-email">
                  Email Address <span className="required-star">*</span>
                </label>
                <div className="register-input-wrapper">
                  <span className="register-leading-icon">✉️</span>
                  <input
                    id="reg-email"
                    required
                    type="email"
                    value={form.email}
                    onChange={updateField("email")}
                    placeholder="jane@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="register-input-group">
                <label htmlFor="reg-phone">Phone Number (10 digits)</label>
                <div className="register-input-wrapper">
                  <span className="register-leading-icon">📞</span>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={form.phone}
                    onChange={updateField("phone")}
                    placeholder="9876543210"
                    maxLength={10}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Row 3: Address (Full Width) with Real Location option */}
              <div className="register-input-group full-width">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label htmlFor="reg-address" style={{ margin: 0 }}>Address</label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={loading || gpsLoading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#3b82f6",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 0,
                    }}
                  >
                    <span>📍</span>
                    <span>{gpsLoading ? "Acquiring GPS..." : "Use My Current Location"}</span>
                  </button>
                </div>
                <div className="register-input-wrapper">
                  <span className="register-leading-icon">📍</span>
                  <input
                    id="reg-address"
                    value={form.address}
                    onChange={updateField("address")}
                    placeholder="House no., Street, Area, City, State, PIN Code"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Row 4: Register As Role Cards */}
              <div className="register-role-section">
                <label>
                  Register As <span className="required-star">*</span>
                </label>
                <div className="register-role-cards">
                  <button
                    type="button"
                    className={`register-role-card ${form.role === "customer" ? "active" : ""}`}
                    onClick={() => handleRoleSelect("customer")}
                  >
                    <div className="role-card-avatar">👤</div>
                    <div className="role-card-content">
                      <strong className="role-card-title">Customer</strong>
                      <span className="role-card-desc">Book services for your home</span>
                    </div>
                    {form.role === "customer" && <div className="role-card-check-badge">✓</div>}
                  </button>

                  <button
                    type="button"
                    className={`register-role-card ${form.role === "provider" ? "active" : ""}`}
                    onClick={() => handleRoleSelect("provider")}
                  >
                    <div className="role-card-avatar">💼</div>
                    <div className="role-card-content">
                      <strong className="role-card-title">Service Provider</strong>
                      <span className="role-card-desc">Offer services to customers</span>
                    </div>
                    {form.role === "provider" && <div className="role-card-check-badge">✓</div>}
                  </button>
                </div>
              </div>

              {/* DYNAMIC PROVIDER PROFESSIONAL DETAILS */}
              <AnimatePresence>
                {form.role === "provider" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 18px" }}
                  >
                    <div className="register-section-header" style={{ gridColumn: "1 / -1", margin: "8px 0 4px 0" }}>
                      <span>💼 Provider Professional Details</span>
                    </div>

                    {/* Profile Photo / Business Logo */}
                    <div className="register-input-group full-width">
                      <label htmlFor="reg-avatar">Profile Photo / Business Logo (Optional)</label>
                      <div className="register-input-wrapper" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px" }}>
                        {form.avatar ? (
                          <img
                            src={form.avatar}
                            alt="Avatar preview"
                            style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #38bdf8", flexShrink: 0 }}
                          />
                        ) : (
                          <span style={{ fontSize: 24, padding: "0 4px" }}>📷</span>
                        )}
                        <input
                          id="reg-avatar"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                showToast("Photo size exceeds 2MB limit.", "error");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setForm((prev) => ({ ...prev, avatar: reader.result }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          disabled={loading}
                          style={{ flex: 1, fontSize: "0.82rem", background: "transparent", border: "none", color: "#e2e8f0" }}
                        />
                      </div>
                      <p className="register-input-helper">Upload a professional headshot or company logo (PNG, JPG, max 2MB)</p>
                    </div>

                    {/* Primary Service Category Dropdown */}
                    <div className="register-input-group full-width">
                      <label htmlFor="reg-primary-category">
                        Primary Service Category <span className="required-star">*</span>
                      </label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">🏷️</span>
                        <select
                          id="reg-primary-category"
                          value={form.primaryCategory}
                          onChange={handleCategoryChange}
                          disabled={loading}
                        >
                          <option value="">-- Select Primary Service Category --</option>
                          {PRIMARY_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="register-input-helper">Choose the primary field of work for your business</p>
                    </div>

                    {/* Services You Provide Checkboxes (Dynamic per Category) */}
                    {form.primaryCategory && (
                      <div className="register-input-group full-width" style={{ marginTop: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <label>
                            Services You Provide <span className="required-star">*</span>
                          </label>
                          <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #94a3b8)" }}>
                            {form.selectedServices.length} selected
                          </span>
                        </div>
                        <p className="register-input-helper" style={{ marginTop: 2, marginBottom: 10 }}>
                          Select all services you offer under {form.primaryCategory}. Pricing is configured separately in your provider dashboard.
                        </p>

                        <div className="register-services-grid">
                          {availableCategoryServices.map((svcName) => {
                            const isChecked = form.selectedServices.includes(svcName);
                            return (
                              <label
                                key={svcName}
                                className={`service-checkbox-card ${isChecked ? "selected" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleService(svcName)}
                                  disabled={loading}
                                  style={{ display: "none" }}
                                />
                                <span className={`checkbox-custom ${isChecked ? "checked" : ""}`}>
                                  {isChecked && "✓"}
                                </span>
                                <span className="service-name">{svcName}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Optional Add Custom Service Row */}
                        <div className="add-custom-service-row">
                          <input
                            type="text"
                            placeholder={`Add another ${form.primaryCategory} service...`}
                            value={customServiceText}
                            onChange={(e) => setCustomServiceText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddCustomService();
                              }
                            }}
                            disabled={loading}
                          />
                          <button
                            type="button"
                            className="btn-add-service-chip"
                            onClick={handleAddCustomService}
                            disabled={loading || !customServiceText.trim()}
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Business Name */}
                    <div className="register-input-group">
                      <label htmlFor="reg-business-name">
                        Business / Professional Name <span className="required-star">*</span>
                      </label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">🏢</span>
                        <input
                          id="reg-business-name"
                          value={form.businessName}
                          onChange={updateField("businessName")}
                          placeholder="e.g. Yaazh Electricals"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Years of Experience */}
                    <div className="register-input-group">
                      <label htmlFor="reg-exp-years">
                        Years of Experience <span className="required-star">*</span>
                      </label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">⏳</span>
                        <input
                          id="reg-exp-years"
                          type="number"
                          min="0"
                          max="50"
                          value={form.experienceYears}
                          onChange={updateField("experienceYears")}
                          placeholder="e.g. 5"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Service Area */}
                    <div className="register-input-group">
                      <label htmlFor="reg-service-area">Service Area / Neighborhood</label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">🗺️</span>
                        <input
                          id="reg-service-area"
                          value={form.serviceArea}
                          onChange={updateField("serviceArea")}
                          placeholder="e.g. Anna Nagar, T. Nagar"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* City */}
                    <div className="register-input-group">
                      <label htmlFor="reg-city">City</label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">🏙️</span>
                        <input
                          id="reg-city"
                          value={form.city}
                          onChange={updateField("city")}
                          placeholder="e.g. Chennai"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* State */}
                    <div className="register-input-group">
                      <label htmlFor="reg-state">State</label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">🏛️</span>
                        <input
                          id="reg-state"
                          value={form.state || "Tamil Nadu"}
                          onChange={updateField("state")}
                          placeholder="e.g. Tamil Nadu"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* PIN Code */}
                    <div className="register-input-group">
                      <label htmlFor="reg-pincode">PIN Code</label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">📮</span>
                        <input
                          id="reg-pincode"
                          value={form.pincode}
                          onChange={updateField("pincode")}
                          placeholder="e.g. 600040"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Service Radius (5 - 25 km) */}
                    <div className="register-input-group full-width">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label htmlFor="reg-service-radius">
                          Service Coverage Radius (5 – 25 km) <span className="required-star">*</span>
                        </label>
                        <span style={{ fontWeight: 600, color: "#38bdf8", fontSize: "0.88rem" }}>
                          📍 {form.serviceRadius || 15} km coverage
                        </span>
                      </div>
                      <div className="register-input-wrapper" style={{ padding: "8px 14px", gap: 12 }}>
                        <span className="register-leading-icon">📡</span>
                        <input
                          id="reg-service-radius"
                          type="range"
                          min="5"
                          max="25"
                          step="1"
                          value={form.serviceRadius || 15}
                          onChange={updateField("serviceRadius")}
                          disabled={loading}
                          style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "0.85rem", color: "#94a3b8", minWidth: 45, fontWeight: 500 }}>
                          {form.serviceRadius || 15} km
                        </span>
                      </div>
                      <p className="register-input-helper">Maximum travel distance from your address for booking matches</p>
                    </div>

                    {/* Skills */}
                    <div className="register-input-group full-width">
                      <label htmlFor="reg-skills">Key Skills</label>
                      <div className="register-input-wrapper">
                        <span className="register-leading-icon">⚡</span>
                        <input
                          id="reg-skills"
                          value={form.skills}
                          onChange={updateField("skills")}
                          placeholder="e.g. Wiring, MCB Installation, Inverter Setup"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="register-input-group full-width">
                      <label htmlFor="reg-bio">Professional Bio</label>
                      <div className="register-input-wrapper textarea-wrapper">
                        <textarea
                          id="reg-bio"
                          rows={2}
                          value={form.bio}
                          onChange={updateField("bio")}
                          placeholder="Describe your expertise and service quality..."
                          disabled={loading}
                          style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#ffffff",
                            fontFamily: "inherit",
                            fontSize: "13.5px",
                            resize: "vertical"
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Row 5: Section Header */}
              <div className="register-section-header">
                <span>🔒 Security &amp; Preferences</span>
              </div>

              {/* Row 6: Password & Confirm Password */}
              <div className="register-input-group">
                <label htmlFor="reg-password">
                  Password <span className="required-star">*</span>
                </label>
                <div className="register-input-wrapper">
                  <span className="register-leading-icon">🔒</span>
                  <input
                    id="reg-password"
                    required
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={updateField("password")}
                    placeholder="••••••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="register-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              <div className="register-input-group">
                <label htmlFor="reg-confirmpassword">
                  Confirm Password <span className="required-star">*</span>
                </label>
                <div className="register-input-wrapper">
                  <span className="register-leading-icon">🔒</span>
                  <input
                    id="reg-confirmpassword"
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={updateField("confirmPassword")}
                    placeholder="••••••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="register-password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {form.password && (
                <div className="register-strength-section">
                  <div className="strength-bars-track">
                    {[1, 2, 3, 4].map((seg) => (
                      <div
                        key={seg}
                        className={`strength-bar-seg ${seg <= passwordStrength.score ? passwordStrength.class : ""}`}
                      />
                    ))}
                  </div>
                  <span className={`strength-text-label ${passwordStrength.class}`}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}

              {/* Terms of Service Checkbox */}
              <div className="register-terms-group">
                <label className="register-terms-label">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <a href="#terms" onClick={(e) => e.preventDefault()} className="terms-link">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#privacy" onClick={(e) => e.preventDefault()} className="terms-link">
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              {/* Error Banner */}
              {displayError && <div className="register-error-banner">{displayError}</div>}

              {/* Primary Submit Button */}
              <button type="submit" className="register-submit-btn" disabled={loading}>
                {loading ? "Creating account..." : "Create Account →"}
              </button>

              {/* Login Prompt Link */}
              <p className="register-login-prompt">
                Already have an account? <Link to="/login">Login here</Link>
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default Register;
