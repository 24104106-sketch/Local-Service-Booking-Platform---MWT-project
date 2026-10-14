import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useWallet } from "../../hooks/useWallet";
import { useAvailability } from "../../hooks/useAvailability";
import { useServices } from "../../hooks/useServices";
import { formatCurrency } from "../../utils/currency";
import { reverseGeocode, calculateDistance, calculateEtaMinutes } from "../../utils/geocode";
import Layout from "../../components/Layout";
import GoogleMap from "../../components/maps/GoogleMap";
import { useTranslation } from "../../hooks/useTranslation";
import apiClient from "../../api/apiClient";
import { loadRazorpayScript } from "../../utils/loadRazorpay";
import { io } from "socket.io-client";

const STEPS = [
  "Select Service",
  "Service Location",
  "Nearby Providers",
  "Schedule & Details",
  "Confirm Address",
  "Payment & Book",
];

function WizardProgress({ current, onStepClick }) {
  return (
    <div className="flex-row flex-wrap mb-4" style={{ gap: 8, paddingBottom: 6 }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={label}
            className="flex-row items-center"
            style={{
              gap: 6,
              flex: "1 1 auto",
              minWidth: 90,
              cursor: done ? "pointer" : "default",
            }}
            onClick={() => {
              if (done && onStepClick) onStepClick(i);
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11.5,
                fontWeight: 700,
                flexShrink: 0,
                background: done ? "var(--green)" : active ? "var(--blue)" : "var(--border-strong)",
                color: done || active ? "#fff" : "var(--faint)",
                transition: "all 0.2s ease",
              }}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--ink)" : done ? "var(--muted)" : "var(--faint)",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function BookService() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createBooking } = useBookings();
  const { bookings } = useBookings();
  const { balance, hasSufficientBalance, deductMoney } = useWallet();
  const { getSlotsForDate, fetchSlotsForProviderAndDate } = useAvailability();
  const { services, activeServices } = useServices();

  const [backendSlots, setBackendSlots] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const defaultService = useMemo(() => {
    return (
      activeServices[0] ||
      services[0] || {
        id: 1,
        title: "AC Repair & Service",
        name: "AC Repair & Service",
        category: "AC Repair",
        price: 599,
        duration: "45–60 min",
      }
    );
  }, [activeServices, services]);

  // Step 0: Service
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedService, setSelectedService] = useState(() => {
    return location.state?.service || defaultService;
  });

  // Flow starts at Location (step 1) if service was preselected via BrowseServices
  const [step, setStep] = useState(() => (location.state?.service ? 1 : 0));

  // Step 1: Location Discovery (Option A: Current GPS Location, Option B: Community)
  const [locationMode, setLocationMode] = useState("community"); // 'gps' | 'community'
  const [communities, setCommunities] = useState([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState(null);

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [gpsInfo, setGpsInfo] = useState(null); // { latitude, longitude, accuracy, timestamp, address }

  // Discovery Search Center Coordinates
  const [discoveryCoords, setDiscoveryCoords] = useState(null); // { lat, lng, label }

  // Step 2: Nearby Providers
  const [availableProviders, setAvailableProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerError, setProviderError] = useState("");

  // Step 3: Schedule & Problem
  const [date, setDate] = useState(todayStr);
  const [timeSlot, setTimeSlot] = useState(location.state?.selectedSlot || "10:00 AM");
  const [problemDescription, setProblemDescription] = useState("");
  const [mediaAttachments, setMediaAttachments] = useState([]);
  const [mediaError, setMediaError] = useState("");

  // Step 4: Exact Address & Location Confirmation (Part 7 & Part 8)
  const [exactServiceAddress, setExactServiceAddress] = useState("");

  // Step 5: Price & Payment
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [payment, setPayment] = useState("cash");
  const [confirmed, setConfirmed] = useState(false);
  const [stepError, setStepError] = useState("");
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Fetch communities from database
  useEffect(() => {
    let isMounted = true;
    setLoadingCommunities(true);
    apiClient
      .get("/communities?activeOnly=true")
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data || res.data || [];
        setCommunities(list);
        if (list.length > 0 && !selectedCommunity && !discoveryCoords) {
          // Preselect first community as convenient initial choice
          setSelectedCommunity(list[0]);
          setDiscoveryCoords({
            lat: Number(list[0].latitude),
            lng: Number(list[0].longitude),
            label: list[0].name,
          });
          setExactServiceAddress(`${list[0].name}, ${list[0].address}`);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch communities:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingCommunities(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync selectedService from route state if present
  useEffect(() => {
    if (location.state?.service) {
      setSelectedService(location.state.service);
    }
  }, [location.state?.service]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(["All"]);
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [services]);

  const filteredServices = useMemo(() => {
    if (selectedCategory === "All") return services.length > 0 ? services : [defaultService];
    return services.filter((s) => s.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [services, selectedCategory, defaultService]);

  // Filter communities by search
  const filteredCommunities = useMemo(() => {
    if (!communitySearch.trim()) return communities;
    const q = communitySearch.toLowerCase().trim();
    return communities.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const area = (c.area || "").toLowerCase();
      const addr = (c.address || "").toLowerCase();
      const city = (c.city || "").toLowerCase();
      return name.includes(q) || area.includes(q) || addr.includes(q) || city.includes(q);
    });
  }, [communities, communitySearch]);

  // PART 1: Real Browser Geolocation Click Handler
  const handleUseCurrentLocation = () => {
    setGpsError("");
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser. Please select your community manually.");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp || Date.now();

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          setGpsError("Invalid GPS coordinates received from device. Please select your community manually.");
          setGpsLoading(false);
          return;
        }

        try {
          const resolvedAddr = await reverseGeocode(latitude, longitude);
          const info = {
            latitude,
            longitude,
            lat: latitude,
            lng: longitude,
            accuracy,
            timestamp,
            address: resolvedAddr,
          };
          setGpsInfo(info);
          setSelectedCommunity(null); // Using GPS, not community
          setLocationMode("gps");
          setDiscoveryCoords({
            lat: latitude,
            lng: longitude,
            label: "Current GPS Location",
          });
          setExactServiceAddress(resolvedAddr);
        } catch {
          const fallbackAddr = `GPS Location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
          setGpsInfo({
            latitude,
            longitude,
            lat: latitude,
            lng: longitude,
            accuracy,
            timestamp,
            address: fallbackAddr,
          });
          setSelectedCommunity(null);
          setLocationMode("gps");
          setDiscoveryCoords({
            lat: latitude,
            lng: longitude,
            label: "Current GPS Location",
          });
          setExactServiceAddress(fallbackAddr);
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        setGpsLoading(false);
        let errorMsg = "Location permission denied. Please enable location permission or select your community manually.";
        if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "GPS location unavailable. Please check device location settings or select your community manually.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Location request timed out. Please try again or select your community manually.";
        }
        setGpsError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Community selection handler
  const handleSelectCommunity = (comm) => {
    setSelectedCommunity(comm);
    setLocationMode("community");
    setGpsInfo(null);
    setGpsError("");
    setDiscoveryCoords({
      lat: Number(comm.latitude),
      lng: Number(comm.longitude),
      label: comm.name,
    });
    setExactServiceAddress(`${comm.name}, ${comm.address}`);
  };

  // Fetch recommended nearby providers when moving to Step 2
  useEffect(() => {
    if (step === 2 && selectedService && discoveryCoords) {
      let isMounted = true;
      setLoadingProviders(true);
      setProviderError("");

      const svcId = selectedService.id || selectedService.serviceId;
      const params = {
        latitude: discoveryCoords.lat,
        longitude: discoveryCoords.lng,
        serviceId: svcId,
        serviceTitle: selectedService.title || selectedService.name,
        category: selectedService.category,
      };
      if (location.state?.selectedSlot) {
        params.date = date;
        params.time = timeSlot;
      }

      // Call existing real recommendation API
      apiClient
        .get("/providers/recommended", params)
        .then((res) => {
          if (!isMounted) return;
          const data = res.data?.data || res.data || {};
          const list = data.providers || (Array.isArray(data) ? data : []);
          setAvailableProviders(list);
          if (list.length > 0) {
            setSelectedProvider(list[0]);
          } else {
            setSelectedProvider(null);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error("Provider recommendation error:", err);
          const errorMsg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Failed to find nearby providers.";
          setProviderError(errorMsg);
          setAvailableProviders([]);
          setSelectedProvider(null);
        })
        .finally(() => {
          if (isMounted) setLoadingProviders(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [step, selectedService, discoveryCoords, date, timeSlot]);

  // Fetch authoritative daily slots from backend for selected provider and date
  useEffect(() => {
    let isMounted = true;
    if (selectedProvider && date) {
      const provId = selectedProvider.userId || selectedProvider.providerId || selectedProvider.id;
      setLoadingSlots(true);
      fetchSlotsForProviderAndDate(provId, date, selectedService?.duration)
        .then((res) => {
          if (!isMounted) return;
          setBackendSlots(res.availableSlots || []);
          setSlotsMessage(res.message || "");
          if (res.availableSlots?.length > 0) {
            if (!timeSlot || !res.availableSlots.includes(timeSlot)) {
              setTimeSlot(res.availableSlots[0]);
            }
          } else {
            setTimeSlot("");
          }
        })
        .catch(() => {
          if (!isMounted) return;
          const provName = selectedProvider?.providerName || selectedProvider?.name || selectedProvider?.businessName;
          const fallback = getSlotsForDate(provName, date, bookings);
          setBackendSlots(fallback);
          if (fallback.length > 0 && (!timeSlot || !fallback.includes(timeSlot))) {
            setTimeSlot(fallback[0]);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingSlots(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedProvider, date, selectedService?.duration, fetchSlotsForProviderAndDate, getSlotsForDate, bookings]);

  // Real-time Socket.IO subscription for provider availability changes
  useEffect(() => {
    if (!selectedProvider || !date) return;
    const provId = selectedProvider.userId || selectedProvider.providerId || selectedProvider.id;
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "") : "") ||
      (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "") : "") ||
      "http://localhost:5000";
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("provider_availability_updated", (payload) => {
      if (!payload || String(payload.providerId) === String(provId) || !payload.date || payload.date === date) {
        fetchSlotsForProviderAndDate(provId, date, selectedService?.duration).then((res) => {
          setBackendSlots(res.availableSlots || []);
          setSlotsMessage(res.message || "");
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedProvider, date, selectedService?.duration, fetchSlotsForProviderAndDate]);

  // Dynamic slots for selected provider
  const availableSlots = useMemo(() => {
    if (!date) return [];
    if (backendSlots !== null) return backendSlots;
    const provName = selectedProvider?.providerName || selectedProvider?.name || selectedProvider?.businessName;
    return getSlotsForDate(provName, date, bookings);
  }, [backendSlots, date, selectedProvider, getSlotsForDate, bookings]);


  // Fetch authoritative quote when entering step 5 (Payment & Book)
  useEffect(() => {
    if (step === 5 && selectedService && selectedProvider) {
      let isMounted = true;
      setLoadingQuote(true);
      const svcId = selectedService.id || selectedService.serviceId;
      const provId = selectedProvider.userId || selectedProvider.providerId || selectedProvider.id;

      apiClient
        .post("/bookings/quote", {
          serviceId: svcId,
          providerId: provId,
          serviceName: selectedService.title || selectedService.name,
          provider: selectedProvider.providerName || selectedProvider.businessName,
        })
        .then((res) => {
          if (!isMounted) return;
          const data = res.data?.data || res.data;
          setQuote(data?.pricing || null);
        })
        .catch(() => {
          if (!isMounted) return;
          setQuote({
            baseAmount: Number(selectedProvider.price || selectedService.price || 349),
            travelCharge: 0,
            additionalCharge: 0,
            discount: 0,
            tax: 0,
            finalAmount: Number(selectedProvider.price || selectedService.price || 349),
            pricingType: (selectedProvider.pricingType || "fixed").toLowerCase(),
            currency: "INR",
          });
        })
        .finally(() => {
          if (isMounted) setLoadingQuote(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [step, selectedService, selectedProvider]);

  // Media upload handler
  const handleMediaUpload = (e) => {
    setMediaError("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const dangerousExtensions = /\.(exe|bat|sh|cmd|msi|vbs|pif|scr|com|js|php|py)$/i;
    for (const file of files) {
      if (dangerousExtensions.test(file.name)) {
        setMediaError("Executable and script files are strictly not permitted.");
        return;
      }
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setMediaError("Only image and video files are supported.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMediaError(`"${file.name}" exceeds 5MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        setMediaAttachments((prev) => [
          ...prev,
          {
            url: uploadEvt.target.result,
            type: file.type.startsWith("video/") ? "video" : "image",
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMedia = (idx) => {
    setMediaAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Step Validation & Navigation
  const goNext = () => {
    setStepError("");
    if (step === 0) {
      if (!selectedService) {
        setStepError("Please select a service to proceed.");
        return;
      }
    }
    if (step === 1) {
      if (!discoveryCoords) {
        setStepError("Please choose your service location (either Use Current Location or Select Community).");
        return;
      }
    }
    if (step === 2) {
      if (!selectedProvider) {
        setStepError("Please select an available provider to continue.");
        return;
      }
    }
    if (step === 3) {
      if (!date) {
        setStepError("Please select a preferred service date.");
        return;
      }
      if (!timeSlot) {
        setStepError("Please choose an available time slot.");
        return;
      }
    }
    if (step === 4) {
      if (!exactServiceAddress.trim()) {
        setStepError("Please enter your exact service address (flat, door, block, street).");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError("");
    setStep((s) => Math.max(s - 1, 0));
  };

  // Final Booking Creation
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    setStepError("");

    if (!selectedService || !selectedProvider || !discoveryCoords) {
      setStepError("Booking information is incomplete.");
      return;
    }

    if (!exactServiceAddress.trim()) {
      setStepError("Please enter your exact door/flat number and address.");
      return;
    }

    const finalAmount = quote?.finalAmount ?? selectedProvider.price ?? selectedService.price ?? 349;

    if (payment === "wallet" && !hasSufficientBalance(finalAmount)) {
      setStepError(`Insufficient wallet balance (₹${balance}). Please add funds or choose Cash.`);
      return;
    }

    setBookingInProgress(true);
    try {
      const provId = selectedProvider.userId || selectedProvider.providerId || selectedProvider.id;
      const svcId = selectedService.id || selectedService.serviceId;

      const bookingPayload = {
        serviceId: svcId,
        providerId: provId,
        communityId: selectedCommunity ? selectedCommunity.id : null,
        community_id: selectedCommunity ? selectedCommunity.id : null,
        customer: user?.name || "Customer",
        provider: selectedProvider.businessName || selectedProvider.providerName || selectedProvider.name,
        service: selectedService.title || selectedService.name,
        serviceName: selectedService.title || selectedService.name,
        category: selectedService.category || "General",
        date,
        rawDate: date,
        time: timeSlot,
        amount: formatCurrency(finalAmount),
        rawAmount: finalAmount,
        payment,
        paymentMethod: payment === "wallet" ? "wallet" : payment === "cash" ? "cash" : "online",
        paymentStatus: payment === "cash" ? "cash_pending" : "pending",
        instructions: problemDescription,
        problemDescription,
        mediaAttachments,
        address: exactServiceAddress.trim(),
        latitude: discoveryCoords.lat,
        longitude: discoveryCoords.lng,
        lat: discoveryCoords.lat,
        lng: discoveryCoords.lng,
        serviceLocation: {
          address: exactServiceAddress.trim(),
          latitude: discoveryCoords.lat,
          longitude: discoveryCoords.lng,
          communityId: selectedCommunity ? selectedCommunity.id : null,
          communityName: selectedCommunity ? selectedCommunity.name : null,
        },
        location: {
          lat: discoveryCoords.lat,
          lng: discoveryCoords.lng,
        },
      };

      const result = await createBooking(bookingPayload);
      const createdId = result?.id || result?.bookingNumber || result?._id;

      // Online payment (UPI / Card / NetBanking): Initiate Razorpay Authorization Hold
      if (payment === "card" || payment === "upi") {
        try {
          const orderRes = await apiClient.post("/payments/create-order", {
            bookingId: result?.id || createdId,
            amount: finalAmount
          });

          const { orderId, keyId } = orderRes?.data || {};
          const scriptLoaded = await loadRazorpayScript();

          if (scriptLoaded && typeof window !== "undefined" && window.Razorpay) {
            await new Promise((resolve) => {
              const rzp = new window.Razorpay({
                key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: Math.round(finalAmount * 100),
                currency: "INR",
                name: "FixIt Local",
                description: `Hold & Authorize: ${selectedService.title || selectedService.name}`,
                order_id: orderId,
                handler: async (response) => {
                  try {
                    await apiClient.post("/payments/verify", {
                      orderId: response.razorpay_order_id || orderId,
                      paymentId: response.razorpay_payment_id,
                      signature: response.razorpay_signature
                    });
                  } catch (_) {}
                  resolve(true);
                },
                modal: {
                  ondismiss: () => {
                    resolve(false);
                  }
                },
                prefill: {
                  name: user?.name || "",
                  email: user?.email || "",
                  contact: user?.phone || ""
                },
                theme: { color: "#2563eb" }
              });
              rzp.open();
            });
          }
        } catch (payErr) {
          console.warn("[Razorpay Flow Note]:", payErr.message);
        }
      }

      setConfirmed(true);

      setTimeout(() => {
        if (createdId) {
          navigate(`/customer/track/${createdId}`);
        } else {
          navigate("/customer/booking-history");
        }
      }, 1200);
    } catch (err) {
      setStepError(err.message || "Failed to create booking. Please check provider availability.");
    } finally {
      setBookingInProgress(false);
    }
  };

  return (
    <Layout title={t("bookService")}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4, marginBottom: 20 }}>
          Real-World Local Service Booking • Real Geolocation • Community Provider Matching
        </p>

        <WizardProgress current={step} onStepClick={(target) => setStep(target)} />

        {stepError && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            ⚠️ {stepError}
          </div>
        )}

        {/* STEP 0: Select Service */}
        {step === 0 && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>1. Select Service &amp; Category</h3>

            {/* Category Pills */}
            <div className="flex-row mb-4" style={{ gap: 8, overflowX: "auto", paddingBottom: 8 }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`btn btn-sm ${selectedCategory === cat ? "btn-primary" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Services List */}
            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              {filteredServices.map((s) => {
                const isSel = (s.id || s.serviceId) === (selectedService?.id || selectedService?.serviceId);
                return (
                  <div
                    key={s.id || s.title}
                    className="stat-card"
                    style={{
                      padding: 16,
                      cursor: "pointer",
                      border: isSel ? "2px solid var(--blue)" : "1px solid var(--border)",
                      background: isSel ? "rgba(59, 130, 246, 0.08)" : "var(--surface)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderRadius: 10,
                    }}
                    onClick={() => setSelectedService(s)}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: 15, color: "var(--ink)" }}>{s.title || s.name}</strong>
                        <span style={{ fontSize: 11, background: "var(--stripe)", padding: "2px 8px", borderRadius: 4, color: "var(--muted)" }}>
                          {s.category}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                        {s.duration || "45–60 min"} • Verified Service Provider
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>{formatCurrency(s.price)}</div>
                      <span style={{ fontSize: 11, color: isSel ? "var(--blue)" : "var(--faint)", fontWeight: isSel ? 700 : 400 }}>
                        {isSel ? "✓ Selected" : "Select"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Where do you need this service? →
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Location Discovery (Option A: Current Location OR Option B: Community) */}
        {step === 1 && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>2. Where do you need this service?</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4, marginBottom: 18 }}>
              FixIt Local matches providers based on real proximity. Choose how you'd like to provide your service location:
            </p>

            {/* Two Main Option Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {/* Option A: Use My Current Location */}
              <div
                className="stat-card"
                style={{
                  padding: 20,
                  cursor: "pointer",
                  borderRadius: 12,
                  border: locationMode === "gps" ? "2px solid var(--blue)" : "1px solid var(--border)",
                  background: locationMode === "gps" ? "rgba(59, 130, 246, 0.08)" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onClick={handleUseCurrentLocation}
              >
                <div>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>📍</div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 15, color: "var(--ink)" }}>Use My Current Location</h4>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                    Fetch real device GPS coordinates via browser permission.
                  </p>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${locationMode === "gps" ? "btn-primary" : "btn-outline"}`}
                    style={{ width: "100%" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseCurrentLocation();
                    }}
                    disabled={gpsLoading}
                  >
                    {gpsLoading ? "Detecting GPS..." : "📍 Locate Me Now"}
                  </button>
                </div>
              </div>

              {/* Option B: Select Community */}
              <div
                className="stat-card"
                style={{
                  padding: 20,
                  cursor: "pointer",
                  borderRadius: 12,
                  border: locationMode === "community" ? "2px solid var(--blue)" : "1px solid var(--border)",
                  background: locationMode === "community" ? "rgba(59, 130, 246, 0.08)" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onClick={() => setLocationMode("community")}
              >
                <div>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>🏢</div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 15, color: "var(--ink)" }}>Select Community</h4>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                    Choose your gated apartment or residential complex in Chennai.
                  </p>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${locationMode === "community" ? "btn-primary" : "btn-outline"}`}
                    style={{ width: "100%" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocationMode("community");
                    }}
                  >
                    🏢 Choose Community
                  </button>
                </div>
              </div>
            </div>

            {/* GPS Status & Error Messages */}
            {gpsError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid #ef4444",
                  color: "#fca5a5",
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div>
                  <strong>Location Access Notice:</strong> {gpsError}
                </div>
              </div>
            )}

            {/* Sub-panel: Option A Live GPS Feedback */}
            {locationMode === "gps" && gpsInfo && (
              <div
                className="stat-card"
                style={{
                  padding: 16,
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: 10,
                  marginBottom: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: "#10b981", fontSize: 16 }}>✓</span>
                  <strong style={{ color: "#10b981", fontSize: 13.5 }}>GPS Location Confirmed</strong>
                  {gpsInfo.accuracy && (
                    <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
                      Accuracy: ±{Math.round(gpsInfo.accuracy)}m
                    </span>
                  )}
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "var(--ink)" }}>{gpsInfo.address}</p>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Coordinates: {gpsInfo.latitude.toFixed(5)}°, {gpsInfo.longitude.toFixed(5)}°
                </div>
              </div>
            )}

            {/* Sub-panel: Option B Community Selection Directory */}
            {locationMode === "community" && (
              <div className="stat-card" style={{ padding: 18, marginBottom: 18, borderRadius: 10 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Select Your Residential Community / Apartment:
                  </label>
                  <input
                    type="text"
                    placeholder="Search communities by name or area (e.g. ABC Residency, Anna Nagar)..."
                    value={communitySearch}
                    onChange={(e) => setCommunitySearch(e.target.value)}
                    className="text-input"
                    style={{ width: "100%" }}
                  />
                </div>

                {loadingCommunities ? (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading registered communities...</p>
                ) : filteredCommunities.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--muted)" }}>No community matches your search.</p>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                    {filteredCommunities.map((comm) => {
                      const isSel = selectedCommunity?.id === comm.id;
                      return (
                        <div
                          key={comm.id}
                          onClick={() => handleSelectCommunity(comm)}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            cursor: "pointer",
                            border: isSel ? "1.5px solid var(--blue)" : "1px solid var(--border)",
                            background: isSel ? "rgba(59, 130, 246, 0.12)" : "var(--surface)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 13.5, color: isSel ? "var(--blue)" : "var(--ink)" }}>
                              {comm.name}
                            </strong>
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                              {comm.area ? `${comm.area}, ` : ""}{comm.city || "Chennai"} • {comm.address}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: isSel ? "var(--blue)" : "var(--faint)", fontWeight: isSel ? 700 : 400 }}>
                            {isSel ? "✓ Selected" : "Select"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Location Confirmed Summary Card */}
            {discoveryCoords && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
                    Search Center Confirmed:
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>
                    {selectedCommunity ? `🏢 ${selectedCommunity.name}` : `📍 ${discoveryCoords.label}`}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    GPS: {discoveryCoords.lat.toFixed(4)}°, {discoveryCoords.lng.toFixed(4)}°
                  </div>
                </div>

                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  ✓ Ready for Discovery
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back to Service
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={goNext}
                disabled={!discoveryCoords}
              >
                Find Nearby Providers →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Nearby Recommended Providers (Part 5, 6, 24) */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 18 }}>3. Nearby Recommended Providers</h3>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
                Showing available certified experts near{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {selectedCommunity ? selectedCommunity.name : "your location"}
                </strong>
                . Ranked by real-time distance, rating, price, and track record.
              </p>
            </div>

            {loadingProviders ? (
              <div style={{ padding: 32, textAlign: "center", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 20 }}>
                <p style={{ color: "var(--muted)", margin: 0 }}>📍 Calculating distances and fetching recommended providers...</p>
              </div>
            ) : providerError ? (
              <div style={{ padding: 24, textAlign: "center", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 20 }}>
                <p style={{ color: "var(--red)", fontWeight: 600, margin: "0 0 6px" }}>{providerError}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setStep(1)}>
                  Change Location Center
                </button>
              </div>
            ) : availableProviders.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 20 }}>
                <p style={{ color: "var(--red)", fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>
                  No available providers found within service radius.
                </p>
                <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 16px" }}>
                  Try selecting a nearby community or different service category.
                </p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setStep(1)}>
                  ← Select Different Community / Location
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
                {availableProviders.map((p) => {
                  const isSel = (p.providerId || p.userId || p.id) === (selectedProvider?.providerId || selectedProvider?.userId || selectedProvider?.id);
                  const isAvail = p.isAvailable || p.availabilityStatus === "AVAILABLE";
                  const provPrice = p.price != null ? p.price : (selectedService.price || 349);
                  const eta = p.distanceKm != null ? calculateEtaMinutes(p.distanceKm) : 20;

                  return (
                    <div
                      key={p.providerId || p.userId || p.id}
                      className="stat-card"
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        cursor: "pointer",
                        border: isSel ? "2px solid var(--blue)" : "1px solid var(--border)",
                        background: isSel ? "rgba(59, 130, 246, 0.08)" : "var(--surface)",
                        boxShadow: isSel ? "0 4px 16px rgba(59, 130, 246, 0.15)" : undefined,
                      }}
                      onClick={() => setSelectedProvider(p)}
                    >
                      {/* Top Row: Provider Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              background: "rgba(59, 130, 246, 0.2)",
                              color: "var(--blue)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 16,
                            }}
                          >
                            {(p.providerName || p.businessName || "P").charAt(0)}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 15, color: "var(--ink)" }}>
                                {p.providerName || p.businessName}
                              </strong>
                              {p.isVerified && (
                                <span style={{ fontSize: 11, color: "var(--blue)", fontWeight: 700 }}>✓ Verified</span>
                              )}
                            </div>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              {p.category || selectedService.category} • Certified Specialist
                            </span>
                          </div>
                        </div>

                        {/* Availability & Rate */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{ marginBottom: 4 }}>
                            {isAvail ? (
                              <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                                ● AVAILABLE
                              </span>
                            ) : (
                              <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                                ○ OFFLINE
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{formatCurrency(provPrice)}</div>
                          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.pricingType || "Fixed rate"}</span>
                        </div>
                      </div>

                      {/* Middle Row: Comparison Metrics */}
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "center",
                          fontSize: 12,
                          color: "var(--muted)",
                          borderTop: "1px solid var(--border)",
                          marginTop: 12,
                          paddingTop: 10,
                        }}
                      >
                        <span style={{ color: "var(--blue)", fontWeight: 700 }}>
                          📍 {p.distanceKm != null ? `${p.distanceKm} km away` : "Nearby"}
                        </span>
                        <span>•</span>
                        <span>⚡ Est. Arrival: ~{eta} mins</span>
                        <span>•</span>
                        <span>⭐ {Number(p.rating || 5).toFixed(1)} ({p.reviewCount || 0} reviews)</span>
                        <span>•</span>
                        <span>💼 {p.completedJobs || 0} jobs done</span>
                      </div>

                      {/* Subtle Recommendation Quality Indicator */}
                      {p.recommendationScore != null && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: "rgba(59, 130, 246, 0.05)",
                            border: "1px solid rgba(59, 130, 246, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 11.5,
                          }}
                        >
                          <span style={{ color: "var(--blue)", fontWeight: 600 }}>
                            ✨ High match for {selectedCommunity?.name || "your location"}
                          </span>
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>
                            Match Score: {p.recommendationScore}/100
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Change Location
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={goNext}
                disabled={!selectedProvider}
              >
                Choose Date &amp; Details →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Schedule & Problem Details */}
        {step === 3 && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>4. Schedule &amp; Problem Details</h3>

            <div className="stat-card" style={{ padding: 20, marginBottom: 20, borderRadius: 12 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Preferred Service Date *
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-input"
                  style={{ width: "100%", maxWidth: 300 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Available Time Slots ({selectedProvider?.providerName || selectedProvider?.name}) *
                </label>
                {loadingSlots ? (
                  <div style={{ padding: "16px", color: "var(--muted)", fontSize: 13 }}>
                    ⏳ Checking real-time provider availability &amp; slots...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div
                    role="status"
                    style={{
                      padding: "16px 20px",
                      borderRadius: "8px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      color: "#fca5a5",
                      fontSize: 13.5,
                    }}
                  >
                    <strong>No available time slots on this date.</strong>
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#fecaca" }}>
                      {slotsMessage || "The provider has marked this date as unavailable, or all working slots have been booked. Please choose another date or select another nearby provider."}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
                    {availableSlots.map((slot) => {
                      const isSel = timeSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          className="btn"
                          style={
                            isSel
                              ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)", fontWeight: 700 }
                              : {}
                          }
                          onClick={() => setTimeSlot(slot)}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Describe the Issue / Service Needs (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. AC cooling issue in living room, leaking tap under sink, fan regulator replacement..."
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  className="text-input"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Optional media attachments */}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                  Upload Photos / Videos (Optional, max 5MB)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  style={{ fontSize: 12 }}
                />
                {mediaError && <p style={{ color: "var(--red)", fontSize: 11.5, margin: "4px 0 0" }}>{mediaError}</p>}

                {mediaAttachments.length > 0 && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    {mediaAttachments.map((att, idx) => (
                      <div key={idx} style={{ position: "relative", width: 70, height: 70, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <img src={att.url} alt="upload" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={() => removeMedia(idx)}
                          style={{
                            position: "absolute",
                            top: 2,
                            right: 2,
                            background: "rgba(0,0,0,0.7)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back to Providers
              </button>
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Confirm Exact Address →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Exact Address & Location Confirmation (Part 7 & Part 8) */}
        {step === 4 && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>5. Service Location &amp; Exact Address Confirmation</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4, marginBottom: 18 }}>
              The community was used to discover nearby providers. Now confirm the exact flat / door address where the specialist will perform the service:
            </p>

            <div className="stat-card" style={{ padding: 20, marginBottom: 20, borderRadius: 12 }}>
              {/* Summary Metadata Table */}
              <div
                style={{
                  background: "var(--stripe)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Discovery Community:</span>
                  <div style={{ fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>
                    {selectedCommunity ? `🏢 ${selectedCommunity.name}` : "📍 GPS Detected Location"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Locality / Area:</span>
                  <div style={{ fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>
                    {selectedCommunity?.area ? `${selectedCommunity.area}, Chennai` : "Chennai"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Latitude:</span>
                  <div style={{ fontFamily: "monospace", color: "var(--ink)", marginTop: 2 }}>
                    {discoveryCoords ? discoveryCoords.lat.toFixed(6) : "—"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Longitude:</span>
                  <div style={{ fontFamily: "monospace", color: "var(--ink)", marginTop: 2 }}>
                    {discoveryCoords ? discoveryCoords.lng.toFixed(6) : "—"}
                  </div>
                </div>
              </div>

              {/* Exact Service Address Input (Editable) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Exact Service Address (Flat, Floor, Block, Door No.) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Block A, Flat 304, ABC Residency, 2nd Avenue, Anna Nagar, Chennai - 600040"
                  value={exactServiceAddress}
                  onChange={(e) => setExactServiceAddress(e.target.value)}
                  className="text-input"
                  style={{ width: "100%", fontSize: 13.5 }}
                />
                <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, display: "block" }}>
                  💡 Enter your precise unit / flat number so the provider can easily reach your door.
                </span>
              </div>

              {/* Location Map Preview */}
              {discoveryCoords && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                    Location Preview
                  </label>
                  <GoogleMap
                    center={{ lat: discoveryCoords.lat, lng: discoveryCoords.lng }}
                    zoom={16}
                    markers={[
                      {
                        lat: discoveryCoords.lat,
                        lng: discoveryCoords.lng,
                        title: exactServiceAddress || "Service Destination",
                      },
                    ]}
                    height="220px"
                    statusText="Confirmed Service Location"
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back to Schedule
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={goNext}
                disabled={!exactServiceAddress.trim()}
              >
                Proceed to Payment →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Price Quote & Payment Confirmation */}
        {step === 5 && (
          <div>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>6. Price Quote &amp; Confirm Booking</h3>

            {/* Service & Provider Summary Card */}
            <div className="stat-card" style={{ padding: 18, marginBottom: 16, borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Service:</span>
                  <h4 style={{ margin: "2px 0 0", fontSize: 16, color: "var(--ink)" }}>
                    {selectedService.title || selectedService.name}
                  </h4>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Provider:</span>
                  <div style={{ fontWeight: 700, color: "var(--blue)" }}>
                    {selectedProvider?.providerName || selectedProvider?.businessName}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                📅 <strong>{date}</strong> at <strong>{timeSlot}</strong>
                <br />
                📍 <strong>{exactServiceAddress}</strong>
              </div>
            </div>

            {/* Authoritative Quote Breakdown */}
            <div className="stat-card" style={{ padding: 18, marginBottom: 20, borderRadius: 12 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink)" }}>Bill Summary</h4>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Base Service Charge:</span>
                <span>{formatCurrency(quote?.baseAmount ?? selectedProvider?.price ?? selectedService.price ?? 349)}</span>
              </div>

              {quote?.travelCharge > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span>Travel / Distance Fee:</span>
                  <span>{formatCurrency(quote.travelCharge)}</span>
                </div>
              )}

              {quote?.tax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span>Taxes &amp; Fees:</span>
                  <span>{formatCurrency(quote.tax)}</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--ink)",
                  borderTop: "1px solid var(--border)",
                  paddingTop: 10,
                  marginTop: 8,
                }}
              >
                <span>Total Amount:</span>
                <span style={{ color: "var(--blue)" }}>
                  {formatCurrency(quote?.finalAmount ?? selectedProvider?.price ?? selectedService.price ?? 349)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="stat-card" style={{ padding: 18, marginBottom: 20, borderRadius: 12 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink)" }}>Choose Payment Method</h4>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  style={payment === "cash" ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)", fontWeight: 700 } : {}}
                  onClick={() => setPayment("cash")}
                >
                  💵 Cash After Service
                </button>

                <button
                  type="button"
                  className="btn"
                  style={payment === "wallet" ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)", fontWeight: 700 } : {}}
                  onClick={() => setPayment("wallet")}
                >
                  💳 Wallet (₹{balance})
                </button>

                <button
                  type="button"
                  className="btn"
                  style={payment === "upi" ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)", fontWeight: 700 } : {}}
                  onClick={() => setPayment("upi")}
                >
                  📱 UPI / Online
                </button>

                <button
                  type="button"
                  className="btn"
                  style={payment === "card" ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)", fontWeight: 700 } : {}}
                  onClick={() => setPayment("card")}
                >
                  💳 Credit / Debit Card
                </button>
              </div>
            </div>

            {confirmed && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid #10b981",
                  color: "#10b981",
                  padding: "14px 18px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                🎉 Booking Confirmed! Redirecting to Live Tracking...
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={goBack} disabled={bookingInProgress}>
                ← Back to Address
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBooking}
                disabled={bookingInProgress || confirmed}
                style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700 }}
              >
                {bookingInProgress ? "Securing Booking..." : "Confirm & Place Booking →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
