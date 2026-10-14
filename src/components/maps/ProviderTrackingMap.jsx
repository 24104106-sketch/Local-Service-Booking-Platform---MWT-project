import { useState, useEffect, useMemo } from "react";
import GoogleMap from "./GoogleMap";
import { subscribeToBookingUpdates } from "../../api/socketClient";
import { calculateDistance, calculateEtaMinutes } from "../../utils/geocode";

export default function ProviderTrackingMap({
  bookingId,
  destination, // { lat, lng, address } or { latitude, longitude, address }
  initialProviderLocation = null,
  providerName = "Service Provider",
  status = "on_the_way",
  height = "360px",
  onMetricsUpdate = null,
}) {
  const [providerLocation, setProviderLocation] = useState(() => {
    if (initialProviderLocation && (initialProviderLocation.lat || initialProviderLocation.latitude)) {
      return {
        lat: Number(initialProviderLocation.lat ?? initialProviderLocation.latitude),
        lng: Number(initialProviderLocation.lng ?? initialProviderLocation.longitude),
        updatedAt: initialProviderLocation.updatedAt || new Date().toISOString(),
      };
    }
    return null;
  });

  const [lastUpdateText, setLastUpdateText] = useState(
    initialProviderLocation ? "Initial location" : "Waiting for GPS..."
  );

  // Normalize destination coordinates
  const destCoords = useMemo(() => {
    if (!destination) return null;
    const lat = Number(destination.lat ?? destination.latitude);
    const lng = Number(destination.lng ?? destination.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng, address: destination.address || "Service Destination" };
  }, [destination]);

  // Sync initialProviderLocation when loaded asynchronously
  useEffect(() => {
    if (initialProviderLocation && (initialProviderLocation.lat != null || initialProviderLocation.latitude != null)) {
      const lat = Number(initialProviderLocation.lat ?? initialProviderLocation.latitude);
      const lng = Number(initialProviderLocation.lng ?? initialProviderLocation.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        setProviderLocation((prev) => {
          if (!prev) {
            return {
              lat,
              lng,
              updatedAt: initialProviderLocation.updatedAt || new Date().toISOString(),
            };
          }
          return prev;
        });
        setLastUpdateText((prev) => (prev === "Waiting for GPS..." || prev === "Waiting for provider location..." ? "Initial location" : prev));
      }
    }
  }, [initialProviderLocation]);

  // Real-time Socket.IO subscription for live provider GPS updates
  useEffect(() => {
    if (!bookingId) return;

    const unsubscribe = subscribeToBookingUpdates(bookingId, {
      onLocation: (data) => {
        const rawLat = data?.latitude ?? data?.lat ?? data?.location?.lat;
        const rawLng = data?.longitude ?? data?.lng ?? data?.location?.lng;
        const nLat = Number(rawLat);
        const nLng = Number(rawLng);

        if (!isNaN(nLat) && !isNaN(nLng) && nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180) {
          setProviderLocation({
            lat: nLat,
            lng: nLng,
            accuracy: data.accuracy || null,
            speed: data.speed || null,
            heading: data.heading || 0,
            updatedAt: data.timestamp || new Date().toISOString(),
          });
          const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          setLastUpdateText(`Live GPS • ${timeStr}`);
        }
      },
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [bookingId]);

  const [googleRoute, setGoogleRoute] = useState(null);

  const handleRouteCalculated = (routeData) => {
    if (routeData) {
      setGoogleRoute(routeData);
    }
  };

  // Compute live distance & ETA metrics
  const metrics = useMemo(() => {
    if (googleRoute && googleRoute.durationText && googleRoute.distanceText) {
      return {
        distanceKm: googleRoute.distanceText,
        etaMinutes: googleRoute.durationText,
        isGoogle: true
      };
    }

    if (!destCoords || !providerLocation) {
      return { distanceKm: null, etaMinutes: null, isGoogle: false };
    }

    const dist = calculateDistance(
      providerLocation.lat,
      providerLocation.lng,
      destCoords.lat,
      destCoords.lng
    );
    const eta = calculateEtaMinutes(dist);

    return {
      distanceKm: dist != null ? `~${dist} km` : null,
      etaMinutes: eta != null ? `${eta} mins` : null,
      isGoogle: false
    };
  }, [googleRoute, destCoords, providerLocation]);

  // Notify parent component of real metrics
  useEffect(() => {
    if (onMetricsUpdate) {
      onMetricsUpdate({
        distanceKm: metrics.distanceKm != null ? metrics.distanceKm : "Calculating...",
        etaMinutes: metrics.etaMinutes != null ? metrics.etaMinutes : "Calculating...",
        lastUpdated: metrics.isGoogle ? `${lastUpdateText} (Google Route)` : lastUpdateText,
        hasProviderGps: !!providerLocation,
      });
    }
  }, [metrics, lastUpdateText, providerLocation, onMetricsUpdate]);

  // Prepare map markers
  const markers = useMemo(() => {
    const list = [];
    if (destCoords) {
      list.push({
        lat: destCoords.lat,
        lng: destCoords.lng,
        title: `📍 Destination: ${destCoords.address}`,
      });
    }

    if (providerLocation) {
      list.push({
        lat: providerLocation.lat,
        lng: providerLocation.lng,
        title: `🚗 ${providerName} (Live Location)`,
      });
    }

    return list;
  }, [destCoords, providerLocation, providerName]);

  // Driving route definition
  const route = useMemo(() => {
    if (destCoords && providerLocation) {
      return {
        origin: { lat: providerLocation.lat, lng: providerLocation.lng },
        destination: { lat: destCoords.lat, lng: destCoords.lng },
      };
    }
    return null;
  }, [destCoords, providerLocation]);

  const mapCenter = providerLocation || destCoords;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <GoogleMap
        center={mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null}
        zoom={15}
        markers={markers}
        route={route}
        height={height}
        onRouteCalculated={handleRouteCalculated}
        statusText={
          providerLocation
            ? `Live Tracking • ${metrics.distanceKm != null ? `${metrics.distanceKm}` : "Tracking"}`
            : "Waiting for Provider GPS"
        }
      />
    </div>
  );
}
