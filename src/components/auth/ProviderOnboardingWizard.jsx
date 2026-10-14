import { useState, useMemo, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ServiceContext } from "../../context/ServiceContext";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency } from "../../utils/currency";
import apiClient from "../../api/apiClient";
import "./ProviderOnboardingWizard.css";

const DEFAULT_CATEGORIES = [
  { name: "AC Repair", count: 1 },
  { name: "Plumbing", count: 1 },
  { name: "Electrical", count: 1 },
  { name: "Cleaning", count: 1 },
  { name: "Painting", count: 1 },
  { name: "Appliance Repair", count: 1 },
  { name: "Pest Control", count: 1 },
  { name: "Carpentry", count: 1 },
];

const AVATAR_PRESETS = ["👨‍🔧", "👩‍🔧", "⚡", "🧰", "🧹", "❄️", "🛠️", "🔧"];

const SKILL_SUGGESTIONS = [
  "Troubleshooting",
  "Installation",
  "Maintenance",
  "Emergency Repair",
  "Wiring & Circuit Repair",
  "Inverter AC Repair",
  "Leak Detection",
  "Deep Sanitization",
  "Pipe Fitting",
  "Safety Inspection"
];

const CERT_SUGGESTIONS = [
  "Govt Licensed Electrician",
  "Certified HVAC Specialist",
  "Master Plumber Certification",
  "Professional Cleaning Diploma",
  "ISO 9001 Service Standard"
];

