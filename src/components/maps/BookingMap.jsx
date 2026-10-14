import { useState, useEffect } from "react";
import GoogleMap from "./GoogleMap";
import { getCurrentCoordinates, reverseGeocode, forwardGeocode } from "../../utils/geocode";

export default function BookingMap({
  savedAddress = "",
  savedCoords = null,
  value,
  onChange,
}) {
  // Option: "saved" | "manual" | "gps"
  const [mode, setMode] = useState("saved");
  const [manualAddress, setManualAddress] = useState("");
  const [gpsLocation, setGpsLocation] = useState(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState("");

  // Initialize with saved address
  useEffect(() => {
    if (mode === "saved") {
      onChange({
        mode: "saved",
        address: savedAddress || "Saved Profile Address",
        latitude: savedCoords?.lat || savedCoords?.latitude || null,
        longitude: savedCoords?.lng || savedCoords?.longitude || null,
        lat: savedCoords?.lat || savedCoords?.latitude || null,
        lng: savedCoords?.lng || savedCoords?.longitude || null,
      });
    }
  }, [mode, savedAddress, savedCoords]);

  const handleSelectMode = (newMode) => {
    setMode(newMode);
    setGpsError("");

    if (newMode === "saved") {
      onChange({
        mode: "saved",
        address: savedAddress || "Saved Profile Address",
        latitude: savedCoords?.lat || savedCoords?.latitude || null,
        longitude: savedCoords?.lng || savedCoords?.longitude || null,
        lat: savedCoords?.lat || savedCoords?.latitude || null,
        lng: savedCoords?.lng || savedCoords?.longitude || null,
      });
    } else if (newMode === "manual") {
      onChange({
        mode: "manual",
        address: manualAddress,
        latitude: null,
        longitude: null,
        lat: null,
        lng: null,
      });
    } else if (newMode === "gps") {
      if (gpsLocation) {
        onChange({
          mode: "gps",
          address: gpsLocation.address,
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          lat: gpsLocation.latitude,
          lng: gpsLocation.longitude,
        });
      } else {
        fetchGps();
      }
    }
  };

  const handleManualChange = async (e) => {
    const val = e.target.value;
    setManualAddress(val);
    onChange({
      mode: "manual",
      address: val,
      latitude: null,
      longitude: null,
      lat: null,
      lng: null,
    });

    if (val.trim().length > 3) {
      try {
        const geo = await forwardGeocode(val);
        if (geo) {
          onChange({
            mode: "manual",
            address: val,
            latitude: geo.latitude,
            longitude: geo.longitude,
            lat: geo.latitude,
            lng: geo.longitude,
          });
        }
      } catch {
        // Fall back gracefully
      }
    }
  };

  const fetchGps = async () => {
    setLoadingGps(true);
    setGpsError("");
    try {
      const coords = await getCurrentCoordinates();
      const resolvedAddress = await reverseGeocode(coords.latitude, coords.longitude);
      const loc = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        lat: coords.latitude,
        lng: coords.longitude,
        address: resolvedAddress,
      };
      setGpsLocation(loc);
      onChange({
        mode: "gps",
        address: resolvedAddress,
        latitude: coords.latitude,
        longitude: coords.longitude,
        lat: coords.latitude,
        lng: coords.longitude,
      });
    } catch (err) {
      setGpsError(err.message || "Location permission denied. Please enter the address manually.");
    } finally {
      setLoadingGps(false);
    }
  };

  // Determine active coordinates for map
  let activeCoords = null;
  let activeAddress = "";
  if (mode === "gps" && gpsLocation) {
    activeCoords = { lat: gpsLocation.latitude, lng: gpsLocation.longitude };
    activeAddress = gpsLocation.address;
  } else if (mode === "saved" && savedCoords) {
    activeCoords = { lat: savedCoords.lat || savedCoords.latitude, lng: savedCoords.lng || savedCoords.longitude };
    activeAddress = savedAddress;
  }

  const markers = activeCoords
    ? [
        {
          lat: activeCoords.lat,
          lng: activeCoords.lng,
          title: `Service Location (${activeAddress || "Selected"})`,
        },
      ]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
        Where should the service be provided?
      </label>

      {/* 3 Choice Buttons / Radios */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => handleSelectMode("saved")}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: mode === "saved" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
            background: mode === "saved" ? "rgba(59, 130, 246, 0.15)" : "#111a2e",
            color: "#ffffff",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
            <span>🏠</span>
            <span>Saved Address</span>
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {savedAddress || "From your profile"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMode("manual")}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: mode === "manual" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
            background: mode === "manual" ? "rgba(59, 130, 246, 0.15)" : "#111a2e",
            color: "#ffffff",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
            <span>✏️</span>
            <span>Enter New Address</span>
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Type specific street address</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMode("gps")}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: mode === "gps" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
            background: mode === "gps" ? "rgba(59, 130, 246, 0.15)" : "#111a2e",
            color: "#ffffff",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
            <span>📍</span>
            <span>Use Current Location</span>
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {loadingGps ? "Acquiring GPS..." : "Detect device coordinates"}
          </span>
        </button>
      </div>

      {/* Mode Sub-panels */}
      {mode === "manual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Service Destination Address *</label>
          <input
            type="text"
            required
            value={manualAddress}
            onChange={handleManualChange}
            placeholder="Door / Flat No., Street, Landmark, City, PIN code"
            style={{
              background: "#111a2e",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: 13,
            }}
          />
        </div>
      )}

      {mode === "gps" && gpsError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid #ef4444",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#fca5a5",
          }}
        >
          ⚠️ {gpsError}
        </div>
      )}

      {mode === "gps" && gpsLocation && (
        <div style={{ fontSize: 12, color: "#60a5fa" }}>
          📍 Detected Address: <strong>{gpsLocation.address}</strong>
        </div>
      )}

      {/* Map Display */}
      <GoogleMap
        center={activeCoords}
        zoom={16}
        markers={markers}
        height="260px"
        statusText={
          mode === "gps" && gpsLocation
            ? "Live GPS Selected"
            : mode === "saved"
            ? "Saved Address"
            : "Manual Entry"
        }
      />
    </div>
  );
}
