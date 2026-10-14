import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./TrackingMap.css";

// Default coordinates for Chennai / Tamil Nadu service hub
const DEFAULT_CUSTOMER_COORDS = { lat: 13.0827, lng: 80.2707 };

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function TrackingMap({
  destination = DEFAULT_CUSTOMER_COORDS,
  providerStart = null,
  providerName = "Provider",
  status = "On The Way",
  height = 360,
  onMetricsUpdate,
  onArrived,
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const providerMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const polylineRef = useRef(null);

  const destCoords = destination && destination.lat ? destination : DEFAULT_CUSTOMER_COORDS;
  const startCoords =
    providerStart && providerStart.lat
      ? providerStart
      : { lat: destCoords.lat + 0.019, lng: destCoords.lng - 0.021 };

  const [etaMinutes, setEtaMinutes] = useState(() => (status === "Arrived" || status === "Service Started" || status === "Completed" ? 0 : 12));
  const [distanceKm, setDistanceKm] = useState(() => (status === "Arrived" || status === "Service Started" || status === "Completed" ? 0 : 2.4));
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [hasArrived, setHasArrived] = useState(status === "Arrived" || status === "Service Started" || status === "Completed");

  // Center helper callbacks
  const handleCenterCustomer = useCallback(() => {
    if (mapInstanceRef.current && destCoords) {
      mapInstanceRef.current.setView([destCoords.lat, destCoords.lng], 15, { animate: true });
    }
  }, [destCoords]);

  const handleCenterProvider = useCallback(() => {
    if (mapInstanceRef.current && providerMarkerRef.current) {
      const pos = providerMarkerRef.current.getLatLng();
      mapInstanceRef.current.setView(pos, 15, { animate: true });
    }
  }, []);

  const handleFitBounds = useCallback(() => {
    if (mapInstanceRef.current && startCoords && destCoords) {
      mapInstanceRef.current.fitBounds(
        [
          [startCoords.lat, startCoords.lng],
          [destCoords.lat, destCoords.lng],
        ],
        { padding: [50, 50], animate: true }
      );
    }
  }, [startCoords, destCoords]);

  // Notify parent of metric changes
  useEffect(() => {
    if (onMetricsUpdate) {
      onMetricsUpdate({
        distanceKm: Number(distanceKm).toFixed(1),
        etaMinutes,
        lastUpdated,
      });
    }
  }, [distanceKm, etaMinutes, lastUpdated, onMetricsUpdate]);

  // Leaflet Map Initialization & Lifecycle
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if map already exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const midLat = (startCoords.lat + destCoords.lat) / 2;
    const midLng = (startCoords.lng + destCoords.lng) / 2;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([midLat, midLng], 14);

    mapInstanceRef.current = map;

    // High quality OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Custom Customer Icon
    const customerIcon = L.divIcon({
      className: "map-marker-pin",
      html: `
        <div class="map-marker-bubble customer">
          <span>🏠</span>
          <span>Your Location</span>
        </div>
        <div class="map-marker-tail customer"></div>
      `,
      iconSize: [110, 38],
      iconAnchor: [55, 38],
    });

    // Custom Provider Icon
    const providerIcon = L.divIcon({
      className: "map-marker-pin",
      html: `
        <div class="map-marker-bubble provider">
          <span class="map-marker-pulse"></span>
          <span>🚗</span>
          <span>${providerName}</span>
        </div>
        <div class="map-marker-tail provider"></div>
      `,
      iconSize: [130, 38],
      iconAnchor: [65, 38],
    });

    const custMarker = L.marker([destCoords.lat, destCoords.lng], { icon: customerIcon })
      .addTo(map)
      .bindPopup(`<b>Your Service Location</b><br/>Ready for provider arrival.`);
    customerMarkerRef.current = custMarker;

    const initialProviderPos =
      status === "Arrived" || status === "Service Started" || status === "Completed"
        ? [destCoords.lat, destCoords.lng]
        : [startCoords.lat, startCoords.lng];

    const provMarker = L.marker(initialProviderPos, { icon: providerIcon })
      .addTo(map)
      .bindPopup(`<b>${providerName}</b><br/>Status: ${status}`);
    providerMarkerRef.current = provMarker;

    // Route Polyline
    const polyline = L.polyline(
      [
        [startCoords.lat, startCoords.lng],
        [destCoords.lat, destCoords.lng],
      ],
      {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.85,
        dashArray: "8 8",
        lineCap: "round",
      }
    ).addTo(map);
    polylineRef.current = polyline;

    map.fitBounds(
      [
        [startCoords.lat, startCoords.lng],
        [destCoords.lat, destCoords.lng],
      ],
      { padding: [50, 50] }
    );

    // Resize recalculation safeguard
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [destCoords.lat, destCoords.lng, startCoords.lat, startCoords.lng, providerName]);

  // Real coordinate update (no simulated or hardcoded movement)
  useEffect(() => {
    if (providerStart && providerStart.lat != null && providerStart.lng != null) {
      if (providerMarkerRef.current) {
        providerMarkerRef.current.setLatLng([providerStart.lat, providerStart.lng]);
      }
      if (polylineRef.current && destCoords) {
        polylineRef.current.setLatLngs([
          [providerStart.lat, providerStart.lng],
          [destCoords.lat, destCoords.lng],
        ]);
      }
      const dist = calculateDistance(providerStart.lat, providerStart.lng, destCoords.lat, destCoords.lng);
      setDistanceKm(dist);
      setEtaMinutes(Math.max(1, Math.round((dist / 24) * 60)));
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } else if (status === "Arrived" || status === "Service Started" || status === "Completed") {
      setDistanceKm(0);
      setEtaMinutes(0);
      setHasArrived(true);
      if (providerMarkerRef.current && destCoords) {
        providerMarkerRef.current.setLatLng([destCoords.lat, destCoords.lng]);
      }
    }
  }, [providerStart?.lat, providerStart?.lng, destCoords?.lat, destCoords?.lng, status]);

  return (
    <div className="tracking-map-wrapper">
      {/* Live Status Pill Overlay */}
      <div className="map-live-status-pill">
        <span className="map-live-dot" />
        <span>
          {status === "On The Way"
            ? `🚗 On The Way • ETA ${etaMinutes} min`
            : status === "Arrived" || hasArrived
            ? "📍 Provider Arrived"
            : status === "Service Started"
            ? "🔧 Service In Progress"
            : status === "Completed"
            ? "✅ Service Completed"
            : `📋 ${status}`}
        </span>
      </div>

      {/* Floating Map Navigation Controls */}
      <div className="map-controls-overlay">
        <button type="button" className="map-btn" onClick={handleCenterProvider} title="Center on Provider">
          🚗 Provider
        </button>
        <button type="button" className="map-btn" onClick={handleCenterCustomer} title="Center on You">
          🏠 You
        </button>
        <button type="button" className="map-btn" onClick={handleFitBounds} title="Fit Entire Route">
          🗺️ Fit Route
        </button>
      </div>

      {/* Leaflet Map Target */}
      <div
        ref={containerRef}
        className="tracking-map-container"
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      />

      {/* Transparent Info Footer */}
      <div className="map-footer-notice">
        <span>
          {status === "On The Way"
            ? `🚗 ${providerName} is approx ${Number(distanceKm).toFixed(1)} km away • Speed: ~25 km/h`
            : status === "Arrived" || hasArrived
            ? `✅ ${providerName} has arrived at your address.`
            : status === "Completed"
            ? `✅ Service completed by ${providerName}.`
            : `⏳ Provider scheduled for arrival.`}
        </span>
        <span style={{ opacity: 0.75, fontSize: "10px" }}>
          ⚡ Frontend Mock Simulation • Updated {lastUpdated}
        </span>
      </div>
    </div>
  );
}

export default TrackingMap;