export default function ProviderOnboardingWizard({ initialData, onSwitchToCustomer }) {
  const serviceContext = useContext(ServiceContext);
  const contextServices = serviceContext?.services || [];
  const categories = serviceContext?.categories?.length > 0 ? serviceContext.categories : DEFAULT_CATEGORIES;
  const { register } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Step 1: Basic Info
  const [basicInfo, setBasicInfo] = useState({
    fullName: initialData?.fullName || "",
    username: initialData?.username || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
    city: initialData?.city || "Chennai",
    password: initialData?.password || "",
    confirmPassword: initialData?.confirmPassword || ""
  });
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Selected Catalog Services (At least 1 mandatory)
  const [selectedServices, setSelectedServices] = useState({});
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceCatFilter, setServiceCatFilter] = useState("all");

  // Step 3: Experience & Skills
  const [businessName, setBusinessName] = useState("");
  const [experienceYears, setExperienceYears] = useState(3);
  const [skills, setSkills] = useState(["Troubleshooting", "Maintenance"]);
  const [skillInput, setSkillInput] = useState("");
  const [bio, setBio] = useState("");

  // Step 4: Service Area
  const [serviceCity, setServiceCity] = useState("Chennai");
  const [serviceArea, setServiceArea] = useState("T. Nagar, Kodambakkam, Anna Nagar");
  const [radiusKm, setRadiusKm] = useState(15);

  // Step 5: Optional Details
  const [certifications, setCertifications] = useState(["Govt Licensed"]);
  const [certInput, setCertInput] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("👨‍🔧");

  // Step 6: Terms
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Auto-set business name default when full name changes
  useEffect(() => {
    if (!businessName && basicInfo.fullName) {
      setBusinessName(`${basicInfo.fullName.trim()} Services`);
    }
  }, [basicInfo.fullName, businessName]);

  // Master services catalog from API or context
  const [masterCatalog, setMasterCatalog] = useState(contextServices);
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await apiClient.get("/services");
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          if (isMounted) setMasterCatalog(res.data);
          return;
        }
      } catch {
        // fallback to contextServices
      }
      if (isMounted && contextServices && contextServices.length > 0) {
        setMasterCatalog(contextServices);
      }
    }
    loadCatalog();
    return () => { isMounted = false; };
  }, [contextServices]);

  // Filter master catalog services for selection
  const filteredCatalog = useMemo(() => {
    return masterCatalog.filter((s) => {
      const title = s.title || s.name || "";
      const cat = s.category || "";
      const matchesSearch =
        title.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        cat.toLowerCase().includes(serviceSearch.toLowerCase());
      const matchesCat =
        serviceCatFilter === "all" || cat.toLowerCase() === serviceCatFilter.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [masterCatalog, serviceSearch, serviceCatFilter]);

  // Toggle selection of a service from catalog
  const toggleServiceSelect = (svc) => {
    const sId = svc._id || svc.id;
    setSelectedServices((prev) => {
      const next = { ...prev };
      if (next[sId]) {
        delete next[sId];
      } else {
        next[sId] = {
          service: sId,
          title: svc.title || svc.name,
          category: svc.category,
          price: svc.price || 499,
          duration: svc.duration || "1-2 hours",
          description: svc.description || "",
          serviceArea: serviceArea || basicInfo.address || "Chennai",
          isActive: true
        };
      }
      return next;
    });
    if (errorMsg) setErrorMsg("");
  };

  const selectedCount = Object.keys(selectedServices).length;

  // Skills tag handling
  const addSkill = (tag) => {
    const trimmed = (tag || skillInput).trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (tagToRemove) => {
    setSkills((prev) => prev.filter((s) => s !== tagToRemove));
  };

  // Certifications tag handling
  const addCert = (tag) => {
    const trimmed = (tag || certInput).trim();
    if (trimmed && !certifications.includes(trimmed)) {
      setCertifications((prev) => [...prev, trimmed]);
      setCertInput("");
    }
  };

  const removeCert = (tagToRemove) => {
    setCertifications((prev) => prev.filter((c) => c !== tagToRemove));
  };

  // Step Validation
  const validateStep = (currentStep) => {
    setErrorMsg("");
    if (currentStep === 1) {
      if (!basicInfo.fullName.trim()) return "Please enter your full name.";
      if (!basicInfo.username.trim()) return "Please choose a username.";
      if (!basicInfo.email.trim() || !/^\S+@\S+\.\S+$/.test(basicInfo.email)) {
        return "Please enter a valid email address.";
      }
      if (!basicInfo.phone.trim() || !/^\d{10}$/.test(basicInfo.phone)) {
        return "Please enter a valid 10-digit phone number.";
      }
      if (!basicInfo.password || basicInfo.password.length < 6) {
        return "Password must be at least 6 characters.";
      }
      if (basicInfo.password !== basicInfo.confirmPassword) {
        return "Passwords do not match.";
      }
      if (!basicInfo.address.trim()) return "Please enter your street address.";
      return null;
    }

    if (currentStep === 2) {
      if (selectedCount === 0) {
        return "Please select at least 1 service you offer from the catalog.";
      }
      return null;
    }

    if (currentStep === 3) {
      if (!experienceYears || experienceYears < 0) {
        return "Please specify your years of experience.";
      }
      if (skills.length === 0) {
        return "Please list at least one skill or specialization.";
      }
      if (!bio.trim() || bio.trim().length < 20) {
        return "Please enter a short professional bio (at least 20 characters) describing your experience.";
      }
      return null;
    }

    if (currentStep === 4) {
      if (!serviceCity.trim()) return "Please specify your operating city.";
      if (!serviceArea.trim()) return "Please specify your service area or localities.";
      return null;
    }

    return null;
  };

  const nextStep = () => {
    const error = validateStep(step);
    if (error) {
      setErrorMsg(error);
      return;
    }
    setErrorMsg("");
    setStep((prev) => Math.min(prev + 1, 6));
  };

  const prevStep = () => {
    setErrorMsg("");
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // Final Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreedTerms) {
      setErrorMsg("Please accept the Terms of Service & Provider Guidelines.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const offeringsPayload = Object.values(selectedServices).map((s) => ({
      service: s.service,
      price: Number(s.price) || 499,
      duration: s.duration || "1-2 hours",
      description: s.description || bio || "",
      serviceArea: serviceArea,
      isActive: true
    }));

    const payload = {
      name: basicInfo.fullName.trim(),
      fullName: basicInfo.fullName.trim(),
      username: basicInfo.username.trim(),
      email: basicInfo.email.toLowerCase().trim(),
      password: basicInfo.password,
      phone: basicInfo.phone.trim(),
      address: basicInfo.address.trim(),
      city: serviceCity.trim(),
      role: "provider",
      businessName: businessName.trim() || `${basicInfo.fullName.trim()} Services`,
      category: Object.values(selectedServices)[0]?.category || "General Maintenance",
      servicesOffered: offeringsPayload,
      experienceYears: Number(experienceYears) || 1,
      skills,
      bio: bio.trim(),
      serviceArea: serviceArea.trim(),
      serviceRadiusKm: Number(radiusKm) || 15,
      certifications,
      avatar: selectedAvatar
    };

    try {
      await register(payload);
      setSubmitSuccess(true);
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit provider registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // SUCCESS SCREEN
  // -------------------------------------------------------------
  if (submitSuccess) {
    return (
      <div className="provider-wizard-success-card">
        <div className="success-icon-badge">🎉</div>
        <h2>Application Submitted!</h2>
        <p className="success-tagline">
          Welcome to FixIt Local, <strong>{basicInfo.fullName}</strong>!
        </p>

        <div className="approval-status-pill">
          <span className="status-dot-pulse" />
          Status: <strong>Pending Admin Approval</strong>
        </div>

        <div className="success-info-box">
          <h4>Next Steps for Service Providers:</h4>
          <ul>
            <li>
              🛡️ <strong>Profile Verification:</strong> Our team reviews your selected services, experience, and service area within 24–48 hours.
            </li>
            <li>
              🔔 <strong>Approval Notification:</strong> You will receive an instant notification once your profile is verified and active.
            </li>
            <li>
              💼 <strong>Start Receiving Bookings:</strong> Once approved, customers in your operating radius can book your services directly.
            </li>
          </ul>
        </div>

        <div className="success-actions">
          <Link to="/login" className="btn-wizard-primary">
            Proceed to Login →
          </Link>
          <Link to="/" className="btn-wizard-secondary">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEPPER HEADER
  // -------------------------------------------------------------
  const STEPS = [
    { num: 1, title: "Basic Info", icon: "👤" },
    { num: 2, title: "Services", icon: "🧰" },
    { num: 3, title: "Experience", icon: "⭐" },
    { num: 4, title: "Service Area", icon: "📍" },
    { num: 5, title: "Details", icon: "📜" },
    { num: 6, title: "Review", icon: "✓" }
  ];

  return (
    <div className="provider-onboarding-wizard">
      {/* Wizard Header */}
      <div className="wizard-top-bar">
        <div className="wizard-title-group">
          <span className="wizard-badge">Service Provider Registration</span>
          <h3>Join as a Verified Professional</h3>
          <p>Step {step} of 6: {STEPS[step - 1].title}</p>
        </div>
        <button
          type="button"
          className="switch-role-btn"
          onClick={onSwitchToCustomer}
          title="Switch to customer registration"
        >
          Register as Customer instead
        </button>
      </div>

      {/* Stepper Progress Bar */}
      <div className="wizard-stepper">
        {STEPS.map((s, idx) => (
          <div
            key={s.num}
            className={`wizard-step-node ${step === s.num ? "active" : step > s.num ? "completed" : ""}`}
            onClick={() => {
              if (s.num < step) setStep(s.num);
            }}
          >
            <div className="step-node-circle">
              {step > s.num ? "✓" : s.num}
            </div>
            <span className="step-node-label">{s.title}</span>
            {idx < STEPS.length - 1 && <div className="step-node-connector" />}
          </div>
        ))}
      </div>

      {/* Form Container */}
      <div className="wizard-step-content">
        <AnimatePresence mode="wait">
          {/* STEP 1: BASIC INFORMATION */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-step-pane"
            >
              <h4 className="pane-title">👤 Step 1: Basic Information</h4>
              <p className="pane-desc">Your core contact and login credentials.</p>

              <div className="wizard-grid-2">
                <div className="wizard-field">
                  <label>Full Name <span className="req">*</span></label>
                  <input
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={basicInfo.fullName}
                    onChange={(e) => setBasicInfo({ ...basicInfo, fullName: e.target.value })}
                  />
                </div>

                <div className="wizard-field">
                  <label>Username <span className="req">*</span></label>
                  <input
                    required
                    placeholder="e.g. ramesh_cooling"
                    value={basicInfo.username}
                    onChange={(e) => setBasicInfo({ ...basicInfo, username: e.target.value })}
                  />
                </div>

                <div className="wizard-field">
                  <label>Email Address <span className="req">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh@example.com"
                    value={basicInfo.email}
                    onChange={(e) => setBasicInfo({ ...basicInfo, email: e.target.value })}
                  />
                </div>

                <div className="wizard-field">
                  <label>Phone Number (10 digits) <span className="req">*</span></label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={basicInfo.phone}
                    onChange={(e) => setBasicInfo({ ...basicInfo, phone: e.target.value })}
                  />
                </div>

                <div className="wizard-field full-width">
                  <label>Operating / Base Address <span className="req">*</span></label>
                  <input
                    required
                    placeholder="Door / Flat No., Street, Locality"
                    value={basicInfo.address}
                    onChange={(e) => setBasicInfo({ ...basicInfo, address: e.target.value })}
                  />
                </div>

                <div className="wizard-field">
                  <label>Password <span className="req">*</span></label>
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="At least 6 characters"
                      value={basicInfo.password}
                      onChange={(e) => setBasicInfo({ ...basicInfo, password: e.target.value })}
                    />
                    <button
                      type="button"
                      className="pwd-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <div className="wizard-field">
                  <label>Confirm Password <span className="req">*</span></label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Re-enter password"
                    value={basicInfo.confirmPassword}
                    onChange={(e) => setBasicInfo({ ...basicInfo, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: PROFESSIONAL INFORMATION (SERVICE SELECTION) */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-step-pane"
            >
              <div className="catalog-header-bar">
                <div>
                  <h4 className="pane-title">🧰 Step 2: Choose Services You Offer</h4>
                  <p className="pane-desc">
                    Select the services from our platform catalog that you specialize in. At least 1 service is required.
                  </p>
                </div>
                <div className="selected-counter-badge">
                  {selectedCount} {selectedCount === 1 ? "Service" : "Services"} Selected
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="catalog-filters">
                <input
                  type="text"
                  placeholder="Search catalog by service name..."
                  className="catalog-search-input"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
                <div className="catalog-cat-pills">
                  <button
                    type="button"
                    className={`cat-pill ${serviceCatFilter === "all" ? "active" : ""}`}
                    onClick={() => setServiceCatFilter("all")}
                  >
                    All Categories
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id || c.name}
                      type="button"
                      className={`cat-pill ${serviceCatFilter === c.name ? "active" : ""}`}
                      onClick={() => setServiceCatFilter(c.name)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Cards Grid */}
              <div className="catalog-cards-grid">
                {filteredCatalog.length === 0 ? (
                  <div className="no-services-found">
                    No services found matching "{serviceSearch}". Try a different term.
                  </div>
                ) : (
                  filteredCatalog.map((svc) => {
                    const sId = svc._id || svc.id;
                    const isSelected = !!selectedServices[sId];
                    return (
                      <div
                        key={sId}
                        className={`catalog-service-card ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleServiceSelect(svc)}
                      >
                        <div className="card-top-row">
                          <span className="svc-cat-tag">{svc.category}</span>
                          <div className={`checkbox-circle ${isSelected ? "checked" : ""}`}>
                            {isSelected && "✓"}
                          </div>
                        </div>
                        <h5 className="svc-card-title">{svc.title || svc.name}</h5>
                        <p className="svc-card-desc">
                          {svc.description || "Professional service provided by verified partners."}
                        </p>
                        <div className="svc-card-bottom">
                          <span className="svc-price-tag">
                            Base: <strong>{formatCurrency(svc.price)}</strong>
                          </span>
                          <span className="svc-duration-tag">⏱️ {svc.duration || "1-2 hrs"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: EXPERIENCE & SKILLS */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-step-pane"
            >
              <h4 className="pane-title">⭐ Step 3: Experience &amp; Specialization</h4>
              <p className="pane-desc">Showcase your expertise and background to potential customers.</p>

              <div className="wizard-field">
                <label>Business / Trading Name</label>
                <input
                  placeholder="e.g. Kumar Cooling & Electricals"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
                <span className="helper-text">This name will be visible on your public service cards.</span>
              </div>

              <div className="wizard-field">
                <label>Years of Professional Experience <span className="req">*</span></label>
                <div className="experience-stepper">
                  <button
                    type="button"
                    onClick={() => setExperienceYears((prev) => Math.max(1, prev - 1))}
                    className="stepper-btn"
                  >
                    –
                  </button>
                  <span className="stepper-val">{experienceYears} {experienceYears === 1 ? "Year" : "Years"}</span>
                  <button
                    type="button"
                    onClick={() => setExperienceYears((prev) => prev + 1)}
                    className="stepper-btn"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="wizard-field">
                <label>Skills &amp; Specializations <span className="req">*</span></label>
                <div className="tags-input-container">
                  {skills.map((sk) => (
                    <span key={sk} className="tag-chip">
                      {sk}
                      <button type="button" onClick={() => removeSkill(sk)}>×</button>
                    </span>
                  ))}
                  <input
                    placeholder="Type skill and press Enter..."
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                </div>
                <div className="tag-suggestions">
                  <span className="sugg-label">Quick add:</span>
                  {SKILL_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className="sugg-pill"
                      onClick={() => addSkill(sug)}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wizard-field">
                <label>Professional Bio / Overview <span className="req">*</span></label>
                <textarea
                  rows={4}
                  placeholder="Describe your background, specialization, tools, and commitment to quality service..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
                <span className="helper-text">{bio.length} / 500 characters</span>
              </div>
            </motion.div>
          )}

          {/* STEP 4: SERVICE AREA */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-step-pane"
            >
              <h4 className="pane-title">📍 Step 4: Service Area &amp; Coverage</h4>
              <p className="pane-desc">Set your operating perimeter so customers nearby can discover you.</p>

              <div className="wizard-grid-2">
                <div className="wizard-field">
                  <label>Primary Operating City <span className="req">*</span></label>
                  <select
                    value={serviceCity}
                    onChange={(e) => setServiceCity(e.target.value)}
                  >
                    <option value="Chennai">Chennai</option>
                    <option value="Coimbatore">Coimbatore</option>
                    <option value="Madurai">Madurai</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Mumbai">Mumbai</option>
                  </select>
                </div>

                <div className="wizard-field">
                  <label>Maximum Travel Radius</label>
                  <div className="radius-slider-wrap">
                    <input
                      type="range"
                      min={5}
                      max={50}
                      step={5}
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                    />
                    <span className="radius-display-badge">🚗 Up to {radiusKm} km</span>
                  </div>
                </div>

                <div className="wizard-field full-width">
                  <label>Localities &amp; Neighborhoods Covered <span className="req">*</span></label>
                  <input
                    placeholder="e.g. T. Nagar, Kodambakkam, West Mambalam, Alwarpet"
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                  />
                  <span className="helper-text">List key areas where you provide on-site service.</span>
                </div>
              </div>

              <div className="service-area-preview-box">
                <div className="preview-icon">🗺️</div>
                <div className="preview-content">
                  <strong>Service Radius Coverage</strong>
                  <p>
                    Customers within <strong>{radiusKm} km</strong> of <strong>{serviceCity}</strong> (around {serviceArea}) will see your profile when booking services you offer.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: OPTIONAL DETAILS */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-step-pane"
            >
              <h4 className="pane-title">📜 Step 5: Certifications &amp; Avatar</h4>
              <p className="pane-desc">Boost customer trust with verified certifications and a profile image.</p>

              <div className="wizard-field">
                <label>Profile Avatar / Badge</label>
                <div className="avatar-preset-picker">
                  {AVATAR_PRESETS.map((av) => (
                    <button
                      key={av}
                      type="button"
                      className={`avatar-preset-btn ${selectedAvatar === av ? "selected" : ""}`}
                      onClick={() => setSelectedAvatar(av)}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wizard-field">
                <label>Certifications &amp; Licenses</label>
                <div className="tags-input-container">
                  {certifications.map((c) => (
                    <span key={c} className="tag-chip cert">
                      🏆 {c}
                      <button type="button" onClick={() => removeCert(c)}>×</button>
                    </span>
                  ))}
                  <input
                    placeholder="Add license / qualification and press Enter..."
                    value={certInput}
                    onChange={(e) => setCertInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCert();
                      }
                    }}
                  />
                </div>
                <div className="tag-suggestions">
                  <span className="sugg-label">Suggestions:</span>
                  {CERT_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className="sugg-pill"
                      onClick={() => addCert(sug)}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 6: REVIEW & SUBMIT */}
          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-step-pane"
            >
              <h4 className="pane-title">✓ Step 6: Review &amp; Submit Application</h4>
              <p className="pane-desc">Please verify all your details before final submission.</p>

              <div className="review-summary-grid">
                {/* Personal & Business */}
                <div className="review-card">
                  <div className="review-card-header">
                    <span className="rev-icon">{selectedAvatar}</span>
                    <div>
                      <h5>{businessName || basicInfo.fullName}</h5>
                      <span className="rev-sub">{basicInfo.fullName} • {basicInfo.username}</span>
                    </div>
                  </div>
                  <div className="review-details-list">
                    <div className="rev-row">
                      <span>Email:</span> <strong>{basicInfo.email}</strong>
                    </div>
                    <div className="rev-row">
                      <span>Phone:</span> <strong>{basicInfo.phone}</strong>
                    </div>
                    <div className="rev-row">
                      <span>Address:</span> <strong>{basicInfo.address}, {serviceCity}</strong>
                    </div>
                  </div>
                </div>

                {/* Services Selected */}
                <div className="review-card">
                  <h5>Services You Offer ({selectedCount})</h5>
                  <div className="review-services-chips">
                    {Object.values(selectedServices).map((s) => (
                      <span key={s.service} className="rev-svc-chip">
                        {s.title} <em>({formatCurrency(s.price)})</em>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Professional Background */}
                <div className="review-card">
                  <h5>Experience &amp; Skills</h5>
                  <p className="rev-bio-text">"{bio}"</p>
                  <div className="rev-row">
                    <span>Experience:</span> <strong>{experienceYears} Years</strong>
                  </div>
                  <div className="rev-tags-row">
                    {skills.map((sk) => (
                      <span key={sk} className="mini-tag">{sk}</span>
                    ))}
                  </div>
                </div>

                {/* Service Area */}
                <div className="review-card">
                  <h5>Service Coverage</h5>
                  <div className="rev-row">
                    <span>City:</span> <strong>{serviceCity}</strong>
                  </div>
                  <div className="rev-row">
                    <span>Localities:</span> <strong>{serviceArea}</strong>
                  </div>
                  <div className="rev-row">
                    <span>Radius:</span> <strong>Up to {radiusKm} km</strong>
                  </div>
                  {certifications.length > 0 && (
                    <div className="rev-certs-row">
                      <span>Certifications:</span>
                      {certifications.map((c) => (
                        <span key={c} className="mini-cert">🏆 {c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="wizard-terms-box">
                <label className="terms-checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                  />
                  <span>
                    I certify that all information provided is accurate and agree to FixIt Local's{" "}
                    <a href="#terms" onClick={(e) => e.preventDefault()}>Provider Code of Conduct</a>{" "}
                    and <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                  </span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Banner */}
        {errorMsg && <div className="wizard-error-banner">⚠️ {errorMsg}</div>}

        {/* Navigation Buttons */}
        <div className="wizard-footer-buttons">
          {step > 1 ? (
            <button
              type="button"
              className="btn-wizard-back"
              onClick={prevStep}
              disabled={loading}
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              className="btn-wizard-back"
              onClick={onSwitchToCustomer}
              disabled={loading}
            >
              Cancel
            </button>
          )}

          {step < 6 ? (
            <button
              type="button"
              className="btn-wizard-primary"
              onClick={nextStep}
            >
              Next Step →
            </button>
          ) : (
            <button
              type="button"
              className="btn-wizard-primary submit-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting Application..." : "Submit Application for Approval 🚀"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
