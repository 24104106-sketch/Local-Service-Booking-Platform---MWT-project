import { useState } from "react";
import GoogleMap from "./GoogleMap";
import { getCurrentCoordinates, reverseGeocode } from "../../utils/geocode";

export default function CurrentLocationMap({
  initialLocation = null,
  onLocationDetected = null,
  height = "320px",
  title = "My Current Location",
}) {
  const [location, setLocation] = useState(initialLocation);
  const [address, setAddress] = useState(initialLocation?.address || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetchCurrentLocation = async () => {
    setLoading(true);
    setError("");
    try {
      const coords = await getCurrentCoordinates();
      const resolvedAddress = await reverseGeocode(coords.latitude, coords.longitude);
      const locObj = {
        lat: coords.latitude,
        lng: coords.longitude,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: resolvedAddress,
      };

      setLocation(locObj);
      setAddress(resolvedAddress);

      if (onLocationDetected) {
        onLocationDetected(locObj);
      }
    } catch (err) {
      setError(err.message || "Location permission denied. Please enter the address manually.");
    } finally {
      setLoading(false);
    }
  };

  const markers = location
    ? [
        {
          lat: location.lat || location.latitude,
          lng: location.lng || location.longitude,
          title: "You are here (Current Location)",
        },
      ]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <strong style={{ fontSize: 14, color: "#ffffff" }}>{title}</strong>
          {address && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>
              📍 {address}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleFetchCurrentLocation}
          disabled={loading}
          className="btn btn-sm btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>📍</span>
          <span>{loading ? "Acquiring GPS..." : "Use My Current Location"}</span>
        </button>
      </div>

      {error && (
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
          ⚠️ {error}
        </div>
      )}

      <GoogleMap
        center={location ? { lat: location.lat || location.latitude, lng: location.lng || location.longitude } : null}
        zoom={16}
        markers={markers}
        height={height}
        statusText={location ? "GPS Active • Real Coordinates" : "GPS Inactive"}
        onCenterClick={location ? () => {} : null}
      />
    </div>
  );
}
